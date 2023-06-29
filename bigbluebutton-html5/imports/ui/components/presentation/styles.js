import styled from 'styled-components';
import {
  innerToastWidth,
  toastIconSide,
  smPaddingX,
  smPaddingY,
} from '/imports/ui/stylesheets/styled-components/general';
import {
  colorPrimary,
  colorWhite,
  colorDanger,
  colorGrayDark,
} from '/imports/ui/stylesheets/styled-components/palette';
import {
  fontSizeLarger,
} from '/imports/ui/stylesheets/styled-components/typography';
import FullscreenButtonContainer from '/imports/ui/components/common/fullscreen-button/container';
import ToastStyled from '/imports/ui/components/common/toast/styles';

import {
  toolbarButtonWidth,
  toolbarButtonHeight,
  toolbarItemOutlineOffset,
  toolbarButtonBorder,
  toolbarButtonBorderRadius,
lgPaddingX,
borderSizeLarge,
} from '/imports/ui/stylesheets/styled-components/general';
import {
  toolbarButtonBorderColor,
  toolbarListColor,
  toolbarButtonColor,
  toolbarListBg,
  toolbarListBgFocus,
} from '/imports/ui/stylesheets/styled-components/palette';
import { toolbarButtonFontSize } from '/imports/ui/stylesheets/styled-components/typography';

const VisuallyHidden = styled.span`
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  height: 1px; width: 1px;
  margin: -1px; padding: 0; border: 0;
`;

const PresentationSvg = styled.svg`
  object-fit: contain;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;

  //always show an arrow by default
  cursor: default;

  //double click on the whiteboard shouldn't change the cursor
  -moz-user-select: -moz-none;
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
`;

const PresentationFullscreenButton = styled(FullscreenButtonContainer)`
  z-index: 1;
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
  cursor: pointer;

  [dir="rtl"] & {
    right: auto;
    left : 0;
  }
`;

const InnerToastWrapper = styled.div`
  width: ${innerToastWidth};
`;

const ToastIcon = styled.div`
  margin-right: ${smPaddingX};
  [dir="rtl"] & {
    margin-right: 0;
    margin-left: ${smPaddingX};
  }
`;

const IconWrapper = styled.div`
  background-color: ${colorPrimary};
  width: ${toastIconSide};
  height: ${toastIconSide};
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;

  & > i {
    position: relative;
    color: ${colorWhite};
    font-size: ${fontSizeLarger};
  }
`;

const ToastTextContent = styled.div`
  position: relative;
  overflow: hidden;
  margin-top: ${smPaddingY};

  & > div:first-of-type {
    font-weight: bold;
  }
`;

const PresentationName = styled.div`
  text-overflow: ellipsis;
  overflow: hidden;
`;

const ToastDownload = styled.span`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  a {
    color: ${colorPrimary};
    cursor: pointer;
    text-decoration: none;

    &:focus,
    &:hover,
    &:active {
      color: ${colorPrimary};
      box-shadow: 0;
    }
  }
`;

const PresentationContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

const Presentation = styled.div`
  order: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
`;

const SvgContainer = styled.div`
  width: 100%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const WhiteboardSizeAvailable = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
  z-index: -1;
`;

const PresentationToolbar = styled.div`
  display: flex;
  overflow-x: visible;
  order: 2;
  position: absolute;
  bottom: 0;
`;

const ToastSeparator = styled(ToastStyled.Separator)``;

