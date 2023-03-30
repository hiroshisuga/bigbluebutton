import React from 'react';
import Toggle from '/imports/ui/components/common/switch/component';
import { defineMessages, injectIntl } from 'react-intl';
import BaseMenu from '../base/component';
import WhiteboardService from '/imports/ui/components/whiteboard/service';
import { meetingIsBreakout } from '/imports/ui/components/app/service';
import Styled from './styles';

const intlMessages = defineMessages({
  dataSavingLabel: {
    id: 'app.settings.dataSavingTab.label',
    description: 'label for data savings tab',
  },
  webcamLabel: {
    id: 'app.settings.dataSavingTab.webcam',
    description: 'webcam toggle',
  },
  screenShareLabel: {
    id: 'app.settings.dataSavingTab.screenShare',
    description: 'screenshare toggle',
  },
  synchronizeWBUpdateLabel: {
    id: 'app.settings.dataSavingTab.synchronizeWBUpdate',
    description: 'whiteboard update synchronization toggle',
  },
  simplifyPencilLabel: {
    id: 'app.settings.dataSavingTab.simplifyPencil',
    description: 'pencil simplification toggle',
  },
  dataSavingDesc: {
    id: 'app.settings.dataSavingTab.description',
    description: 'description of data savings tab',
  },
});

class DataSaving extends BaseMenu {
  constructor(props) {
    super(props);

    this.state = {
      settingsName: 'dataSaving',
      settings: props.settings,
    };
    
    const whiteboardMode = WhiteboardService.getWhiteboardMode();
    if (Object.keys(whiteboardMode).length > 0) {//should be the case
      if (whiteboardMode.synchronizeWBUpdate != undefined) {
        this.state.settings.synchronizeWBUpdate = whiteboardMode.synchronizeWBUpdate
      }
      if (whiteboardMode.simplifyPencil != undefined) {
        this.state.settings.simplifyPencil = whiteboardMode.simplifyPencil;
      }
    }

    this.handleSyncWBUpdate = this.handleSyncWBUpdate.bind(this);
    this.handleSimplifyPencil = this.handleSimplifyPencil.bind(this);
  }

  handleSyncWBUpdate() {
    this.handleToggle('synchronizeWBUpdate');
  }

  handleSimplifyPencil() {
    this.handleToggle('simplifyPencil');
  }

  render() {
    const { intl, showToggleLabel, displaySettingsStatus, isModerator } = this.props;

    const { viewParticipantsWebcams, viewScreenshare, synchronizeWBUpdate, simplifyPencil } = this.state.settings;

    //const isPresenter = PresentationService.isPresenter('DEFAULT_PRESENTATION_POD');
    // -> replace isModerator with isPresenter in case we want only the presenter be able to change the whiteboard setting

    const hiddenForBreakout = meetingIsBreakout() && !Meteor.settings.public.app.defaultSettings.dataSaving.changeWBModeBreakout;
    
    return (
      <div>
        <div>
          <Styled.Title>{intl.formatMessage(intlMessages.dataSavingLabel)}</Styled.Title>
          <Styled.SubTitle>{intl.formatMessage(intlMessages.dataSavingDesc)}</Styled.SubTitle>
        </div>
        <Styled.Form>
          <Styled.Row>
            <Styled.Col aria-hidden="true">
              <Styled.FormElement>
                <Styled.Label>
                  {intl.formatMessage(intlMessages.webcamLabel)}
                </Styled.Label>
              </Styled.FormElement>
            </Styled.Col>
            <Styled.Col>
              <Styled.FormElementRight>
                {displaySettingsStatus(viewParticipantsWebcams)}
                <Toggle
                  icons={false}
                  defaultChecked={viewParticipantsWebcams}
                  onChange={() => this.handleToggle('viewParticipantsWebcams')}
                  ariaLabelledBy="webcamToggle"
                  ariaLabel={intl.formatMessage(intlMessages.webcamLabel)}
                  showToggleLabel={showToggleLabel}
                />
              </Styled.FormElementRight>
            </Styled.Col>
          </Styled.Row>
          <Styled.Row>
            <Styled.Col aria-hidden="true">
              <Styled.FormElement>
                <Styled.Label>
                  {intl.formatMessage(intlMessages.screenShareLabel)}
                </Styled.Label>
              </Styled.FormElement>
            </Styled.Col>
            <Styled.Col>
              <Styled.FormElementRight>
                {displaySettingsStatus(viewScreenshare)}
                <Toggle
                  icons={false}
                  defaultChecked={viewScreenshare}
                  onChange={() => this.handleToggle('viewScreenshare')}
                  ariaLabelledBy="screenShare"
                  ariaLabel={intl.formatMessage(intlMessages.screenShareLabel)}
                  showToggleLabel={showToggleLabel}
                />
              </Styled.FormElementRight>
            </Styled.Col>
          </Styled.Row>
          {isModerator && !hiddenForBreakout ?
          <Styled.Row>
            <Styled.Col aria-hidden="true">
              <Styled.FormElement>
                <Styled.Label>
                  {intl.formatMessage(intlMessages.synchronizeWBUpdateLabel)}
                </Styled.Label>
              </Styled.FormElement>
            </Styled.Col>
            <Styled.Col>
              <Styled.FormElementRight>
                {displaySettingsStatus(synchronizeWBUpdate)}
                <Toggle
                  icons={false}
                  defaultChecked={synchronizeWBUpdate}
                  onChange={this.handleSyncWBUpdate}
                  ariaLabelledBy="syncWB"
                  ariaLabel={intl.formatMessage(intlMessages.synchronizeWBUpdateLabel)}
                  showToggleLabel={showToggleLabel}
                />
              </Styled.FormElementRight>
            </Styled.Col>
          </Styled.Row> : null}
          {isModerator && !hiddenForBreakout && synchronizeWBUpdate ?
          <Styled.Row>
            <Styled.Col aria-hidden="true">
              <Styled.FormElement>
                <Styled.Label>
                  {intl.formatMessage(intlMessages.simplifyPencilLabel)}
                </Styled.Label>
              </Styled.FormElement>
            </Styled.Col>
            <Styled.Col>
              <Styled.FormElementRight>
                {displaySettingsStatus(simplifyPencil)}
                <Toggle
                  icons={false}
                  defaultChecked={simplifyPencil}
                  onChange={this.handleSimplifyPencil}
                  ariaLabelledBy="simplifyPencil"
                  ariaLabel={intl.formatMessage(intlMessages.simplifyPencilLabel)}
                  showToggleLabel={showToggleLabel}
                />
              </Styled.FormElementRight>
            </Styled.Col>
          </Styled.Row> : null}
        </Styled.Form>
      </div>
    );
  }
}

export default injectIntl(DataSaving);
