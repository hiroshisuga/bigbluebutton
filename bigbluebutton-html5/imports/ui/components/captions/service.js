import Captions from '/imports/api/captions';
import Users from '/imports/api/users';
import Auth from '/imports/ui/services/auth';
import PadsService from '/imports/ui/components/pads/service';
import SpeechService from '/imports/ui/components/captions/speech/service';
import { makeCall } from '/imports/ui/services/api';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { isCaptionsEnabled } from '/imports/ui/services/features';
import logger from '/imports/startup/client/logger';

const CAPTIONS_CONFIG = Meteor.settings.public.captions;
const ROLE_MODERATOR = Meteor.settings.public.user.role_moderator;
const LINE_BREAK = '\n';

const getCaptionFromLocale = (loc) => {
  const { meetingID } = Auth;
  const caption = Captions.findOne({ meetingId: meetingID, locale: loc });
  return caption;
};

/*
  dictating: Whether there is any speechDoner.userID: true in the locale
  translating: Whether there is any translationDoner.userID: true in the locale
               Even the spoken locale being captioned is treated as 'translation' although it's not actually translated
               So it can be false when dictating is true if the user dictates but offers no translation,
                 however, 'translating' practically equals 'dictating' 
                 because you cannot remove the spoken locale from the translated locale.
  ownerId: Every new caption creater takes the ownership
*/

const clearTranslation = () => {
  const { meetingID, userID } = Auth;
  const localesOnceTranslated = Captions.find({ meetingId: meetingID, ['translationDoner.'+userID]: {$exists:true} }).fetch();
  localesOnceTranslated.forEach((c) => {
    removeTranslation(c.locale);
  });
}

const removeTranslation = (loc) => {
  const { meetingID, userID } = Auth;
  const modifier = {
    $set: {
      ['translationDoner.'+userID]: false,
    },
  };

  try {
    const numberAffected = Captions.update({ meetingId: meetingID, locale: loc }, modifier);
    if (numberAffected) {
      logger.info(`Removing translationDoner ${loc} ${userID} meeting=${meetingID} in Captions`);
    }
  } catch (err) {
    logger.error(`Removing translationDoner: ${err} in Captions`);
  }

  const newcap = Captions.findOne({ meetingId: meetingID, locale: loc }, { fields: { translationDoner: 1 } });
  const td = newcap.translationDoner;
  if (!Object.values(td).includes(true)) {
    const modifier2 = {
      $set: {
        translating: false,
      },
    };
    try {
      const numberAffected = Captions.upsert({ meetingId: meetingID, locale: loc }, modifier2);
      if (numberAffected) {
        logger.info(`Updating translating ${loc} ${userID} meeting=${meetingID} in Captions`);
      }
      makeCall('disableAutoTranslation', loc);
    } catch (err) {
      logger.error(`Updating translating: ${err} in Captions`);
    }
  }
};

const selectTranslation = (loc) => {
  const { meetingID, userID } = Auth;
  const modifier = {
    $set: {
      ['translationDoner.'+userID]: true,
      translating: true,
    },
  };
  try {
    const numberAffected = Captions.upsert({ meetingId: meetingID, locale: loc }, modifier);
    if (numberAffected) {
      logger.info(`Adding translationDoner ${loc} ${userID} meeting=${meetingID}`);
    }
    makeCall('enableAutoTranslation', loc);
  } catch (err) {
    logger.error(`Adding translationDoner: ${err} in Captions`);
  }
  //console.log("selectTranslation", Captions.find({ meetingId: meetingID, translating: true }).fetch());
};

const getMyLocalesAutoTranslated = () => {
  const { meetingID, userID } = Auth;
  const localesTranslated = Captions.find(
    { meetingId: meetingID, translating: true, ['translationDoner.'+userID]: true },
    { fields: { locale: 1, name: 1 } },
  ).fetch();
  return localesTranslated;
};

const getLocalesAutoTranslated = () => {
  const { meetingID } = Auth;
  const localesTranslated = Captions.find(
    { meetingId: meetingID, translating: true },
    { fields: { locale: 1, name: 1 } },
  ).fetch();
  return localesTranslated;
};

const isAutoTranslated = (locale) => {
  const { meetingID } = Auth;
  const loc = Captions.findOne({ meetingId: meetingID, locale });
  return loc.translating;
};

const isAutoTranslationEnabled = () => {
  return CAPTIONS_CONFIG.enableAutomaticTranslation;
};

