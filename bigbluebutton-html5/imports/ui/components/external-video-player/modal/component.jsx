import React, { Component } from 'react';
import { withModalMounter } from '/imports/ui/components/common/modal/service';
import Icon from '/imports/ui/components/icon/component';
//import Modal from '/imports/ui/components/modal/simple/component';
//import Button from '/imports/ui/components/button/component';
import UploadMediaService from '/imports/ui/components/upload/media/service';
import { defineMessages, injectIntl } from 'react-intl';
import { isUrlValid } from '../service';
import Settings from '/imports/ui/services/settings';
import Styled from './styles';

const intlMessages = defineMessages({
  start: {
    id: 'app.externalVideo.start',
    description: 'Share external video',
  },
  urlError: {
    id: 'app.externalVideo.urlError',
    description: 'Not a video URL error',
  },
  input: {
    id: 'app.externalVideo.input',
    description: 'Video URL',
  },
  urlInput: {
    id: 'app.externalVideo.urlInput',
    description: 'URL input field placeholder',
  },
  title: {
    id: 'app.externalVideo.title',
    description: 'Modal title',
  },
  close: {
    id: 'app.externalVideo.close',
    description: 'Close',
  },
  filename: {
    id: 'app.externalVideo.filename',
    description: 'Media filename',
  },
  note: {
    id: 'app.externalVideo.noteLabel',
    description: 'provides hint about Shared External videos',
  },
});

class ExternalVideoModal extends Component {
  constructor(props) {
    super(props);

    const { videoUrl } = props;

    this.state = {
      url: videoUrl,
      sharing: videoUrl,
    };

    this.startWatchingHandler = this.startWatchingHandler.bind(this);
    this.updateVideoUrlHandler = this.updateVideoUrlHandler.bind(this);
    this.renderUrlError = this.renderUrlError.bind(this);
    this.updateVideoUrlHandler = this.updateVideoUrlHandler.bind(this);
    this.onMediaFileClick = this.onMediaFileClick.bind(this);
  }

  startWatchingHandler() {
    const {
      startWatching,
      closeModal,
    } = this.props;

    const { url } = this.state;

    startWatching(url.trim());
    closeModal();
  }

  updateVideoUrlHandler(ev) {
    this.setState({ url: ev.target.value });
  }

  onMediaFileClick(id) {
    const {
      startWatching,
      closeModal,
    } = this.props;

    const url = UploadMediaService.getDownloadURL(id);

    startWatching(url.trim());
    closeModal();
  }

  renderUrlError() {
    const { intl } = this.props;
    const { url } = this.state;
    const { animations } = Settings.application;

    const valid = (!url || url.length <= 3) || isUrlValid(url);

    return (
      !valid
        ? (
          <Styled.UrlError animations={animations}>
            {intl.formatMessage(intlMessages.urlError)}
          </Styled.UrlError>
        )
        : null
    );
  }

  renderItem(item) {
    const { intl } = this.props;

    return (
      <tr
        key={item.uploadId}
        className={styles.item}
        onClick={() => this.onMediaFileClick(item.uploadId)}
      >
        <td className={styles.icon}>
          <Icon iconName="file" />
        </td>
        <th className={styles.name}>
          <span>{item.filename}</span>
        </th>
      </tr>
    );
  }

  renderFiles() {
    const {
      intl,
      files,
    } = this.props;

    if (files.length === 0) return null;

    return (
      <div className={styles.list}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.hidden}>
                {intl.formatMessage(intlMessages.filename)}
              </th>
            </tr>
          </thead>
          <tbody>
            {files.map(item => this.renderItem(item))}
          </tbody>
        </table>
      </div>
    );
  }

  render() {
    const { intl, closeModal } = this.props;
    const { url, sharing } = this.state;
    const { animations } = Settings.application;

    const startDisabled = !isUrlValid(url);

    return (
      <Styled.ExternalVideoModal
        onRequestClose={closeModal}
        contentLabel={intl.formatMessage(intlMessages.title)}
        hideBorder
      >
        <Styled.Header data-test="videoModalHeader">
          <Styled.Title>{intl.formatMessage(intlMessages.title)}</Styled.Title>
        </Styled.Header>

        <Styled.Content>
          <Styled.VideoUrl animations={animations}>
            <label htmlFor="video-modal-input">
              {intl.formatMessage(intlMessages.input)}
              <input
                id="video-modal-input"
                onChange={this.updateVideoUrlHandler}
                name="video-modal-input"
                placeholder={intl.formatMessage(intlMessages.urlInput)}
                disabled={sharing}
                aria-describedby="exernal-video-note"
              />
            </label>
            <Styled.ExternalVideoNote id="external-video-note">
              {intl.formatMessage(intlMessages.note)}
            </Styled.ExternalVideoNote>
          </Styled.VideoUrl>

          <div>
            {this.renderUrlError()}
          </div>

          {this.renderFiles()}
          <Styled.StartButton
            label={intl.formatMessage(intlMessages.start)}
            onClick={this.startWatchingHandler}
            disabled={startDisabled}
            data-test="startNewVideo"
          />
        </Styled.Content>
      </Styled.ExternalVideoModal>
    );
  }
}

export default injectIntl(withModalMounter(ExternalVideoModal));
