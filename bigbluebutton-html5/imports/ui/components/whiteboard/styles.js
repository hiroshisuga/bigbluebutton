import styled, { createGlobalStyle } from 'styled-components';
import { borderSize, borderSizeLarge } from '/imports/ui/stylesheets/styled-components/general';
import { toolbarButtonColor, colorWhite, colorBlack } from '/imports/ui/stylesheets/styled-components/palette';
import {
  fontSizeLarger,
} from '/imports/ui/stylesheets/styled-components/typography';
import Button from '/imports/ui/components/common/button/component';

const TldrawGlobalStyle = createGlobalStyle`
  ${({ hideContextMenu }) => hideContextMenu && `
    #TD-ContextMenu {
      display: none;
    }
  `}
  ${({ menuOffset }) => `
    #TD-StylesMenu {
      position: relative;
      right: ${menuOffset};
    }
  `}
  #TD-PrimaryTools-Image {
    display: none;
  }
  #slide-background-shape div {
    pointer-events: none;
    user-select: none;
  }
  div[dir*="ltr"]:has(button[aria-expanded*="false"][aria-controls*="radix-"]) {
    pointer-events: none;
  }
  [aria-expanded*="false"][aria-controls*="radix-"] {
    display: none;
  }
  [class$="-side-right"] {
    top: -1px;
  }
  ${({ hasWBAccess, isPresenter, size }) => (hasWBAccess || isPresenter) && `
    #TD-Tools-Dots {
      height: ${size}px;
      width: ${size}px;
    }
    #TD-Delete {
      & button {
        height: ${size}px;
        width: ${size}px;
      }
    }
    #TD-PrimaryTools button {
        height: ${size}px;
        width: ${size}px;
    }
    #TD-Styles {
      border-width: ${borderSize};
    }
    #TD-TopPanel-Undo,
    #TD-TopPanel-Redo,
    #TD-Styles {
      height: 92%;
      border-radius: 7px;

      &:hover {
        border: solid ${borderSize} #ECECEC;
        background-color: #ECECEC;
      }
      &:focus {
        border: solid ${borderSize} ${colorBlack};
      }
    }
    #TD-Styles,
    #TD-TopPanel-Undo,
    #TD-TopPanel-Redo {
      margin: ${borderSize} ${borderSizeLarge} 0px ${borderSizeLarge};
    }
  `}
  ${({ hasWBAccess, isPresenter, panSelected }) => (hasWBAccess || isPresenter) && panSelected && `
    [id^="TD-PrimaryTools-"] {
      &:hover > div,
      &:focus > div {
        background-color: var(--colors-hover) !important;
      }
    }
  `}
  ${({ darkTheme }) => darkTheme && `
    #TD-TopPanel-Undo,
    #TD-TopPanel-Redo,
    #TD-Styles {
      &:focus {
        border: solid ${borderSize} ${colorWhite} !important;
      }
    }
  `}
  ${({ isPresenter }) => (!isPresenter) && `
    #presentationInnerWrapper div{
      cursor: default !important;
    }
  `}
`;