const getAvailableLocales = () => {
  const availableLocales = Captions.find(
    { meetingId: Auth.meetingID },
    { sort: { locale: 1 } },
    { fields: { locale: 1, name: 1 } },
  ).fetch();

  return availableLocales;
};

const getOwnedLocale = () => getCaptionFromLocale(getCaptionsLocale());

const updateCaptionsOwner = (locale, name) => makeCall('updateCaptionsOwner', locale, name);

const startDictation = (locale) => {
  provideSpeech(locale);
  selectTranslation(locale);
}

const stopDictation = (locale) => {
  retractSpeech(locale);
  const donatedTranslation = getMyLocalesAutoTranslated();
  donatedTranslation.forEach((loc) => {
  //console.log("stopDictation", loc, locale);
    if (loc.locale !== locale) {
      removeTranslation(loc.locale);
    }
  })
}

const getCaptionsSettings = () => {
  const settings = Session.get('captionsSettings');
  if (settings) return settings;

  const {
    background,
    font,
  } = CAPTIONS_CONFIG;

  return {
    backgroundColor: background,
    fontColor: font.color,
    fontFamily: font.family,
    fontSize: font.size,
  };
};

const setCaptionsSettings = (settings) => Session.set('captionsSettings', settings);

const getCaptionsLocale = () => Session.get('captionsLocale') || '';

const setCaptionsLocale = (locale) => Session.set('captionsLocale', locale);

const getCaptions = () => {
  const locale = getCaptionsLocale();
  if (locale) {
    const {
      name,
      speechDoner,
      dictating,
    } = Captions.findOne({
      meetingId: Auth.meetingID,
      locale,
    });

    return {
      locale,
      name,
      speechDoner,
      dictating,
    };
  }

  return {
    locale,
    name: '',
    speechDoner: {},
    dictating: false,
  };
};

const formatCaptionsText = (text) => {
  const splitText = text.split(LINE_BREAK);
  const filteredText = splitText.filter((line, index) => {
    const lastLine = index === (splitText.length - 1);
    const emptyLine = line.length === 0;

    return (!emptyLine || lastLine);
  });

  while (filteredText.length > CAPTIONS_CONFIG.lines) filteredText.shift();

  return filteredText.join(LINE_BREAK);
};

const whoDonatesTranslatedDictation = (td) => {
  //who is donating the translated dictation?
  Object.keys(td).forEach((translator) => {
    if (td[translator]) {
      //what locale the translation doner is speaking?
      const dictatedLocale = Captions.findOne({
        meetingId: Auth.meetingID,
        ['speechDoner.'+translator]: true,
      },{
        fields: { dictating: 1, locale: 1 }   
      });
      console.log("getCaptionsData:translated by", translator, "from", dictatedLocale.locale);
    }
  });
}

const getCaptionsData = () => {
  const locale = getCaptionsActive();
  if (locale) {
    const captions = Captions.findOne({
      meetingId: Auth.meetingID,
      locale,
    },{
      fields: { dictating: 1, transcript: 1, translationDoner: 1 }
    });

    let data = '';
    if (captions.dictating) {
      data = captions.transcript;
    } else {//1.somebodies are donating translated dictations -> transfer the captions.transcript
            //2.somebodies are directy writing -> pick the pad's tail
      //whoDonatesTranslatedDictation(captions.translationDoner);
      if (Object.keys(captions.translationDoner).length == 0) {
        data = PadsService.getPadTail(locale);
      } else {
        data = captions.transcript;
      }
    }

    return formatCaptionsText(data);
  }

  return '';
};

const getCaptionsActive = () => Session.get('captionsActive') || ''

const setCaptionsActive = (locale) => Session.set('captionsActive', locale);

const amISpeaker = (locale) => {
  const cap = Captions.findOne({
    meetingId: Auth.meetingID,
    locale,
  },{
    fields: { speechDoner: 1 },
  });
  //console.log("amICaptionsOwner", cap);
  return cap.speechDoner ? cap.speechDoner[Auth.userID] : false;
}

const isCaptionsAvailable = () => {
  if (isCaptionsEnabled()) {
    const ownedLocales = getLocalesAutoTranslated();

    return (ownedLocales.length > 0);
  }

  return false;
};

const isCaptionsActive = () => {
  const enabled = isCaptionsEnabled();
  const activated = getCaptionsActive() !== '';

  return (enabled && activated);
};

const deactivateCaptions = () => setCaptionsActive('');

const activateCaptions = (locale, settings) => {
  setCaptionsSettings(settings);
  setCaptionsActive(locale);
};

