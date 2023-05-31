import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl } from 'react-intl';
import { notify } from '/imports/ui/services/notification';
import logger from '/imports/startup/client/logger';
import CaptionsService from '/imports/ui/components/captions/service';
import Service from './service';

const intlMessages = defineMessages({
  start: {
    id: 'app.captions.speech.start',
    description: 'Notification on speech recognition start',
  },
  stop: {
    id: 'app.captions.speech.stop',
    description: 'Notification on speech recognition stop',
  },
  incompatible: {
    id: 'app.captions.speech.incompatible',
    description: 'Notification on browser incompatibility',
  },
  error: {
    id: 'app.captions.speech.error',
    description: 'Notification on speech recognition error',
  },
});

class Speech extends PureComponent {
  constructor(props) {
    super(props);

    this.timer = Date.now();
    this.counterDictationStop = 0;
    this.dictationDemanded = false;

    this.onStart = this.onStart.bind(this);
    this.onStop = this.onStop.bind(this);
    this.onError = this.onError.bind(this);
    this.onEnd = this.onEnd.bind(this);
    this.onResult = this.onResult.bind(this);

    this.result = {
      transcript: '',
      isFinal: true,
    };

    this.speechRecognition = Service.initSpeechRecognition();

    if (this.speechRecognition) {
      this.speechRecognition.onstart = (event) => this.onStart(event);;
      this.speechRecognition.onend = (event) => this.onEnd(event);
      this.speechRecognition.onerror = (event) => this.onError(event);
      this.speechRecognition.onresult = (event) => this.onResult(event);
    }
  }

  componentDidUpdate(prevProps) {
    const {
      locale,
      dictating,
    } = this.props;

    // Start dictating
    if (!prevProps.dictating && dictating) {
      if (this.speechRecognition) {
        this.speechRecognition.lang = locale;
        try {
          this.speechRecognition.start();
        } catch (event) {
          this.onError(event.error);
        }
      }
    }

    // Stop dictating
    if (prevProps.dictating && !dictating) {
      this.onStop();
    }
  }

  componentDidMount() {
    const {
      locale,
    } = this.props;

    if (this.props.dictating && !this.dictationDemanded) {
      CaptionsService.stopDictation(locale);
    }
  }

  componentWillUnmount() {
    this.onStop();
  }

  onStart(ev) {
    const {
      intl,
      //locale,
      //dictating,
    } = this.props;

    // show notifycation only when the user starts the dictation, but not when dictation restarts
    if (!this.dictationDemanded) {
      notify(intl.formatMessage(intlMessages.start), 'info', 'closed_caption');
      this.dictationDemanded = true;
    }
  }

  onEnd(ev) {
    const {
      intl,
      locale,
      dictating,
    } = this.props;


    if (this.dictationDemanded) {
          if (Date.now() - this.timer < 1000) {
            this.counterDictationStop += 1;
          } else {
            this.counterDictationStop = 0;
          }
          this.timer = Date.now();
          if (this.counterDictationStop < 5) {
            try {
              this.speechRecognition.start();
            } catch (e) {
              this.counterDictationStop = 0;
              this.dictationDemanded = false;
              this.onEnd();
              logger.error({
                logCode: 'captions_recognition',
                extraInfo: { error: e.error },
              }, 'Captions pad error when restarting the recognition');
            }
          } else {
            notify(intl.formatMessage(intlMessages.incompatible), 'info', 'warning');
            this.counterDictationStop = 0;
            this.dictationDemanded = false;
            this.onEnd();
            CaptionsService.stopDictation(locale);
          }
    } else {
      notify(intl.formatMessage(intlMessages.stop), 'info', 'closed_caption');
    }
  }

  onError(error) {
    this.onStop();

    const {
      intl,
      locale,
    } = this.props;

    if (!this.dictationDemanded){
      notify(intl.formatMessage(intlMessages.error), 'error', 'warning');
      CaptionsService.stopDictation(locale);
    }
    logger.error({
      logCode: 'captions_speech_recognition',
      extraInfo: { error },
    }, 'Captions speech recognition error');
  }

  onStop() {
    const { locale, dictating } = this.props;

    if (this.speechRecognition) {
      const {
        isFinal,
        transcript,
      } = this.result;

      // when onError happens, onStop is called.
      // But this.dictationDemanded should be false as 'dictating' remains true
      //   until this.speechRecognition.stop() is called.
      if (!dictating) {
        this.dictationDemanded = false;
      }
      
      let finalTranscript = "";
      if (!isFinal) {
        finalTranscript = transcript;
        this.speechRecognition.abort();
      } else {
        Service.pushFinalTranscript(locale, finalTranscript);
        this.speechRecognition.stop();
      }
    }
  }

  onResult(event) {
    const { locale } = this.props;

    const {
      resultIndex,
      results,
    } = event;

    const { transcript } = results[resultIndex][0];
    const { isFinal } = results[resultIndex];

    this.result.transcript = transcript;
    this.result.isFinal = isFinal;

    if (transcript !== "") {
      if (isFinal) {
        Service.pushFinalTranscript(locale, transcript);
      } else {
        Service.pushInterimTranscript(locale, transcript);
      }
    }
  }

  render() {
    return null;
  }
}

Speech.propTypes = {
  locale: PropTypes.string.isRequired,
  dictating: PropTypes.bool.isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
};

export default injectIntl(Speech);
