import React from 'react';
import FullscreenButtonComponent from './component';
import { layoutSelect, layoutDispatch } from '/imports/ui/components/layout/context';
import FullscreenService from './service';

const FullscreenButtonContainer = (props) => <FullscreenButtonComponent {...props} />;

export default (props) => {
  const handleToggleFullScreen = (ref) => FullscreenService.toggleFullScreen(ref);
  var { isFullscreen } = props;

  const isIphone = !!(navigator.userAgent.match(/iPhone/i));

  const fullscreen = layoutSelect((i) => i.fullscreen);
  const { element: currentElement, group: currentGroup } = fullscreen;
  const {isPresentationDetached, presentationWindow } = props;
  
  if (isPresentationDetached) {
    isFullscreen = FullscreenService.isFullScreen(presentationWindow.document.documentElement);
  }

  const layoutContextDispatch = layoutDispatch();

  return (
    <FullscreenButtonContainer
      {...props}
      {...{
        handleToggleFullScreen,
        isIphone,
        isFullscreen,
        currentElement,
        currentGroup,
        layoutContextDispatch,
      }}
    />
  );
};