const amIModerator = () => {
  const user = Users.findOne(
    { userId: Auth.userID },
    { fields: { role: 1 } },
  );

  return user && user.role === ROLE_MODERATOR;
};

const getName = (locale) => {
  const captions = Captions.findOne({
    meetingId: Auth.meetingID,
    locale,
  });

  return captions.name;
};

const provideSpeech = (loc) => {
  const { meetingID, userID } = Auth;

  const modifier = {
    $set: {
      ['speechDoner.'+userID]: true,
      dictating: true,
    },
  };

  try {
    const numberAffected = Captions.update({ meetingId: meetingID, locale: loc }, modifier);
    if (numberAffected) {
      logger.info(`Adding speechDoner ${loc} ${userID} meeting=${meetingID} in Captions`);
    }
    makeCall('startDictation', loc);
  } catch (err) {
    logger.error(`Adding speechDoner: ${err} in Captions`);
  }
}

const retractSpeech = (loc) => {
  const { meetingID, userID } = Auth;

  const modifier = {
    $set: {
      ['speechDoner.'+userID]: false,
    },
  };

  try {
    const numberAffected = Captions.update({ meetingId: meetingID, locale: loc }, modifier);
    if (numberAffected) {
      logger.info(`Removing speechDoner ${loc} ${userID} meeting=${meetingID} in Captions`);
    }
  } catch (err) {
    logger.error(`Removing speechDoner: ${err} in Captions`);
  }

  const newcap = Captions.findOne({ meetingId: meetingID, locale: loc }, { fields: { speechDoner: 1 } });
  const sd = newcap.speechDoner;
  if (!Object.values(sd).includes(true)) {
    const modifier2 = {
      $set: {
        dictating: false,
      },
    };
    try {
      const numberAffected = Captions.upsert({ meetingId: meetingID, locale: loc }, modifier2);
      if (numberAffected) {
        logger.info(`Updating dicatating ${loc} ${userID} meeting=${meetingID} in Captions`);
      }
      makeCall('stopDictation', loc);
    } catch (err) {
      logger.error(`Updating dictating: ${err} in Captions`);
    }
  }
}

const createCaptions = (locale) => {
  const name = getName(locale);
  retractSpeech(locale);
  clearTranslation();
  PadsService.createGroup(locale, CAPTIONS_CONFIG.id, name);
  updateCaptionsOwner(locale, name); //every new caption creater takes the ownership
  setCaptionsLocale(locale);
};

const hasPermission = () => {
  return true;
};

const getDictationStatus = () => {
  // Can be more simple by subscribing 'dictating'.
  const userId = Auth.userID;

  if (!CAPTIONS_CONFIG.dictation) {
    return {
      locale: '',
      dictating: false,
    };
  }

  const captions = Captions.find({
    meetingId: Auth.meetingID,
    speechDoner: {$exists: true},
  }, {
    fields: {
      locale: 1,
      speechDoner: 1,
    },
  }).fetch();

  if (captions) {
    let dictatedLocale = '';
    captions.some(function(cap){
      if (cap.speechDoner[userId]){
        dictatedLocale = cap.locale;
        return true;
      }
    });

    if (dictatedLocale !== '') {
      return {
        locale: dictatedLocale,
        dictating: true,
      };
    }
  }

  return {
    locale: '',
    dictating: false,
  };
};

const canIDictateThisPad = (ownerId) => {
  if (!CAPTIONS_CONFIG.dictation) return false;

  if (ownerId !== Auth.userID) return false;

  if (!SpeechService.hasSpeechRecognitionSupport()) return false;

  return true;
};

export default {
  ID: CAPTIONS_CONFIG.id,
  getAvailableLocales,
  getOwnedLocale,
  updateCaptionsOwner,
  startDictation,
  stopDictation,
  getCaptionsSettings,
  getCaptionsData,
  getCaptions,
  hasPermission,
  amISpeaker,
  isCaptionsEnabled,
  isCaptionsAvailable,
  isCaptionsActive,
  deactivateCaptions,
  activateCaptions,
  formatCaptionsText,
  amIModerator,
  createCaptions,
  getCaptionsLocale,
  setCaptionsLocale,
  getDictationStatus,
  canIDictateThisPad,
  isAutoTranslated,
  isAutoTranslationEnabled,
  getLocalesAutoTranslated,
  selectTranslation,
  removeTranslation,
  clearTranslation,
  getCaptionsActive,
  setCaptionsActive,
};
