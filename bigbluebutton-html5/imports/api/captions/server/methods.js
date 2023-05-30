import { Meteor } from 'meteor/meteor';
import updateCaptionsOwner from '/imports/api/captions/server/methods/updateCaptionsOwner';
import startDictation from '/imports/api/captions/server/methods/startDictation';
import stopDictation from '/imports/api/captions/server/methods/stopDictation';
import pushSpeechTranscript from '/imports/api/captions/server/methods/pushSpeechTranscript';
import enableAutoTranslation from '/imports/api/captions/server/methods/enableAutoTranslation';
import disableAutoTranslation from '/imports/api/captions/server/methods/disableAutoTranslation';

Meteor.methods({
  updateCaptionsOwner,
  startDictation,
  stopDictation,
  pushSpeechTranscript,
  enableAutoTranslation,
  disableAutoTranslation,
});
