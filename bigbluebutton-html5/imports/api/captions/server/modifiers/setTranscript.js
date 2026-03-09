import { check } from 'meteor/check';
import Captions from '/imports/api/captions';
import Logger from '/imports/startup/server/logger';

export default function setTranscript(meetingId, locale, transcript, whosText) {
  try {
    check(meetingId, String);
    check(locale, String);
    check(transcript, String);
    check(whosText, String);

    const selector = {
      meetingId,
      locale,
    };

    const modifier = {
      $set: {
        transcript,
        whosText,
      },
    };

    const numberAffected = Captions.upsert(selector, modifier);

    if (numberAffected) {
      Logger.debug(`Set captions=${locale} transcript=${transcript} meeting=${meetingId}`);
    } else {
      Logger.debug(`Upserted captions=${locale} transcript=${transcript} meeting=${meetingId}`);
    }
  } catch (err) {
    Logger.error(`Setting captions transcript to the collection: ${err}`);
  }
}
