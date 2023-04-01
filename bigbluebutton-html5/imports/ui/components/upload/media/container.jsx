import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import { withModalMounter } from '/imports/ui/components/common/modal/service';
import Service from './service';
import MediaUpload from './component';

const MediaUploadContainer = props => <MediaUpload {...props} />;

export default withModalMounter(withTracker(({ mountModal }) => ({
  closeModal: () => mountModal(null),
  isEnabled: Service.isEnabled(),
}))(MediaUploadContainer));
