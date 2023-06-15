import { check } from 'meteor/check';
import Captions from '/imports/api/captions';
import Users from '/imports/api/users';
import { extractCredentials } from '/imports/api/common/server/helpers';
import Logger from '/imports/startup/server/logger';
import setTranscript from '/imports/api/captions/server/modifiers/setTranscript';
import updatePad from '/imports/api/pads/server/methods/updatePad';
import axios from 'axios';

const CAPTIONS_CONFIG = Meteor.settings.public.captions;

function sendTranscript(meetingId, requesterUserId, type, dst, text) {
  const user = Users.findOne({meetingId, userId: requesterUserId}, { fields: {name: 1}});
  //console.log("sendTranscript", text);
  //const textWithName = `${user.name}: ${text}`;
  if (type === 'final') {
    //const textLf = `\n${textWithName}`;
    const textLf = `\n${text}`;
    updatePad(meetingId, requesterUserId, dst, textLf); // Pad and recording
  }
  //setTranscript(meetingId, dst, textWithName); // Live
  setTranscript(meetingId, dst, text); // Live
}

function translateText(meetingId, requesterUserId, textOri, type, src, dst) {
  if ( !CAPTIONS_CONFIG.enableAutomaticTranslation || textOri === "" || !dst || dst === "" || dst === src || dst.replace(/-..$/,'') === src || dst === src.replace(/-..$/,'') ) {
    sendTranscript(meetingId, requesterUserId, type, dst, textOri);
  } else {
    let url = '';
    if (CAPTIONS_CONFIG.googleTranslateUrl) {
      url = CAPTIONS_CONFIG.googleTranslateUrl + '/exec?' +
            'text=' + encodeURIComponent(textOri) + '&source=' + src + '&target=' + dst;
    } else if (CAPTIONS_CONFIG.deeplTranslateUrl) {
      url = CAPTIONS_CONFIG.deeplTranslateUrl +
            '&text=' + encodeURIComponent(textOri) + '&source_lang=' + src.replace(/-..$/,'').toUpperCase() +
            '&target_lang=' + dst.toUpperCase();
    } else {
      Logger.error('Could not get a translation service.');
      return;
    }

    axios({
      method: 'get',
      url,
      responseType: 'json',
    }).then((response) => {
      if (CAPTIONS_CONFIG.googleTranslateUrl) {
        const { code, text } = response.data;
        if (code === 200) {
          sendTranscript(meetingId, requesterUserId, type, dst, text);
        } else {
          Logger.error(`Failed to get Google translation for ${textOri}`);
        }
      } else if (CAPTIONS_CONFIG.deeplTranslateUrl) {
        const { translations } = response.data;
        if (translations.length > 0 && translations[0].text) {
          sendTranscript(meetingId, requesterUserId, type, dst, translations[0].text);
        } else {
          Logger.error(`Failed to get DeepL translation for ${textOri}`);
        }
      }
    }).catch((error) => Logger.error(`Could not get translation for ${textOri.trim()} on the locale ${dst}: ${error}`));
  }
}

export default function pushSpeechTranscript(locale, transcript, type, locales) {
  try {
    const { meetingId, requesterUserId } = extractCredentials(this.userId);

    check(meetingId, String);
    check(requesterUserId, String);
    check(locale, String);
    check(transcript, String);
    check(type, String);
    check(locales, Array);

    locales.forEach(function(dstLocale, index) {
      const caption = Captions.findOne({
        meetingId,
        locale: dstLocale,
      });

      if (!caption) {
        Logger.error(`Could not find the caption's pad for meetingId=${meetingId} locale=${locale}`);
      } else {
        if (type === 'final' || ( type === 'interim' && locale === dstLocale ) ) {
          Logger.debug(`Transcription being translated from ${locale} into ${dstLocale}`);
          translateText(meetingId, requesterUserId, transcript, type, locale, dstLocale);
        }
      }
    });
  } catch (err) {
    Logger.error(`Exception while invoking method pushSpeechTranscript ${err.stack}`);
  }
}
