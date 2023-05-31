import { Meteor } from 'meteor/meteor';
import updateCaptionsOwner from '/imports/api/captions/server/methods/updateCaptionsOwner';
import provideSpeech from '/imports/api/captions/server/methods/provideSpeech';
import retractSpeech from '/imports/api/captions/server/methods/retractSpeech';
import pushSpeechTranscript from '/imports/api/captions/server/methods/pushSpeechTranscript';
import addTranslation from '/imports/api/captions/server/methods/addTranslation';
import removeTranslation from '/imports/api/captions/server/methods/removeTranslation';

Meteor.methods({
  updateCaptionsOwner,
  provideSpeech,
  retractSpeech,
  pushSpeechTranscript,
  addTranslation,
  removeTranslation,
});
