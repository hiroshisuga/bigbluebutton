import { check } from 'meteor/check';
import RedisPubSub from '/imports/startup/server/redis';
import { extractCredentials } from '/imports/api/common/server/helpers';
import Logger from '/imports/startup/server/logger';
import axios from 'axios';
import Users from '/imports/api/users';
import Meetings from '/imports/api/meetings';

const CAPTIONS_CONFIG = Meteor.settings.public.captions;

function updateDbAndPublish(channel, eventName, meetingId, userId, payload, translatedTranscript, translatedText, newDbEntry) {
  const selector = { meetingId };
  const dbname = newDbEntry.srcLocale + '-' + newDbEntry.dstLocale;
  const modifier = {
    $set: {
      //[`translationDb.${newDbEntry[2]}.${newDbEntry[0]}`]: newDbEntry[1], // this works as well
      //['translationDb.'+newDbEntry[2]+'.'+newDbEntry[0]]: newDbEntry[1],
      ['translationDb.'+dbname+'.'+newDbEntry.origText]: newDbEntry.translatedText,
    },
  };

  try {
    const numberAffected = Meetings.update(selector, modifier);
    if (numberAffected) {
      Logger.info(`Assigned meeting translationDb ${newDbEntry} meeting=${meetingId}`);
    }
  } catch (err) {
    Logger.error(`Assigning meeting translationDb: ${err}`);
  }

  const newPayload = Object.assign({}, payload, {transcript: translatedTranscript, text: translatedText, locale: newDbEntry.dstLocale});
  RedisPubSub.publishUserMessage(channel, eventName, meetingId, userId, newPayload);
}

function translateText (meetingId, userId, payload, dst) {
  const REDIS_CONFIG = Meteor.settings.private.redis;
  const CHANNEL = REDIS_CONFIG.channels.toAkkaApps;
  const EVENT_NAME = 'UpdateTranscriptPubMsg';

  const { locale: src, transcript: transcriptOri, text: textOri } = payload;

  if ( !CAPTIONS_CONFIG.enableAutomaticTranslation || transcriptOri === "" || !dst || dst === "" || dst === src || dst.replace(/-..$/,'') === src || dst === src.replace(/-..$/,'') ) {
      const newPayload = Object.assign({}, payload, {locale: dst});
      RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, userId, newPayload);
  } else {
    const { translationDb : transDb = {} } = Meetings.findOne({ meetingId }, { fields: { translationDb: 1 }});
    const { [src+'-'+dst]: tDb = {} } = transDb;
    const transcriptOriNoBlank = transcriptOri.replace(/^\s*/, '');
    const transcriptOriHeader = (transcriptOri === transcriptOriNoBlank ? '' : ' ');

    if (tDb[transcriptOriNoBlank]) {
      // The 'text' item, which seems kept for backward compatibility, is not always the same as 'transcript';
      // It can be either a blank string, same string as 'transcript', or trancated 'transcript'
      // To reduce the  access to translation servers, it is simplified: same as 'transcript' or a blank.
      const newText = textOri.match(/\S/g) ? tDb[transcriptOriNoBlank] : '';
      const newPayload = Object.assign({}, payload, {transcript: transcriptOriHeader + tDb[transcriptOriNoBlank], text: transcriptOriHeader + newText, locale: dst});
      RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, userId, newPayload);
    } else {
      let url = '';
      if (CAPTIONS_CONFIG.googleTranslateUrl) {
        url = CAPTIONS_CONFIG.googleTranslateUrl + '/exec?' +
              'text=' + encodeURIComponent(transcriptOriNoBlank) + '&source=' + src + '&target=' + dst;
      } else if (CAPTIONS_CONFIG.deeplTranslateUrl) {
        url = CAPTIONS_CONFIG.deeplTranslateUrl +
              '&text=' + encodeURIComponent(transcriptOriNoBlank) + '&source_lang=' + src.replace(/-..$/,'').toUpperCase() +
              '&target_lang=' + dst.replace(/-..$/,'').toUpperCase();
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
            const newTranscript = transcriptOriHeader + text;
            const newText = textOri.match(/\S/g) ? newTranscript : '';
            updateDbAndPublish(CHANNEL, EVENT_NAME, meetingId, userId, payload, newTranscript, newText, { origText: transcriptOriNoBlank, translatedText: text, srcLocale: src, dstLocale: dst });
          } else {
            Logger.error(`Failed to get Google translation for "${transcriptOri}"`);
          }
        } else if (CAPTIONS_CONFIG.deeplTranslateUrl) {
          const { translations } = response.data;
          if (translations.length > 0 && translations[0].text) {
            const newTranscript = transcriptOriHeader + translations[0].text;
            const newText = textOri.match(/\S/g) ? newTranscript : '';
            updateDbAndPublish(CHANNEL, EVENT_NAME, meetingId, userId, payload, newTranscript, newText, { origText: transcriptOriNoBlank, translatedText: translations[0].text, srcLocale: src, dstLocale: dst });
          } else {
            Logger.error(`Failed to get DeepL translation for "${transcriptOri}"`);
          }
        }
      }).catch((error) => Logger.error(`Could not get translation for ${transcriptOri.trim()} on the locale ${dst}: ${error}`));
    }
  }
}

export default function updateTranscript(transcriptId, start, end, text, transcript, locale) {
  try {
    const { meetingId, requesterUserId } = extractCredentials(this.userId);

    check(meetingId, String);
    check(requesterUserId, String);
    check(transcriptId, String);
    check(start, Number);
    check(end, Number);
    check(text, String);
    check(transcript, String);
    check(locale, String);

    // Ignore irrelevant updates
    if (start !== -1 && end !== -1) {
      const payload = {
        transcriptId,
        start,
        end,
        text,
        transcript,
        locale,
      };

      const selector = {
        meetingId,
        userId: requesterUserId,
      };

      const fields = {
        fields: {
          translationLocale: 1,
        },
      };

      const { translationLocale: dstLocale } = Users.findOne(selector, fields);

      translateText(meetingId, requesterUserId, payload, dstLocale);
    }
  } catch (err) {
    Logger.error(`Exception while invoking method upadteTranscript ${err.stack}`);
  }
}
