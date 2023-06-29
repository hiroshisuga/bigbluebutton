import { check } from 'meteor/check';
import Captions from '/imports/api/captions';
import Logger from '/imports/startup/server/logger';

export default function setDictation(meetingId, locale, userId, providing) {
  try {
    check(meetingId, String);
    check(locale, String);
    check(userId, String);
    check(providing, Boolean);

    const selector = {
      meetingId,
      locale,
    };

    let modifier;
    if (providing) {
      modifier = {
        $set: {
          ['speechDoner.'+userId]: true,
          dictating: true,
        },
      };
    } else {
      modifier = {
        $set: {
          ['speechDoner.'+userId]: false,
        },
      };
    }

    const numberAffected = Captions.upsert(selector, modifier);

    if (numberAffected) {
      Logger.info(`Set captions=${locale} provide?=${providing} meeting=${meetingId}, userId=${userId}`);
    } else {
      Logger.info(`Upserted captions=${locale} provide?=${providing} meeting=${meetingId}, userId=${userId}`);
    }

    if (!providing) {
      const newcap = Captions.findOne({ meetingId, locale }, { fields: { speechDoner: 1 } });
      const sd = newcap.speechDoner;
      if (!Object.values(sd).includes(true)) {
        const modifier2 = {
          $set: {
            dictating: false,
          },
        };
        const numberAffected = Captions.upsert({ meetingId, locale }, modifier2);
        if (numberAffected) {
          Logger.info(`Updating dicatating to false; ${locale}, meeting=${meetingId} in Captions`);
        }
      }
    }
  } catch (err) {
    Logger.error(`Setting captions dictation to the collection: ${err}`);
  }
}
