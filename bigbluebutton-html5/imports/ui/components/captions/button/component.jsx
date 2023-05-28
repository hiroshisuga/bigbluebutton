import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl } from 'react-intl';
import Styled from './styles';
import ButtonEmoji from '/imports/ui/components/common/button/button-emoji/ButtonEmoji';
import _ from 'lodash';
import Dropdown from '/imports/ui/components/dropdown/component';
import DropdownTrigger from '/imports/ui/components/dropdown/trigger/component';
import DropdownContent from '/imports/ui/components/dropdown/content/component';
import DropdownList from '/imports/ui/components/dropdown/list/component';
import DropdownListItem from '/imports/ui/components/dropdown/list/item/component';
import Storage from '/imports/ui/services/storage/session';
import Service from '/imports/ui/components/captions/service';

const propTypes = {
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  isActive: PropTypes.bool.isRequired,
  handleOnClick: PropTypes.func.isRequired,
};

const intlMessages = defineMessages({
  start: {
    id: 'app.actionsBar.captions.start',
    description: 'Start closed captions option',
  },
  stop: {
    id: 'app.actionsBar.captions.stop',
    description: 'Stop closed captions option',
  },
  changeCaption: {
    id: 'app.actionsBar.changeCaption',
    description: 'Open change caption label',
  },
});

const handleClickCaption = (locale, selectedLocale) => {
  if (selectedLocale != locale) {
    Service.setCaptionsActive(locale);
  }
}

const getAvailableCaptions = (captions, selected) => {
  return(
    captions.map(locale => (
    <DropdownListItem
      label={locale.name}
      key={_.uniqueId('locale-selector')}
      onClick={() => handleClickCaption(locale.locale, selected)}
      iconRight={selected == locale.locale ? 'check' : null}
    />
    ))
  );
};

const CaptionsButton = ({ intl, isActive, handleOnClick, translatedLocales, selectedLocale }) => (
  <div>
    <Styled.CaptionsButton
      icon="closed_caption"
      label={intl.formatMessage(isActive ? intlMessages.stop : intlMessages.start)}
      color={isActive ? 'primary' : 'default'}
      ghost={!isActive}
      hideLabel
      circle
      size="lg"
      onClick={handleOnClick}
      id={isActive ? 'stop-captions-button' : 'start-captions-button'}
    />
    {isActive &&
      <Dropdown>
        <DropdownTrigger tabIndex={0}>
        <ButtonEmoji
          emoji="device_list_selector"
          hideLabel
          label={intl.formatMessage(intlMessages.changeCaption)}
        />
        </DropdownTrigger>
        <DropdownContent placement="top left">
          <DropdownList>
            {getAvailableCaptions(translatedLocales, selectedLocale)}
          </DropdownList>
        </DropdownContent>
      </Dropdown>
    }
  </div>
);

CaptionsButton.propTypes = propTypes;
export default injectIntl(CaptionsButton);
