import Logger from '/imports/startup/server/logger';
import Users from '/imports/api/users';

export default function updateTranslationLocale(meetingId, userId, locale) {
  const selector = {
    meetingId,
    userId,
  };

  const modifier = {
    $set: {
      translationLocale: locale,
    },
  };

  try {
    const numberAffected = Users.update(selector, modifier);

    if (numberAffected) {
      Logger.info(`Updated translation locale=${locale} userId=${userId} meetingId=${meetingId}`);
    }
  } catch (err) {
    Logger.error(`Updating translation locale: ${err}`);
  }
}
