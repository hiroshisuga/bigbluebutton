import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages } from 'react-intl';
import _ from 'lodash';
import { makeCall } from '/imports/ui/services/api';
//import browser from 'browser-detect';
//import Button from '/imports/ui/components/button/component';
import Styled from '../styles';
import Dropdown from '/imports/ui/components/dropdown/component';
import DropdownTrigger from '/imports/ui/components/dropdown/trigger/component';
import DropdownContent from '/imports/ui/components/dropdown/content/component';
import DropdownList from '/imports/ui/components/dropdown/list/component';
import DropdownListItem from '/imports/ui/components/dropdown/list/item/component';
import DropdownListSeparator from '/imports/ui/components/dropdown/list/separator/component';
import DropdownListTitle from '/imports/ui/components/dropdown/list/title/component';
import FullscreenService from '/imports/ui/components/common/fullscreen-button/service';
import Panopto from '/imports/ui/components/external-video-player/custom-players/panopto';
import Auth from '/imports/ui/services/auth';

const intlMessages = defineMessages({
  quickLinksLabel: {
    id: 'app.externalLinks.title',
    description: 'Quick external links title',
  },
  quickLinksVideoLabel: {
    id: 'app.externalLinks.videotitle',
    description: 'Quick external links title for videos',
  },
  quickLinksUrlLabel: {
    id: 'app.externalLinks.urltitle',
    description: 'Quick external links title for URLs',
  },
  trueOptionLabel: {
    id: 'app.poll.t',
    description: 'Poll true option value',
  },
  falseOptionLabel: {
    id: 'app.poll.f',
    description: 'Poll false option value',
  },
  yesOptionLabel: {
    id: 'app.poll.y',
    description: 'Poll yes option value',
  },
  noOptionLabel: {
    id: 'app.poll.n',
    description: 'Poll no option value',
  },
  abstentionOptionLabel: {
    id: 'app.poll.abstention',
    description: 'Poll Abstention option value',
  },
});

//const BROWSER_RESULTS = browser();
//const isMobileBrowser = (BROWSER_RESULTS ? BROWSER_RESULTS.mobile : false)
//  || (BROWSER_RESULTS && BROWSER_RESULTS.os
//    ? BROWSER_RESULTS.os.includes('Android') // mobile flag doesn't always work
//    : false);

const propTypes = {
  parseCurrentSlideContent: PropTypes.func.isRequired,
  amIPresenter: PropTypes.bool.isRequired,
  allowExternalVideo: PropTypes.bool.isRequired,
  fullscreenRef: PropTypes.instanceOf(Element),
  isFullscreen: PropTypes.bool.isRequired,
};

const sendGroupMessage = (message) => {
  const CHAT_CONFIG = Meteor.settings.public.chat;
  const PUBLIC_CHAT_SYSTEM_ID = CHAT_CONFIG.system_userid;
  const PUBLIC_GROUP_CHAT_ID = CHAT_CONFIG.public_group_id;
  const payload = {
    color: '0',
    correlationId: `${PUBLIC_CHAT_SYSTEM_ID}-${Date.now()}`,
    sender: {
      id: Auth.userID,
      name: '',
    },
    message,
  };

  return makeCall('sendGroupChatMsg', PUBLIC_GROUP_CHAT_ID, payload);
};

const handleClickQuickVideo = (videoUrl, isFullscreen, fullscreenRef) => {
  if (isFullscreen) {
    FullscreenService.toggleFullScreen(fullscreenRef);
  }
  sendGroupMessage(videoUrl);
  
  let externalVideoUrl = videoUrl;
  if (Panopto.canPlay(videoUrl)) {
    externalVideoUrl = Panopto.getSocialUrl(videoUrl);
  }
  makeCall('startWatchingExternalVideo', externalVideoUrl);
};

const handleClickQuickUrl = (url, isFullscreen, fullscreenRef) => {
  if (isFullscreen) {
    // may not be necessary; presentation automatically becomes small when the slide is moved on (but depending on browser..) 
    FullscreenService.toggleFullScreen(fullscreenRef);
  }
  sendGroupMessage(url);
  window.open(url, null, 'menubar,toolbar,location,resizable');
};

function getAvailableLinks(slideId, videoUrls, urls, videoLabel, urlLabel, isFullscreen, fullscreenRef, allowEV){
  const linkItems = [];
  if (allowEV && videoUrls && videoUrls.length ) {
    linkItems.push(<DropdownListTitle key='dropvideotitle'>{videoLabel}</DropdownListTitle>);
    videoUrls.forEach(url => {
              linkItems.push(
                <DropdownListItem
                  label={url}
                  onClick={() => handleClickQuickVideo(url, isFullscreen, fullscreenRef)}
                  key={url}
                />);
            });
  }
  
  if (urls && urls.length ) {
    if (videoUrls && videoUrls.length) {
      linkItems.push(<DropdownListSeparator key='quickurllinkseparator' />);
    }
    linkItems.push(<DropdownListTitle key='dropurltitle'>{urlLabel}</DropdownListTitle>);
    urls.forEach(url => {
              linkItems.push(
                <DropdownListItem
                  label={url}
                  onClick={() => handleClickQuickUrl(url, isFullscreen, fullscreenRef)}
                  key={url}
                />);
            });
  }

  if (linkItems.length == 0) {
    linkItems.push(
                <DropdownListItem
                />);
  }
  return(linkItems);
}

const QuickLinksDropdown = (props) => {
  const { amIPresenter, intl, parseCurrentSlideContent, allowExternalVideo, screenSharingCheck, isFullscreen, fullscreenRef } = props;
  //This is called twice (in actions-bar/quick-poll-dropdown/component.jsx as well),
  // we could move this to upper component and pass via props in the future.
  const parsedSlide = parseCurrentSlideContent(
    intl.formatMessage(intlMessages.yesOptionLabel),
    intl.formatMessage(intlMessages.noOptionLabel),
    intl.formatMessage(intlMessages.abstentionOptionLabel),
    intl.formatMessage(intlMessages.trueOptionLabel),
    intl.formatMessage(intlMessages.falseOptionLabel),
  );

  const { slideId, videoUrls, urls } = parsedSlide;

// This seems useless.
//  const shouldAllowScreensharing = screenSharingCheck
//    && !isMobileBrowser
//    && amIPresenter;

  return amIPresenter ? (
    <Dropdown>
    <DropdownTrigger tabIndex={0}>
        <Styled.QuickLinksButton
          aria-label={intl.formatMessage(intlMessages.quickLinksLabel)}
          color="primary"
          hideLabel
          icon="external-video"
          label={intl.formatMessage(intlMessages.quickLinksLabel)}
          onClick={() => null}
          size="md"
          aria-disabled={ (!videoUrls || (videoUrls && videoUrls.length == 0)) && (!urls || (urls && urls.length == 0)) ? true : false }
        />
      </DropdownTrigger>
      <DropdownContent placement="top left">
        <DropdownList>
          {getAvailableLinks(slideId, videoUrls, urls, intl.formatMessage(intlMessages.quickLinksVideoLabel), intl.formatMessage(intlMessages.quickLinksUrlLabel), isFullscreen, fullscreenRef, allowExternalVideo)}
        </DropdownList>
      </DropdownContent>
    </Dropdown>
  ) : null;
};

QuickLinksDropdown.propTypes = propTypes;

export default QuickLinksDropdown;
