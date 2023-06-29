import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import Service from '/imports/ui/components/captions/service';
import Captions from './component';
import Auth from '/imports/ui/services/auth';
import { layoutSelectInput, layoutDispatch } from '../layout/context';
import { ACTIONS, PANELS } from '/imports/ui/components/layout/enums';

const Container = (props) => {
  const cameraDock = layoutSelectInput((i) => i.cameraDock);
  const { isResizing } = cameraDock;
  const layoutContextDispatch = layoutDispatch();

  const { amIModerator } = props;

  return <Captions {...{ layoutContextDispatch, isResizing, ...props }} />;
};

export default withTracker(() => {
  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
  const {
    locale,
    name,
  } = Service.getCaptions();

  return {
    locale,
    name,
    amISpeaker: Service.amISpeaker(locale),
    currentUserId: Auth.userID,
    isRTL,
    hasPermission: Service.hasPermission(),
    amIModerator: Service.amIModerator(),
    isAutoTranslated: Service.isAutoTranslated(locale),
  };
})(Container);
