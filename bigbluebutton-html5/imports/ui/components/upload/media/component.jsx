import React, { Component } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import cx from 'classnames';
import _ from 'lodash';
//import Dropzone from 'react-dropzone';
import Icon from '/imports/ui/components/common/icon/component';
import { withModalMounter } from '/imports/ui/components/common/modal/service';
//import Modal from '/imports/ui/components/common/modal/simple/component';
import Button from '/imports/ui/components/common/button/component';
import Service from './service';
import UploadService from '../service';
import Styled from './styles';

const intlMessages = defineMessages({
  title: {
    id: 'app.upload.media.title',
    description: 'Media upload modal title',
  },
  note: {
    id: 'app.upload.media.note',
    description: 'Media upload modal note',
  },
  message: {
    id: 'app.upload.media.message',
    description: 'Media upload modal message',
  },
  filename: {
    id: 'app.upload.media.filename',
    description: 'Media upload modal media filename',
  },
  options: {
    id: 'app.upload.media.options',
    description: 'Media upload modal media options',
  },
  remove: {
    id: 'app.upload.media.remove',
    description: 'Media upload modal remove media',
  },
  upload: {
    id: 'app.upload.media.upload',
    description: 'Media upload modal upload button',
  },
  cancel: {
    id: 'app.upload.media.cancel',
    description: 'Media upload modal cancel button',
  },
});

class MediaUpload extends Component {
  constructor(props) {
    super(props);

    this.state = { files: [] };

    this.source = Service.getSource();
    this.maxSize = Service.getMaxSize();
    this.validFiles = Service.getMediaValidFiles();

    this.handleOnDrop = this.handleOnDrop.bind(this);
  }

  handleOnDrop(acceptedFiles, rejectedFiles) {
    const filesToUpload = acceptedFiles.map(file => {
      const id = _.uniqueId(file.name);

      return {
        file,
        id,
        filename: file.name,
      }
    });

    this.setState(({ files }) => ({ files: files.concat(filesToUpload) }));
  }

  handleRemove(item) {
    const { files } = this.state;
    const index = files.indexOf(item);

    files.splice(index, 1);

    this.setState({ files });
  }

  handleUpload(files) {
    const {
      closeModal,
      intl,
    } = this.props;

    UploadService.upload(this.source, files, intl);
    closeModal();
  }

  renderItem(item) {
    const { intl } = this.props;

    return (
      <tr key={item.id}>
        <td>
          <Icon iconName="file" />
        </td>
        <Styled.Name>
          <span>{item.filename}</span>
        </Styled.Name>
        <Styled.Actions>
          <Styled.StyledButtons>
           <Button
            label={intl.formatMessage(intlMessages.remove)}
            aria-label={`${intl.formatMessage(intlMessages.remove)} ${item.filename}`}
            size="sm"
            icon="delete"
            hideLabel
            onClick={() => this.handleRemove(item)}
           />
          </Styled.StyledButtons>
        </Styled.Actions>
      </tr>
    );
  }

  renderFiles() {
    const { intl } = this.props;
    const { files } = this.state;

    if (files.length === 0) return null;

    return (
      <Styled.List>
        <Styled.Table>
          <thead>
            <tr>
              <Styled.Hidden>
                {intl.formatMessage(intlMessages.filename)}
              </Styled.Hidden>
              <Styled.Hidden>
                {intl.formatMessage(intlMessages.options)}
              </Styled.Hidden>
            </tr>
          </thead>
          <tbody>
            {files.map(item => this.renderItem(item))}
          </tbody>
        </Styled.Table>
      </Styled.List>
    );
  }

  render() {
    const {
      intl,
      closeModal,
    } = this.props;

    const { files } = this.state;

    return (
      <Styled.ModalStyle
       onRequestClose={closeModal}
      >
       <Styled.ModalInner>
        <Styled.ModalHeader>
          <Styled.Title>
            {intl.formatMessage(intlMessages.title)}
          </Styled.Title>
        </Styled.ModalHeader>
        <Styled.Content>
          {intl.formatMessage(intlMessages.note)}
          {this.renderFiles()}
          <Styled.DropzoneWrapper>
           <Styled.UploaderDropzone
            multiple
            accept={this.validFiles.map(type => type.extension)}
            maxSize={this.maxSize}
            disablepreview="true"
            onDrop={this.handleOnDrop}
           >
            <Styled.DropzoneIcon iconName="upload" />
            <Styled.DropzoneMessage>
              {intl.formatMessage(intlMessages.message)}
            </Styled.DropzoneMessage>
           </Styled.UploaderDropzone>
          </Styled.DropzoneWrapper>
        </Styled.Content>
        <Styled.Footer>
          <Styled.StyledButtons>
            <Button
              label={intl.formatMessage(intlMessages.cancel)}
              onClick={closeModal}
            />
            <Button
              color="primary"
              label={intl.formatMessage(intlMessages.upload)}
              onClick={() => this.handleUpload(files)}
              disabled={files.length === 0}
            />
          </Styled.StyledButtons>
        </Styled.Footer>
       </Styled.ModalInner>
      </Styled.ModalStyle>
    );
  }
}

export default injectIntl(withModalMounter(MediaUpload));
