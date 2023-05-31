//Do we need this? It just sets "translating" -> seems yes
import Captions from '/imports/api/captions';
import Logger from '/imports/startup/server/logger';
import { check } from 'meteor/check';

export default function setAutoTranslation(meetingId, locale, userId, selecting) {
  check(meetingId, String);
  check(locale, String);
  check(userId, String);
  check(selecting, Boolean);

  const selector = {
    meetingId,
    locale,
  };

  let modifier;
  if (selecting) {
    modifier = {
      $set: {
        ['translationDoner.'+userId]: true,
        translating: true,
      }
    };
  } else {
    modifier = {
      $set: {
        ['translationDoner.'+userId]: false,
      }
    };
  }

  try {
    Logger.info(`Adding/Removing (${selecting}) translationDoner ${locale} from ${userId} meeting=${meetingId}`);

    if (numberAffected) {
      Logger.verbose('Captions: updated pad autoTranslation', { locale });
    }
  } catch (err) {
    Logger.error(`Updating captions pad autoTranslation: ${err}`);
  }

  if (!selecting) {
    const newcap = Captions.findOne({ meetingId, locale }, { fields: { translationDoner: 1 } });
    const td = newcap.translationDoner;
    if (!Object.values(td).includes(true)) {
      const modifier2 = {
        $set: {
          translating: false,
        },
      };
      try {
        const numberAffected = Captions.upsert({ meetingId, locale }, modifier2);
        if (numberAffected) {
          Logger.info(`Updating translating to false; ${locale}, meeting=${meetingId} in Captions`);
        }
      } catch (err) {
        Logger.error(`Updating translating: ${err} in Captions`);
      }
    }
  }
}
