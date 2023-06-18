import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Service from '/imports/ui/components/captions/service';
import UserContainer from './user/container';
import Auth from '/imports/ui/services/auth';

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

    const wrapperStyles = {
      display: 'flex',
    };

    const backgroundColorAlpha = backgroundColor.match(/^#[0-9a-fA-F]{6}$/) ? backgroundColor + 'a0' : backgroundColor;
    const captionStyles = {
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      fontFamily,
      fontSize,
      background: backgroundColorAlpha,
      color: fontColor,
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
      <div style={wrapperStyles}>
        {clear ? null : (
          <UserContainer
            background="#000000a0"
            userId={data.whosText}
          />
        )}
        <div style={captionStyles}>
          {clear ? '' : data.captionText}
        </div>
        <div
          style={visuallyHidden}
          aria-atomic
          aria-live="polite"
        >
          {clear ? '' : data.captionText}
        </div>
      </div>
    );
  }
}

LiveCaptions.propTypes = {
  data: PropTypes.object.isRequired,
};

export default LiveCaptions;
