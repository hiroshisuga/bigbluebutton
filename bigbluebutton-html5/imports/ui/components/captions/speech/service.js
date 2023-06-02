import _ from 'lodash';
import { makeCall } from '/imports/ui/services/api';
import Service from '/imports/ui/components/captions/service';

const DEFAULT_LANGUAGE = 'en-US';
const THROTTLE_TIMEOUT = 2000;

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const hasSpeechRecognitionSupport = () => typeof SpeechRecognitionAPI !== 'undefined';

const initSpeechRecognition = (locale = DEFAULT_LANGUAGE) => {
  if (hasSpeechRecognitionSupport()) {
    const speechRecognition = new SpeechRecognitionAPI();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = locale;

    return speechRecognition;
  }

  return null;
};

const pushSpeechTranscript = (locale, transcript, type, locales) => {
  if (locale) {
    makeCall('pushSpeechTranscript', locale, transcript, type, locales);
  }
}

const throttledTranscriptPush = _.throttle(pushSpeechTranscript, THROTTLE_TIMEOUT, {
  leading: false,
  trailing: true,
});

const pushInterimTranscript = (locale, transcript) => { 
  const localesAutoTranslated = Service.getMyLocalesAutoTranslated();
  let locales = [locale];
  for (let localeTrans of localesAutoTranslated) {
    if (localeTrans.locale != locale) {
      locales.push(localeTrans.locale);
    }
  }
  throttledTranscriptPush(locale, transcript, 'interim', locales);
}

const pushFinalTranscript = (locale, transcript) => {
  const localesAutoTranslated = Service.getMyLocalesAutoTranslated();

  let locales = [locale];
  for (let localeTrans of localesAutoTranslated) {
    if (localeTrans.locale != locale) {
      locales.push(localeTrans.locale);
    }
  }
  //console.log("pushFinalTranscript", locale, locales);
  throttledTranscriptPush.cancel();
  pushSpeechTranscript(locale, transcript, 'final', locales);
};

export default {
  hasSpeechRecognitionSupport,
  initSpeechRecognition,
  pushInterimTranscript,
  pushFinalTranscript,
};
