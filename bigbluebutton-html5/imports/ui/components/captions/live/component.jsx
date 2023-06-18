import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Service from '/imports/ui/components/captions/service';

const LINEHEIGHT = 1.3 //1.2 - 1.5; when "line-height: normal", 1.2 for western fonts and 1.5 for Japanese fonts. 
const CAPTIONS_CONFIG = Meteor.settings.public.captions;

class LiveCaptions extends PureComponent {
  constructor(props) {
    super(props);

    this.state = { clear: true };
    this.timer = null;
    this.settings = Service.getCaptionsSettings();
  }

  componentDidUpdate(prevProps) {
    const { clear } = this.state;

    if (clear) {
      const { data } = this.props;
      if (prevProps.data !== data) {
        // eslint-disable-next-line react/no-did-update-set-state
        this.setState({ clear: false });
      }
    } else {
      // Set clip-path to limit max 2 lines
      let regionHeight = 0;
      let regionFontSize = 0;
      const captionWindow = document.getElementById("caption-window");
      if (captionWindow) {
        const captionWindowStyle = window.getComputedStyle(captionWindow);
        regionHeight = captionWindow.clientHeight;
        regionFontSize = parseInt(captionWindowStyle.getPropertyValue("font-size"));
        const regionMaxHeight = regionFontSize * LINEHEIGHT * 2;
        // The below line was necessary when the avatar size was defined in user/component;
        //  the number 46px seemed to have determinied by the avatar size.
        //  After the avatar size became not hard-coded, the regionHeight is regionFontSize * LINEHEIGHT * (number of lines)
        //regionMaxHeight = regionMaxHeight < 46 ? 46 : regionMaxHeight;
        const inset = `inset(${regionHeight > regionMaxHeight ? regionHeight-regionMaxHeight : 0}px 0px 0px 0px)`;
        //console.log("CapRender", regionHeight, regionFontSize, regionMaxHeight, inset);
        captionWindow.style.clipPath = inset;
      }
      this.resetTimer();
      this.timer = setTimeout(() => this.setState({ clear: true }), CAPTIONS_CONFIG.time);
    }
  }

  componentWillUnmount() {
    this.resetTimer();
  }

  resetTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  render() {
    const { data } = this.props;
    const { clear } = this.state;
    const {
      fontFamily,
      fontSize,
      fontColor,
      backgroundColor,
    } = this.settings;

    const captionStyles = {
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      fontFamily,
      fontSize,
      background: backgroundColor,
      color: fontColor,
      //clipPath: inset, -> set later at componentDidUpdate
      lineHeight: LINEHEIGHT,
    };

    const visuallyHidden = {
      position: 'absolute',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      height: '1px',
      width: '1px',
      margin: '-1px',
      padding: '0',
      border: '0',
    };

    return (
      <div>
        <div style={captionStyles} id='caption-window'>
          {clear ? '' : data}
        </div>
        <div
          style={visuallyHidden}
          aria-atomic
          aria-live="polite"
        >
          {clear ? '' : data}
        </div>
      </div>
    );
  }
}

LiveCaptions.propTypes = {
  data: PropTypes.string.isRequired,
};

export default LiveCaptions;