const TldrawGlobalStyleText = (arg) => {
  const styleText = `
  ${ arg.hideContextMenu ? `
    #TD-ContextMenu {
      display: none;
    }
  ` : ''}
  #TD-StylesMenu {
    position: relative;
    right: ${arg.menuOffset};
  }
  #TD-PrimaryTools-Image {
    display: none;
  }
  #slide-background-shape div {
    pointer-events: none;
    user-select: none;
  }
  div[dir*="ltr"]:has(button[aria-expanded*="false"][aria-controls*="radix-"]) {
    pointer-events: none;
  }
  [aria-expanded*="false"][aria-controls*="radix-"] {
    display: none;
  }
  [class$="-side-right"] {
    top: -1px;
  }
  ${ (arg.hasWBAccess || arg.isPresenter) ? `
    #TD-Tools-Dots {
      height: ${arg.size}px;
      width: ${arg.size}px;
    }
    #TD-Delete button {
      height: ${arg.size}px;
      width: ${arg.size}px;
    }
    #TD-PrimaryTools button {
      height: ${arg.size}px;
      width: ${arg.size}px;
    }
    #TD-Styles {
      border-width: ${borderSize};
    }
    #TD-TopPanel-Undo,
    #TD-TopPanel-Redo,
    #TD-Styles {
      height: 92%;
      border-radius: 7px;
    }
    #TD-TopPanel-Undo:hover,
    #TD-TopPanel-Redo:hover,
    #TD-Styles:hover {
      border: solid ${borderSize} #ECECEC;
      background-color: #ECECEC;
    }
    #TD-TopPanel-Undo > div:hover,
    #TD-TopPanel-Redo > div:hover,
    #TD-Styles > div:hover {
      background-color: var(--colors-hover);
    }
    #TD-Styles:focus {
      border: solid ${borderSize} ${colorBlack};
    }
    #TD-Styles,
    #TD-TopPanel-Undo,
    #TD-TopPanel-Redo {
      margin: ${borderSize} ${borderSizeLarge} 0px ${borderSizeLarge};
    }
    
    /* For manually supplementing the style of the TD-Tools-Dots */
    div[style*="--radix-popper-transform-origin"] > div {
        display: flex;
    }
    /* stop propagate mouse click so that the browser's context menu won't appear everytime you open the tldraw context menu */
    div:has(#TD-ContextMenu) {
      pointer-events: none;
    }
    
    /* For tldraw tooltips; for an edge case where the user enters the detached mode without showing any tooltip */
    div[style*="--radix-tooltip-content-transform-origin"] {
        border-radius: 3px;
        padding: var(--space-3) var(--space-3) var(--space-3) var(--space-3);
        font-size: var(--fontSizes-1);
        background-color: var(--colors-tooltip);
        color: var(--colors-tooltipContrast);
        box-shadow: var(--shadows-3);
        display: flex;
        align-items: center;
        font-family: var(--fonts-ui);
        user-select: none;
    }
    
    /* for sticky notes */
    div[data-shape="sticky"] > div > div > div > div {
        text-align: ${ arg.isRTL ? `right` : `left` } ;
    }

    div[data-shape="sticky"] textarea {
      width: 100%;
      height: 100%;
      border: none;
      overflow: hidden;
      background: none;
      outline: none;
      textAlign: left;
      font: inherit;
      padding: 0;
      color: transparent;
      verticalAlign: top;
      resize: none;
      caretColor: black;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      letter-spacing: -0.03em;
    }
    /* for text */
    div[data-shape="text"] textarea {
      position: absolute;
      top: 0px;
      left: 0px;
      z-index: 1;
      width: 100%;
      height: 100%;
      border: none;
      padding: 4px;
      resize: none;
      text-align: inherit;
      min-height: inherit;
      min-width: inherit;
      line-height: inherit;
      letter-spacing: inherit;
      outline: 0px;
      font-weight: inherit;
      overflow: hidden;
      backface-visibility: hidden;
      display: inline-block;
      pointer-events: all;
      background: var(--colors-boundsBg);
      user-select: text;
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
  ` : ''}
  
  ${ ((arg.hasWBAccess || arg.isPresenter) && arg.panSelected) ? `
    [id^="TD-PrimaryTools-"]:hover > div {
      background-color: var(--colors-hover) !important;
    }
    [id^="TD-PrimaryTools-"]:focus > div {
      background-color: var(--colors-hover) !important;
    }
  ` : ''}
  
  ${ (arg.darkTheme) ? `
    #TD-TopPanel-Undo,
    #TD-TopPanel-Redo,
    #TD-Styles:focus {
      border: solid ${borderSize} ${colorWhite} !important;
    }
  ` : ''}
  
  ${ !(arg.isPresenter) ? `
    #presentationInnerWrapper div{
      cursor: default !important;
    }
  ` : ''}
  
  button[data-test="panButton"] {
    border: none !important;
    padding: 0;
    margin: 0;
    border-radius: 7px;
    background-color: ${colorWhite};
    color: ${toolbarButtonColor};
  }
  button[data-test="panButton"] > i {
    font-size: ${fontSizeLarger} !important;
    ${ arg.isRTL ? `
      -webkit-transform: scale(-1, 1);
      -moz-transform: scale(-1, 1);
      -ms-transform: scale(-1, 1);
      -o-transform: scale(-1, 1);
      transform: scale(-1, 1);
    ` : '' }
  }
  ${ !(arg.panSelected) ? `
    button[data-test="panButton"]:hover {
      background-color: var(--colors-hover) !important;
    }
    button[data-test="panButton"]:focus {
      background-color: var(--colors-hover) !important;
    }
  ` : '' }
  
  `;

  return styleText;
};

const EditableWBWrapper = styled.div`
  &, & > :first-child {
    cursor: inherit !important;
  }
`;

const PanTool = styled(Button)`
  border: none !important;
  padding: 0;
  margin: 0;
  border-radius: 7px;
  background-color: ${colorWhite};
  color: ${toolbarButtonColor};

  & > i {
    font-size: ${fontSizeLarger} !important;
    [dir="rtl"] & {
      -webkit-transform: scale(-1, 1);
      -moz-transform: scale(-1, 1);
      -ms-transform: scale(-1, 1);
      -o-transform: scale(-1, 1);
      transform: scale(-1, 1);
    }
  }

  ${({ panSelected }) => !panSelected && `
    &:hover,
    &:focus {
      background-color: var(--colors-hover) !important;
    }
  `}
`;

export default {
  TldrawGlobalStyle,
  TldrawGlobalStyleText,
  EditableWBWrapper,
  PanTool,
};
