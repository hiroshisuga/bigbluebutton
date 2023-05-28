import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl } from 'react-intl';
import injectWbResizeEvent from '/imports/ui/components/presentation/resize-wrapper/component';
import Button from '/imports/ui/components/common/button/component';
import PadContainer from '/imports/ui/components/pads/container';
import Service from '/imports/ui/components/captions/service';
import Styled from './styles';
import { PANELS, ACTIONS } from '/imports/ui/components/layout/enums';
import browserInfo from '/imports/utils/browserInfo';
import Header from '/imports/ui/components/common/control-header/component';
import StyledHeader from '/imports/ui/components/common/control-header//styles';
import { components } from 'react-select';

const intlMessages = defineMessages({
  hide: {
    id: 'app.captions.hide',
    description: 'Label for hiding closed captions',
  },
  takeOwnership: {
    id: 'app.captions.ownership',
    description: 'Label for taking ownership of closed captions',
  },
  takeOwnershipTooltip: {
    id: 'app.captions.ownershipTooltip',
    description: 'Text for button for taking ownership of closed captions',
  },
  dictationStart: {
    id: 'app.captions.dictationStart',
    description: 'Label for starting speech recognition',
  },
  dictationStop: {
    id: 'app.captions.dictationStop',
    description: 'Label for stoping speech recognition',
  },
  dictationOnDesc: {
    id: 'app.captions.dictationOnDesc',
    description: 'Aria description for button that turns on speech recognition',
  },
  dictationOffDesc: {
    id: 'app.captions.dictationOffDesc',
    description: 'Aria description for button that turns off speech recognition',
  },
  autoTranslation: {
    id: 'app.captions.pad.autoTranslation',
    description: 'Label for auto translation of closed captions pad',
  },
  autoTranslationDesc: {
    id: 'app.captions.pad.autoTranslationDesc',
    description: 'Descriotion for auto translation of closed captions pad',
  },
});

const propTypes = {
  locale: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  isRTL: PropTypes.bool.isRequired,
  hasPermission: PropTypes.bool.isRequired,
  layoutContextDispatch: PropTypes.func.isRequired,
  isResizing: PropTypes.bool.isRequired,
};

const Captions = ({
  locale,
  intl,
  name,
  amISpeaker,
  isRTL,
  hasPermission,
  layoutContextDispatch,
  isResizing,
  //isAutoTranslated,
  //toggleAutoTranslation,
}) => {
  const { isChrome } = browserInfo;

  const localeOptions = [];
  const selectedLocales = [];
  Service.getAvailableLocales().forEach((loc) => {
    //The current locale not included
    localeOptions.push({value: loc.locale, label: loc.name});
    if (loc.translating) {
      if (loc.locale == locale) {
        selectedLocales.push({value: loc.locale, label: loc.name, isFixed: true});
      } else {
        selectedLocales.push({value: loc.locale, label: loc.name});
      }
    }
  });

  const onTranslationLocaleChanged = (
    newValue,
    actionMeta
  ) => {
    switch (actionMeta.action) {
      case 'remove-value':
      case 'pop-value':
        Service.removeTranslation(actionMeta.removedValue.value);
        break;
      case 'select-option':
        Service.selectTranslation(actionMeta.option.value);
        break;
      case 'clear':
        //This would't happen..
        Service.clearTranslation();
        break;
    }
  };

  const MultiValueRemove = (props) => {
    if (props.data.isFixed) {
      return null;
    }
    return <components.MultiValueRemove {...props} />;
  };

  return (
    <Styled.Captions isChrome={isChrome}>
      <Header
        leftButtonProps={{
          onClick: () => {
            layoutContextDispatch({
              type: ACTIONS.SET_SIDEBAR_CONTENT_IS_OPEN,
              value: false,
            });
            layoutContextDispatch({
              type: ACTIONS.SET_SIDEBAR_CONTENT_PANEL,
              value: PANELS.NONE,
            });
          },
          'aria-label': intl.formatMessage(intlMessages.hide),
          label: name,
        }}
        customRightButton={
          <span>
            <Button
              onClick={amISpeaker
                ? () => Service.stopDictation(locale)
                : () => Service.startDictation(locale)}
              label={amISpeaker
                ? intl.formatMessage(intlMessages.dictationStop)
                : intl.formatMessage(intlMessages.dictationStart)}
              aria-describedby="dictationBtnDesc"
              color={amISpeaker ? 'danger' : 'primary'}
            />
            <div id="dictationBtnDesc" hidden>
              {amISpeaker
                ? intl.formatMessage(intlMessages.dictationOffDesc)
                : intl.formatMessage(intlMessages.dictationOnDesc)}
            </div>
          </span>
        }
      />

      <StyledHeader.RightWrapper>
        {Service.isAutoTranslationEnabled() && amISpeaker
          ? (
              <div>
                <label>
                  {intl.formatMessage(intlMessages.autoTranslationDesc)}
                </label>
              </div>
          )
          : null}
      </StyledHeader.RightWrapper>
      <StyledHeader.RightWrapper>
        {amISpeaker && isAutoTranslated
          ? (
              <div>
                <Styled.SelectTranslation
                  closeMenuOnSelect={false}
                  defaultValue={selectedLocales}
                  isMulti
                  options={localeOptions}
                  onChange={onTranslationLocaleChanged}
                  components= {{ MultiValueRemove }}
                  isClearable={false}
                />
              </div>
          )
          : null}
      </StyledHeader.RightWrapper>

      <PadContainer
        externalId={locale}
        hasPermission={hasPermission}
        isResizing={isResizing}
        isRTL={isRTL}
      />
    </Styled.Captions>
  );
};

Captions.propTypes = propTypes;

export default injectWbResizeEvent(injectIntl(Captions));
