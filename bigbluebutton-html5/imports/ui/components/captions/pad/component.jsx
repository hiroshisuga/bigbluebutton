import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl } from 'react-intl';
import injectWbResizeEvent from '/imports/ui/components/presentation/resize-wrapper/component';
import Button from '/imports/ui/components/button/component';
import logger from '/imports/startup/client/logger';
import PadService from './service';
import CaptionsService from '/imports/ui/components/captions/service';
import { notify } from '/imports/ui/services/notification';
import { styles } from './styles';
import { PANELS, ACTIONS } from '../../layout/enums';
import _ from 'lodash';

const intlMessages = defineMessages({
  hide: {
    id: 'app.captions.pad.hide',
    description: 'Label for hiding closed captions pad',
  },
  tip: {
    id: 'app.captions.pad.tip',
    description: 'Label for tip on how to escape closed captions iframe',
  },
  takeOwnership: {
    id: 'app.captions.pad.ownership',
    description: 'Label for taking ownership of closed captions pad',
  },
  takeOwnershipTooltip: {
    id: 'app.captions.pad.ownershipTooltip',
    description: 'Text for button for taking ownership of closed captions pad',
  },
  interimResult: {
    id: 'app.captions.pad.interimResult',
    description: 'Title for speech recognition interim results',
  },
  dictationStart: {
    id: 'app.captions.pad.dictationStart',
    description: 'Label for starting speech recognition',
  },
  dictationStop: {
    id: 'app.captions.pad.dictationStop',
    description: 'Label for stoping speech recognition',
  },
  dictationOnDesc: {
    id: 'app.captions.pad.dictationOnDesc',
    description: 'Aria description for button that turns on speech recognition',
  },
  dictationOffDesc: {
    id: 'app.captions.pad.dictationOffDesc',
    description: 'Aria description for button that turns off speech recognition',
  },
  speechRecognitionStop: {
    id: 'app.captions.pad.speechRecognitionStop',
    description: 'Notification for stopped speech recognition',
  },
});

const propTypes = {
  locale: PropTypes.string.isRequired,
  ownerId: PropTypes.string.isRequired,
  currentUserId: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
};

const DEBOUNCE_TIMEOUT = 500;
const DEBOUNCE_OPTIONS = {
  leading: true,
  trailing: false,
};

const TIME_TO_EMIT_INTERIM = 3000;
const TIME_TO_STOP_INTERIM = 500;

class Pad extends PureComponent {
  static getDerivedStateFromProps(nextProps) {
    if (nextProps.ownerId !== nextProps.currentUserId) {
      return ({ listening: false });
    }
    return null;
  }

  constructor(props) {
    super(props);

    this.state = {
      listening: false,
      url: null,
    };

    const { locale, intl } = props;
    this.recognition = CaptionsService.initSpeechRecognition(locale);

    this.toggleListen = _.debounce(this.toggleListen.bind(this), DEBOUNCE_TIMEOUT, DEBOUNCE_OPTIONS);
    this.handleListen = this.handleListen.bind(this);

    if (this.recognition) {
      this.recognition.addEventListener('end', () => {
        const { listening } = this.state;
        if (listening) {
          notify(intl.formatMessage(intlMessages.speechRecognitionStop), 'info', 'warning');
          this.stopListen();
        }
      });
    }
    this.timeInt = Date.now();
    this.timePrevInt = Date.now();
    this.prevInterim = '';
    this.subsText = this.subsText.bind(this);
    this.initialized = true;
  }

  componentDidMount() {
    const { locale } = this.props;

    this.updatePadURL(locale);
  }

  componentDidUpdate(prevProps) {
    const {
      locale,
      ownerId,
      currentUserId,
    } = this.props;

    const { listening } = this.state;

    if (this.recognition) {
      if (ownerId !== currentUserId) {
        this.recognition.stop();
      } else if (listening && this.recognition.lang !== locale) {
        this.recognition.stop();
        this.stopListen();
      }
      this.recognition.lang = locale;
    }

    if (prevProps.ownerId !== ownerId || prevProps.locale !== locale) {
      this.updatePadURL(locale);
    }
  }

  updatePadURL(locale) {
    PadService.getPadId(locale).then(response => {
      this.setState({ url: PadService.buildPadURL(response) });
    });
  }
  
  subsText(textNew, textOld){
    console.log("subsText Old", textOld);
    console.log("subsText New", textNew);
    let subText = "";
    for (let i = 0; i < textOld.length; i += 1) {
      if (textOld.charAt(i) != textNew.charAt(i)) {
        //console.log("subsText i  ", i);
        subText = textNew.substr(i);
        break;
      }
    }
    if (subText == "") {
      subText = textNew.substr(textOld.length);
    }
    console.log("subsText Sub", subText);
    console.log("");
    return subText;
  }

