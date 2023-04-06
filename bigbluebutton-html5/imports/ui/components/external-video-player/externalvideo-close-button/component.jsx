import React from 'react';
import { defineMessages, injectIntl } from 'react-intl';
//import Button from '/imports/ui/components/button/component';
//import { styles } from './styles';
import Styled from '../styles';
import ExternalVideoService from '/imports/ui/components/external-video-player/service';

const intlMessages = defineMessages({
  closeExternalVideoLabel: {
    id: 'app.actionsBar.actionsDropdown.stopShareExternalVideo',
    description: 'Close external video label',
  },
});

const CloseExternalVideoComponent = ({ intl }) => (

  <Styled.ExternalVideoCloseButton
    role="button"
    aria-labelledby="closeLabel"
    aria-describedby="closeDesc"
    color="primary"
    icon="close"
    size="sm"
    onClick={ExternalVideoService.stopWatching}
    label={intl.formatMessage(intlMessages.closeExternalVideoLabel)}
    hideLabel
    className={Styled.ExternalVideoCloseButton}
  />
);

export default injectIntl(CloseExternalVideoComponent);