const submenuStyleText = (arg) => {
  const styleText = `
    [data-test="toolbarToolsList"] {
      display: -webkit-box;
      display: -webkit-flex;
      display: -ms-flexbox;
      display: flex;
      -webkit-flex-direction: row;
      -ms-flex-direction: row;
      flex-direction: row;
      -webkit-align-items: center;
      -webkit-box-align: center;
      -ms-flex-align: center;
      align-items: center;
      -webkit-box-pack: center;
      -webkit-justify-content: center;
      -ms-flex-pack: center;
      justify-content: center;
      height: ${toolbarButtonHeight};
      position: absolute;
      right: ${arg.isRTL ? 'auto' : toolbarButtonHeight};
      left: ${arg.isRTL ? toolbarButtonHeight : 'auto'};
      top: 0;
      box-shadow:
    }
    [data-test="toolbarToolsList"] > div {
      width: ${toolbarButtonWidth};
      min-width: ${toolbarButtonWidth};
      height: ${toolbarButtonHeight};
      min-height: ${toolbarButtonHeight};
      position: relative;
    }
    [data-test="toolbarToolsList"] > div > button {
      outline-offset: ${toolbarItemOutlineOffset};
      border-bottom: ${toolbarButtonBorder} solid ${toolbarButtonBorderColor};
    }
    [data-test="toolbarToolsList"]:firstchild > button {
      border-top-left-radius: ${arg.isRTL ? '0' : toolbarButtonBorderRadius};
      border-bottom-left-radius: ${arg.isRTL ? '0' : toolbarButtonBorderRadius};
      border-top-right-radius: ${arg.isRTL ? toolbarButtonBorderRadius : '0'};
      border-bottom-right-radius: ${arg.isRTL ? toolbarButtonBorderRadius : '0'};
    }

    [data-test="toolbarToolsList"] > div > button {
      padding: 0;
      border: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: row;
      align-items: center !important;
      justify-content: center !important;
      position: relative;
      border-radius: 0;
      box-shadow: none !important;
      z-index: 1;
      font-size: ${toolbarButtonFontSize};
      color: ${toolbarButtonColor};
      border-color: ${toolbarButtonBorderColor};
      background-color: ${toolbarListBg};
    }
    [data-test="toolbarToolsList"] > div > button:focus,
    [data-test="toolbarToolsList"] > div > button:hover {
      border: 0;
      /*to add a hover effect, absent in the original styled component*/
      background-color: ${toolbarListBgFocus} !important;
    } 
    [data-test="toolbarToolsList"] > div > button > i {
      color: ${toolbarListColor};
    }
    [data-test="toolbarToolsList"] > div > button[state="selected"]  {
      background-color: ${toolbarListColor} !important;
      background:red;
    }
    [data-test="toolbarToolsList"] > div > button[state="selected"] > i  {
      color: ${toolbarListBgFocus} !important;
    } 
    [data-test="toolbarToolsList"] > div > button[state="selected"] > svg  {
      fill: ${toolbarListBgFocus};
    }

    [data-test="toolbarToolsList"][type="color"] > div > button > svg  {
      position: absolute;
      width: ${toolbarButtonWidth};
      height: ${toolbarButtonHeight};
      left: 0;
      top: 0;
    }
    /*
    [data-test="toolbarToolsList"][type="font-size"] > div > button > svg  {
      position: absolute;
      width: ${toolbarButtonWidth};
      height: ${toolbarButtonHeight};
      left: 0;
      top: 0;
    }
    */

    [data-test="multiWhiteboardTool"] > span {
      background-color: ${colorDanger};
      border-radius: 50%;
      width: ${lgPaddingX};
      height: ${lgPaddingX};
      position: absolute;
      z-index: 2;
      right: 0px;
      color: ${colorWhite};
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 1px 1px ${borderSizeLarge} ${colorGrayDark};
      font-size: ${smPaddingX};
    }
    
    /* SubmenuButton in toolbar-submenu-item/styles.js */
    .toolbarButtonWrapper > button[state="active"] {
      padding: 0;
      border: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: row;
      align-items: center !important;
      justify-content: center !important;
      position: relative;
      border-radius: 0;
      box-shadow: none !important;
      z-index: 1;
      font-size: ${toolbarButtonFontSize};
      color: ${toolbarButtonColor};
      border-color: ${toolbarButtonBorderColor};
      background-color: ${toolbarListBg};
    }
    .toolbarButtonWrapper > button[state="active"]:hover,
    .toolbarButtonWrapper > button[state="active"]:focus {
      border: 0;
    }
    .toolbarButtonWrapper > button[state="active"] > i {
      color: ${toolbarListColor};
    }

    /* Outline of texttool */
    .toolbarButtonWrapper p {
      font-family: Arial, sans-serif;
      font-weight: normal;
      text-shadow: -1px 0 ${toolbarListBgFocus}, 0 1px ${toolbarListBgFocus}, 1px 0 ${toolbarListBgFocus}, 0 -1px ${toolbarListBgFocus};
      margin: auto;
      color: ${toolbarListColor};
    }
  `;

  return styleText;
};

export default {
  VisuallyHidden,
  PresentationSvg,
  PresentationFullscreenButton,
  InnerToastWrapper,
  ToastIcon,
  IconWrapper,
  ToastTextContent,
  PresentationName,
  ToastDownload,
  PresentationContainer,
  Presentation,
  SvgContainer,
  WhiteboardSizeAvailable,
  PresentationToolbar,
  ToastSeparator,
  submenuStyleText,
};