  handleListen() {
    const {
      locale,
    } = this.props;

    const {
      listening,
    } = this.state;

    if (this.recognition) {
      // Starts and stops the recognition when listening.
      // Throws an error if start() is called on a recognition that has already been started.
      if (listening) {
        try {
          this.recognition.start();
        } catch (e) {
          logger.error({
            logCode: 'captions_recognition',
            extraInfo: { error: e.error },
          }, 'Captions pad error when starting the recognition');
        }
      } else {
        this.recognition.stop();
      }

      // Stores the voice recognition results that have been verified.
      let finalTranscript = '';

      this.recognition.onresult = (event) => {
        const {
          resultIndex,
          results,
        } = event;

        // Stores the first guess at what was recognised (Not always accurate).
        let interimTranscript = '';

        // Loops through the results to check if any of the entries have been validated,
        // signaled by the isFinal flag.
        for (let i = resultIndex; i < results.length; i += 1) {
          const { transcript } = event.results[i][0];
          if (results[i].isFinal) {
            finalTranscript += `${transcript} `;
            //console.log('FINAL   ' + i +' ' + transcript);
          } else {
            interimTranscript += transcript;
            //console.log('interim ' + i +' ' + transcript);
            intervalInterim = Date.now() - this.timePrevInt;
            this.timePrevInt = Date.now();
          }
        }

        // Adds the interimTranscript text to the iterimResultContainer to show
        // what's being said while speaking.
        if (this.iterimResultContainer) {
          this.iterimResultContainer.innerHTML = interimTranscript;
        }

        if (this.initialized && (interimTranscript !== '' && this.prevInterim == '')) {
        //if (this.initializable && interimTranscript.length < this.prevInterim.length) {
          this.timeInt = Date.now();
          this.initialized = false;
        }

        //const newEntry = finalTranscript !== '';
        //const newEntry = interimTranscript !== '' || finalTranscript !== '';
        let newEntry = false;
        //const newEntry = finalTranscript !== '' || (interimTranscript !== '' && Date.now() - this.timeInt > TIME_TO_EMIT_INTERIM && interimTranscript != this.prevInterim);
        if (finalTranscript !== '') {
          newEntry = true;
        } else if (interimTranscript !== '') {
          console.log ("IntInterval", intervalInterim) ;
          if (Date.now() - this.timeInt > TIME_TO_EMIT_INTERIM && interimTranscript != this.prevInterim && intervalInterim > TIME_TO_STOP_INTERIM) {
            newEntry = true;
          }
        }

        // Changes to the finalTranscript are shown to in the captions
        if (newEntry) {
          let updateText = ''
          if (finalTranscript !== '') {
            updateText = this.subsText(finalTranscript, this.prevInterim);
            this.prevInterim = '';
            this.initialized = true;
          } else {
            updateText = this.subsText(interimTranscript, this.prevInterim);
            this.prevInterim = interimTranscript;
            this.timeInt = Date.now();
          }

          //if (updateText !== '') { // can be the case when the interval between interim text updates is too short
            const text = updateText.trimRight();
            CaptionsService.appendText(text, locale);
            finalTranscript = '';
          //}
        }
      };

      this.recognition.onerror = (event) => {
        logger.error({
          logCode: 'captions_recognition',
          extraInfo: { error: event.error },
        }, 'Captions pad error on recognition');
      };
    }
  }

  toggleListen() {
    const {
      listening,
    } = this.state;

    this.setState({
      listening: !listening,
    }, this.handleListen);
  }

  stopListen() {
    this.setState({ listening: false });
  }

  render() {
    const {
      locale,
      intl,
      ownerId,
      name,
      layoutContextDispatch,
      isResizing,
    } = this.props;

    const {
      listening,
      url,
    } = this.state;

    return (
      <div className={styles.pad}>
        <header className={styles.header}>
          <div className={styles.title}>
            <Button
              onClick={() => {
                layoutContextDispatch({
                  type: ACTIONS.SET_SIDEBAR_CONTENT_IS_OPEN,
                  value: false,
                });
                layoutContextDispatch({
                  type: ACTIONS.SET_SIDEBAR_CONTENT_PANEL,
                  value: PANELS.NONE,
                });
              }}
              aria-label={intl.formatMessage(intlMessages.hide)}
              label={name}
              icon="left_arrow"
              className={styles.hideBtn}
            />
          </div>
          {CaptionsService.canIDictateThisPad(ownerId)
            ? (
              <span>
                <Button
                  onClick={() => { this.toggleListen(); }}
                  label={listening
                    ? intl.formatMessage(intlMessages.dictationStop)
                    : intl.formatMessage(intlMessages.dictationStart)}
                  aria-describedby="dictationBtnDesc"
                  color="primary"
                  disabled={!this.recognition}
                />
                <div id="dictationBtnDesc" hidden>
                  {listening
                    ? intl.formatMessage(intlMessages.dictationOffDesc)
                    : intl.formatMessage(intlMessages.dictationOnDesc)}
                </div>
              </span>
            )
            : null}
          {CaptionsService.canIOwnThisPad(ownerId)
            ? (
              <Button
                color="primary"
                tooltipLabel={intl.formatMessage(intlMessages.takeOwnershipTooltip, { 0: name })}
                onClick={() => { CaptionsService.takeOwnership(locale); }}
                aria-label={intl.formatMessage(intlMessages.takeOwnership)}
                label={intl.formatMessage(intlMessages.takeOwnership)}
              />
            ) : null}
        </header>
        {listening ? (
          <div>
            <span className={styles.interimTitle}>
              {intl.formatMessage(intlMessages.interimResult)}
            </span>
            <div
              className={styles.processing}
              ref={(node) => { this.iterimResultContainer = node; }}
            />
          </div>
        ) : null}
        <iframe
          title="etherpad"
          src={url}
          aria-describedby="padEscapeHint"
          style={{
            pointerEvents: isResizing ? 'none' : 'inherit',
          }}
        />
        <span id="padEscapeHint" className={styles.hint} aria-hidden>
          {intl.formatMessage(intlMessages.tip)}
        </span>
      </div>
    );
  }
}

Pad.propTypes = propTypes;
export default injectWbResizeEvent(injectIntl(Pad));
