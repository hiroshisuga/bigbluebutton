import { check } from 'meteor/check';
import { extractCredentials } from '/imports/api/common/server/helpers';
import Logger from '/imports/startup/server/logger';
import setAutoTranslation from '/imports/api/captions/server/modifiers/setAutoTranslation';

export default function removeTranslation(locale) {
  try {
    const { meetingId, requesterUserId } = extractCredentials(this.userId);

    check(locale, String);
    check(meetingId, String);
    check(requesterUserId, String);

    //const caption = Captions.findOne({ meetingId, locale }, { fields: { translating:1 } });
    setAutoTranslation(meetingId, locale, requesterUserId, false);
  } catch (err) {
    Logger.error(`Exception while invoking method disbleAutoTranslation ${err.stack}`);
  }
}
