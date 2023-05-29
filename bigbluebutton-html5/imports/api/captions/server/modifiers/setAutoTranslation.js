//Do we need this? It just sets "translating" -> seems yes
import Captions from '/imports/api/captions';
import Logger from '/imports/startup/server/logger';
import { check } from 'meteor/check';

export default function setAutoTranslation(meetingId, locale, translating) {
  check(meetingId, String);
  check(locale, String);
  check(translating, Boolean);

  const selector = {
    meetingId,
    locale,
  };

  const modifier = {
    $set: {
      translating,
    }
  };

  try {
    const numberAffected = Captions.update(selector, modifier);

    if (numberAffected) {
      Logger.verbose('Captions: updated pad autoTranslation', { locale });
    }
  } catch (err) {
    Logger.error(`Updating captions pad autoTranslation: ${err}`);
  }
}
