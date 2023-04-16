import { check } from 'meteor/check';
import RedisPubSub from '/imports/startup/server/redis';
import { extractCredentials } from '/imports/api/common/server/helpers';
import Logger from '/imports/startup/server/logger';
import axios from 'axios';
import Users from '/imports/api/users';

const CAPTIONS_CONFIG = Meteor.settings.public.captions;

function translateText (meetingId, userId, payload, dst) {
  const REDIS_CONFIG = Meteor.settings.private.redis;
  const CHANNEL = REDIS_CONFIG.channels.toAkkaApps;
  const EVENT_NAME = 'UpdateTranscriptPubMsg';

  const { locale: src, transcript: textOri } = payload;

  if ( !CAPTIONS_CONFIG.enableAutomaticTranslation || textOri === "" || !dst || dst === "" || dst === src || dst.replace(/-.*$/,'') === src || dst === src.replace(/-.*$/,'') ) {
      RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, userId, payload);
  } else {
    let url = '';
    if (CAPTIONS_CONFIG.googleTranslateUrl) {
      url = CAPTIONS_CONFIG.googleTranslateUrl + '/exec?' +
            'text=' + encodeURIComponent(textOri) + '&source=' + src + '&target=' + dst;
    } else if (CAPTIONS_CONFIG.deeplTranslateUrl) {
      url = CAPTIONS_CONFIG.deeplTranslateUrl +
            '&text=' + encodeURIComponent(textOri) + '&source_lang=' + src.replace(/-.*$/,'').toUpperCase() +
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
          const newPayload = Object.assign({}, payload, {transcript: text});
          RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, userId, newPayload);
        } else {
          Logger.error(`Failed to get Google translation for "${textOri}"`);
        }
      } else if (CAPTIONS_CONFIG.deeplTranslateUrl) {
        const { translations } = response.data;
        if (translations.length > 0 && translations[0].text) {
          //sendToPad(padId, translations[0].text);
          const newPayload = Object.assign({}, payload, {transcript: translations[0].text});
          RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, userId, newPayload);
        } else {
          Logger.error(`Failed to get DeepL translation for "${textOri}"`);
        }
      }
    }).catch((error) => Logger.error(`Could not get translation for ${textOri.trim()} on the locale ${dst}: ${error}`));
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
          prevTextOri: 1,
        },
      };

      const { translationLocale: dstLocale, prevTextOri = '' } = Users.findOne(selector, fields);
      
      if (payload.transcript != prevTextOri) {
        const modifier = {
          $set: {
            prevTextOri: payload.transcript,
          },
        };

        try {
          const numberAffected = Users.update(selector, modifier);
          if (numberAffected) {
            Logger.info(`Assigned user prevTextOri ${prevTextOri} id=${requesterUserId} meeting=${meetingId}`);
          }
        } catch (err) {
          Logger.error(`Assigning user prevTextOri: ${err}`);
        }
        translateText(meetingId, requesterUserId, payload, dstLocale);
      } else {
        Logger.info(`Text ignored for caption: ${payload.transcript}`);
      }
    }
  } catch (err) {
    Logger.error(`Exception while invoking method upadteTranscript ${err.stack}`);
  }
}
