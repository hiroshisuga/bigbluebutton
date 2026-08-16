import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import WhiteboardContainer from '/imports/ui/components/whiteboard/container';
import { HUNDRED_PERCENT, MAX_PERCENT, MIN_PERCENT } from '/imports/utils/slideCalcUtils';
import { SPACE } from '/imports/utils/keyCodes';
import { defineMessages, injectIntl } from 'react-intl';
import Session from '/imports/ui/services/storage/in-memory';
import PresentationToolbarContainer from './presentation-toolbar/container';
import PresentationMenu from './presentation-menu/container';
import DownloadPresentationButton from './download-presentation-button/component';
import Styled from './styles';
import FullscreenService from '/imports/ui/components/common/fullscreen-button/service';
import PollingContainer from '/imports/ui/components/polling/container';
import { ACTIONS, LAYOUT_TYPE } from '../layout/enums';
import DEFAULT_VALUES from '../layout/defaultValues';
import { colorContentBackground } from '/imports/ui/stylesheets/styled-components/palette';
import browserInfo from '/imports/utils/browserInfo';
import { addAlert } from '../screenreader-alert/service';
import { debounce } from '/imports/utils/debounce';
import { throttle } from '/imports/utils/throttle';
import LocatedErrorBoundary from '/imports/ui/components/common/error-boundary/located-error-boundary/component';
import FallbackView from '/imports/ui/components/common/fallback-errors/fallback-view/component';
import TooltipContainer from '/imports/ui/components/common/tooltip/container';
import { StyleSheetManager } from 'styled-components';

const intlMessages = defineMessages({
  presentationLabel: {
    id: 'app.presentationUploder.title',
    description: 'presentation area element label',
  },
  downloadLabel: {
    id: 'app.presentation.downloadLabel',
    description: 'label for downloadable presentations',
  },
  slideContentStart: {
    id: 'app.presentation.startSlideContent',
    description: 'Indicate the slide content start',
  },
  slideContentEnd: {
    id: 'app.presentation.endSlideContent',
    description: 'Indicate the slide content end',
  },
  slideContentChanged: {
    id: 'app.presentation.changedSlideContent',
    description: 'Indicate the slide content has changed',
  },
  noSlideContent: {
    id: 'app.presentation.emptySlideContent',
    description: 'No content available for slide',
  },
  currentSlide: {
    id: 'app.presentation.currentSlide',
    description: 'Label for current slide',
  },
  nextSlide: {
    id: 'app.presentation.nextSlide',
    description: 'Label for next slide',
  },
  noCurrentSlide: {
    id: 'app.presentation.noCurrentSlide',
    description: 'Message shown when current slide is unavailable',
  },
  noNextSlide: {
    id: 'app.presentation.noNextSlide',
    description: 'Message shown when next slide is unavailable',
  },
  noNotes: {
    id: 'app.presentation.noNotes',
    description: 'Message shown when slide notes are unavailable',
  },
  presentationHeader: {
    id: 'playback.player.presentation.wrapper.aria',
    description: 'Aria label for header navigation',
  },
});

const { isSafari } = browserInfo;
const FULLSCREEN_CHANGE_EVENT = isSafari
  ? 'webkitfullscreenchange'
  : 'fullscreenchange';

const getToolbarHeight = (doc = document) => {
  let height = 0;
  const toolbarEl = doc.getElementById('presentationToolbarWrapper');
  if (toolbarEl) {
    const { clientHeight } = toolbarEl;
    height = clientHeight;
  }
  return height;
};

const getStyleSheetCssText = (style) => {
  try {
    const rules = Array.from(style.sheet?.cssRules ?? []);

    if (rules.length > 0) {
      return rules.map((rule) => rule.cssText).join('\n');
    }
  } catch (error) {
    console.warn(
      'Failed to read a DarkReader CSS rule for the presentation popup',
      error,
    );
  }

  return style.textContent || '';
};

const syncDarkReaderStylesToPopup = (sourceDocument, targetDocument) => {
  // Remove the previous DarkReader styles from the popup.
  targetDocument
    .querySelectorAll(
      'style.darkreader, style[data-popup-darkreader-mirror]',
    )
    .forEach((style) => style.remove());

  // Synchronize DarkReader attributes on <html>.
  Array.from(targetDocument.documentElement.attributes)
    .filter((attr) => attr.name.startsWith('data-darkreader'))
    .forEach((attr) => {
      targetDocument.documentElement.removeAttribute(attr.name);
    });

  Array.from(sourceDocument.documentElement.attributes)
    .filter((attr) => attr.name.startsWith('data-darkreader'))
    .forEach((attr) => {
      targetDocument.documentElement.setAttribute(
        attr.name,
        attr.value,
      );
    });

  const darkReaderStyles = Array.from(
    sourceDocument.querySelectorAll('style.darkreader'),
  );

  // DarkReader is disabled.
  if (darkReaderStyles.length === 0) return;

  const syncStyles = darkReaderStyles.filter(
    (style) => style.classList.contains('darkreader--sync'),
  );

  const nonSyncStyles = darkReaderStyles.filter(
    (style) => !style.classList.contains('darkreader--sync'),
  );

  // Copy the non-sync DarkReader styles.
  nonSyncStyles.forEach((sourceStyle) => {
      const targetStyle = targetDocument.createElement('style');

      Array.from(sourceStyle.attributes).forEach((attr) => {
        targetStyle.setAttribute(attr.name, attr.value);
      });

      targetStyle.textContent = getStyleSheetCssText(sourceStyle);

      targetDocument.head.appendChild(targetStyle);
    });

  // Collect all darkreader--sync rules into one stylesheet.
  const syncCssText = syncStyles
    .flatMap((style) => {
      try {
        return Array.from(style.sheet?.cssRules ?? [])
          .map((rule) => rule.cssText);
      } catch (error) {
        console.warn(
          'Failed to read a DarkReader sync rule for the presentation popup',
          error,
        );
        return [];
      }
    })
    .join('\n');

  if (syncCssText === '') return;

  const mirror = targetDocument.createElement('style');
  mirror.setAttribute('data-popup-darkreader-mirror', '');
  mirror.textContent = syncCssText;

  // Keep DarkReader overrides at the end of <head>.
  targetDocument.head.appendChild(mirror);
};

const IGNORE_PRESENTATION_RESTORATION_TIMEOUT = 5000;

class Presentation extends PureComponent {
  constructor() {
    super();

    this.state = {
      presentationWidth: 0,
      presentationHeight: 0,
      zoom: 100,
      isFullscreen: false,
      tldrawAPI: null,
      isPanning: false,
      tldrawIsMounting: true,
      isToolbarVisible: true,
      hadPresentation: false,
      ignorePresentationRestoring: true,
      currentSlideNote: '',
      presenterView: null,
      presenterAnnotations: null,
    };

    const PAN_ZOOM_INTERV = window.meetingClientSettings.public.presentation.panZoomInterval || 200;

    this.getSvgRef = this.getSvgRef.bind(this);
    this.zoomChanger = debounce(this.zoomChanger.bind(this), 200);
    this.updateLocalPosition = this.updateLocalPosition.bind(this);
    this.panAndZoomChanger = throttle(this.panAndZoomChanger.bind(this), PAN_ZOOM_INTERV);
    this.fitToWidthHandler = this.fitToWidthHandler.bind(this);
    this.onFullscreenChange = this.onFullscreenChange.bind(this);
    this.fullscreenDocument = null;
    this.getPresentationSizesAvailable = this.getPresentationSizesAvailable.bind(this);
    this.handleResize = debounce(this.handleResize.bind(this), 200);
    this.setTldrawAPI = this.setTldrawAPI.bind(this);
    this.setIsPanning = this.setIsPanning.bind(this);
    this.setIsToolbarVisible = this.setIsToolbarVisible.bind(this);
    this.handlePanShortcut = this.handlePanShortcut.bind(this);
    this.renderPresentationMenu = this.renderPresentationMenu.bind(this);
    this.renderPresentationContents = this.renderPresentationContents.bind(this);
    this.detachPresentation = this.detachPresentation.bind(this);

    this.onResize = () => setTimeout(this.handleResize.bind(this), 0);
    this.setPresentationRef = this.setPresentationRef.bind(this);
    this.setTldrawIsMounting = this.setTldrawIsMounting.bind(this);
    this.loadCurrentSlideNote = this.loadCurrentSlideNote.bind(this);
    this.handlePresentationNotesUpdated = this.handlePresentationNotesUpdated.bind(this);
    this.handlePresenterViewChange = this.handlePresenterViewChange.bind(this);
    this.presenterAnnotationsObjectUrl = null;
    this.resizeWindow = null;
    Session.setItem('componentPresentationWillUnmount', false);
  }

  static getDerivedStateFromProps(props, state) {
    const { prevProps } = state;
    const stateChange = { prevProps: props };

    if (
      props.userIsPresenter
      && (!prevProps || !prevProps.userIsPresenter)
      && props.currentSlide
      && props.slidePosition
    ) {
      let potentialZoom = 100 / (props.slidePosition.viewBoxWidth / props.slidePosition.width);
      potentialZoom = Math.max(
        HUNDRED_PERCENT,
        Math.min(MAX_PERCENT, potentialZoom),
      );
      stateChange.zoom = potentialZoom;
    }

    if (!prevProps) return stateChange;

    // When presenter is changed or slide changed we reset localPosition
    if (
      prevProps.currentSlide?.id !== props.currentSlide?.id
      || prevProps.userIsPresenter !== props.userIsPresenter
    ) {
      stateChange.localPosition = undefined;
    }

    return stateChange;
  }

  componentDidMount() {
    this.getInitialPresentationSizes();
    if (this.refPresentationContainer) {
      this.refPresentationContainer.addEventListener(
        'keydown',
        this.handlePanShortcut,
      );
      this.refPresentationContainer.addEventListener(
        'keyup',
        this.handlePanShortcut,
      );
    }
    this.updateFullscreenChangeListener();
    this.updateResizeListener(window);

    const {
      currentSlide,
      slidePosition,
      totalPages,
      layoutContextDispatch,
      currentPresentationId,
    } = this.props;

    if (currentPresentationId) {
      this.setState({
        hadPresentation: true,
      });
    }

    if (currentSlide) {
      layoutContextDispatch({
        type: ACTIONS.SET_PRESENTATION_NUM_CURRENT_SLIDE,
        value: currentSlide.num,
      });
      layoutContextDispatch({
        type: ACTIONS.SET_PRESENTATION_CURRENT_SLIDE_SIZE,
        value: {
          width: slidePosition.width,
          height: slidePosition.height,
        },
      });
      layoutContextDispatch({
        type: ACTIONS.SET_PRESENTATION_SLIDES_LENGTH,
        value: totalPages,
      });
    } else {
      layoutContextDispatch({
        type: ACTIONS.SET_PRESENTATION_SLIDES_LENGTH,
        value: 0,
      });
    }

    window.addEventListener(
      'presentationNotesUpdated',
      this.handlePresentationNotesUpdated,
    );

    this.loadCurrentSlideNote();

    setTimeout(() => {
      this.setState({ ignorePresentationRestoring: false });
    }, IGNORE_PRESENTATION_RESTORATION_TIMEOUT);
  }

  componentDidUpdate(prevProps) {
    const {
      slidePosition,
      presentationIsOpen,
      currentSlide,
      setPresentationIsOpen,
      restoreOnUpdate,
      layoutContextDispatch,
      userIsPresenter,
      isPresentationDetached,
      popupWindow,
      presentationBounds,
      numCameras,
      intl,
      totalPages,
      currentPresentationId,
      fitToWidth,
      isDefaultPresentation,
      setPresentationFitToWidth,
    } = this.props;
    const {
      presentationWidth,
      presentationHeight,
      zoom,
      isPanning,
      presentationId,
      hadPresentation,
      ignorePresentationRestoring,
    } = this.state;
    const {
      numCameras: prevNumCameras,
      presentationBounds: prevPresentationBounds,
    } = prevProps;

    const presenterRoleLost = (
      prevProps.userIsPresenter
      && !userIsPresenter
    );

    const presenterToolClosed = (
      prevProps.isPresentationDetached
      && !isPresentationDetached
    );

    const presenterToolOpened = (
      !prevProps.isPresentationDetached
      && isPresentationDetached
    );

    const presenterAnnotationSlideChanged = (
      prevProps.currentSlide?.id !== currentSlide?.id
      || prevProps.currentPresentationId !== currentPresentationId
    );

    if (
      presenterToolClosed
      || presenterAnnotationSlideChanged
    ) {
      this.clearPresenterAnnotations();
    }

    if (presenterToolClosed) {
      this.setState({ currentSlideNote: '' });
    }

    if (numCameras !== prevNumCameras && !isPresentationDetached) {
      this.onResize();
    }

    // Update the resize listener and presentation size
    //  when moving between main window and the popup.
    if (popupWindow !== prevProps.popupWindow) {
      this.updateResizeListener(popupWindow || window);
      // calling this is necessary for merging the resized popup to the main window.
      this.onResize();
    }

    if (totalPages !== prevProps.totalPages) {
      layoutContextDispatch({
        type: ACTIONS.SET_PRESENTATION_SLIDES_LENGTH,
        value: totalPages,
      });
    }

    if (
      currentSlide?.num != null
      && prevProps?.currentSlide?.num != null
      && currentSlide?.num !== prevProps.currentSlide?.num
    ) {
      addAlert(
        intl.formatMessage(intlMessages.slideContentChanged, {
          slideNumber: currentSlide.num,
        }),
      );
    }

    if (prevProps?.slidePosition && slidePosition) {
      const { width: prevWidth, height: prevHeight } = prevProps.slidePosition;
      const { width: currWidth, height: currHeight } = slidePosition;

      if (prevWidth !== currWidth || prevHeight !== currHeight) {
        layoutContextDispatch({
          type: ACTIONS.SET_PRESENTATION_CURRENT_SLIDE_SIZE,
          value: {
            width: currWidth,
            height: currHeight,
          },
        });
      }
      const presentationChanged = presentationId && presentationId !== currentPresentationId;

      if (
        !presentationIsOpen
        && restoreOnUpdate
        && (currentSlide || presentationChanged)
        && !ignorePresentationRestoring
      ) {
        const slideChanged = currentSlide.id !== prevProps.currentSlide.id;
        const positionChanged = slidePosition.viewBoxHeight
            !== prevProps.slidePosition.viewBoxHeight
          || slidePosition.viewBoxWidth !== prevProps.slidePosition.viewBoxWidth;
        if (
          slideChanged
          || positionChanged
          || (presentationChanged && (hadPresentation || !isDefaultPresentation))
        ) {
          setPresentationIsOpen(layoutContextDispatch, !presentationIsOpen);
        }
      }

      if (presentationChanged) {
        this.setState({
          presentationId: currentPresentationId,
          hadPresentation: true,
        });
      }

      if (
        presentationBounds !== prevPresentationBounds
        || (!presentationWidth && !presentationHeight)
      ) this.onResize();
    } else if (slidePosition) {
      const { width: currWidth, height: currHeight } = slidePosition;

      layoutContextDispatch({
        type: ACTIONS.SET_PRESENTATION_CURRENT_SLIDE_SIZE,
        value: {
          width: currWidth,
          height: currHeight,
        },
      });
      layoutContextDispatch({
        type: ACTIONS.SET_PRESENTATION_NUM_CURRENT_SLIDE,
        value: currentSlide.num,
      });
    }

    if (presenterRoleLost && isPresentationDetached) {
      this.detachPresentation();
    }

    if (
      (zoom <= HUNDRED_PERCENT && isPanning && !fitToWidth)
      || presenterRoleLost
    ) {
      this.setIsPanning();
    }

    if (presenterRoleLost && fitToWidth) {
      setPresentationFitToWidth(false);
    }

    const slideChanged = (
      currentSlide?.svgUri !== prevProps.currentSlide?.svgUri
    );

    if (
      presenterToolOpened
      || (isPresentationDetached && slideChanged)
    ) {
      this.loadCurrentSlideNote();
    }
    this.updateFullscreenChangeListener();
  }

  componentWillUnmount() {
    Session.setItem('componentPresentationWillUnmount', true);
    const { fullscreenContext, layoutContextDispatch, popupWindow } = this.props;

    if (this.resizeWindow) {
      this.resizeWindow.removeEventListener('resize', this.onResize, false);
      this.resizeWindow = null;
    }

    window.removeEventListener(
      'presentationNotesUpdated',
      this.handlePresentationNotesUpdated,
    );

    if (this.refPresentationContainer) {
      this.refPresentationContainer.removeEventListener(
        'keydown',
        this.handlePanShortcut,
      );
      this.refPresentationContainer.removeEventListener(
        'keyup',
        this.handlePanShortcut,
      );
    }

    if (this.fullscreenDocument) {
      this.fullscreenDocument.removeEventListener(
        FULLSCREEN_CHANGE_EVENT,
        this.onFullscreenChange,
      );
      this.fullscreenDocument = null;
    }

    if (this.presenterAnnotationsObjectUrl) {
      URL.revokeObjectURL(this.presenterAnnotationsObjectUrl);
      this.presenterAnnotationsObjectUrl = null;
    }

    if (fullscreenContext) {
      layoutContextDispatch({
        type: ACTIONS.SET_FULLSCREEN_ELEMENT,
        value: {
          element: '',
          group: '',
        },
      });
    }

    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    } 
  }

  detachPresentation() {
    const {
      slidePosition,
      isPresentationDetached,
      popupWindow,
      toggleDetachPresentation,
    } = this.props;

    
    if (!isPresentationDetached) {
      const svgDimensions = this.calculateSize(slidePosition);
      const toolbarHeight = getToolbarHeight();
      const popup = window.open('', '_blank',
        `innerwidth=${svgDimensions.width},innerheight=${svgDimensions.height + toolbarHeight},resizable,scrollbars`);
      if (!popup) return;
      popup.document.title = 'BigBlueButton Portal Window';
      // The popup content is absolutely positioned, so it does not contribute
      // to the body width. Keep the body sized to the popup viewport.
      popup.document.body.style.width = '100%';
      // Copying the attributes of <html>, so that the bbb-icons font looks a bit smaller
      const mainHtml = document.documentElement; // メインウィンドウの <html>
      const popupHtml = popup.document.documentElement;
      // class
      popupHtml.className = mainHtml.className;
      // style, which includes font-size: 14px
      popupHtml.style.cssText = mainHtml.style.cssText;
      
      // Copy all attributes (<html> extensions including DarkReader, which may not work anyway)
      for (const attr of mainHtml.attributes) {
        popupHtml.setAttribute(attr.name, attr.value);
      }

      // headの中身をコピー
      const headElements = document.head.cloneNode(true).childNodes;
      headElements.forEach((node) => {
        // script要素など重複実行したくないものを除外する
        if (node.nodeName !== 'SCRIPT') {
          popup.document.head.appendChild(node.cloneNode(true));
        }
      });

      // Firefox specific configuration
      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
      if (isFirefox) {
        // Add base URL (perhaps only necessary for Firefox to show tldraw icons
        const base = popup.document.createElement('base');
        base.href = window.location.origin + '/';
        popup.document.head.appendChild(base);

        // Explicitely copy bbb-icons.css to show bbb-icons
        fetch('stylesheets/bbb-icons.css')
          .then(res => res.text())
          .then(css => {
            const style = popup.document.createElement('style');
            style.textContent = css;
            popup.document.head.appendChild(style);
          });
        // Explicitly set FontFace to show bbb-icons
        const fonts = [
          { name: 'bbb-icons', url: '/html5client/fonts/BbbIcons/bbb-icons.woff2' },
        ];
        fonts.forEach(({ name, url }) => {
          const font = new FontFace(name, `url(${window.location.origin}${url})`);
          font.load().then(loaded => popup.document.fonts.add(loaded));
        });
      }
      // (26.3.10) After deployment, the production mode app shows the presentation in a wrong place (much lower than usual).
      // When the presentation is rendered in a separate popup window using a React Portal, some styles generated
      //  by Emotion (used by Material UI) are not automatically applied in the popup document.
      // In development mode, Emotion often injects CSS rules directly as text nodes inside 
      //  `<style data-emotion>` elements, so cloning these elements works as expected. 
      // However, in the production build, Emotion frequently inserts styles using the CSSOM API (`insertRule`). 
      // In this case the `<style>` elements appear empty in the DOM, and simply cloning them does not copy the actual CSS rules.
      // As a result, essential styles (for example the `position: fixed` rule used by MUI modal/popover components) 
      //  are missing in the popup window, which causes layout issues such as the presentation being vertically shifted.
      // The solution is to explicitly copy the CSS rules from the Emotion stylesheets (`style.sheet.cssRules`)
      //  into new `<style>` elements in the popup document, ensuring that the popup window receives the same 
      //  computed styles as the main document.
      document.querySelectorAll('style[data-emotion]').forEach((style) => {
        if (style.textContent.trim() !== '') return; // dev mode already has CSS
        const sheet = style.sheet;
        if (!sheet) return;
        const newStyle = popup.document.createElement('style');
        popup.document.head.appendChild(newStyle);
        const newSheet = newStyle.sheet;
        if (!newSheet) return;
        Array.from(sheet.cssRules).forEach((rule) => {
          try {
            newSheet.insertRule(rule.cssText);
          } catch (error) {
            console.warn(
              'Failed to copy an Emotion CSS rule to the presentation popup',
              error,
            );
          }
        });
      });

      // tldraw-original(?) fonts injection,
      //  this fix the inconsistency of var(--tl-font-draw) between popup and main window.
      const fonts = [
        { name: 'tldraw_draw', url: '/html5client/fonts/tldraw/Shantell_Sans-Tldrawish.woff2' },
        { name: 'tldraw_sans', url: '/html5client/fonts/tldraw/IBMPlexSans-Medium.woff2' },
        { name: 'tldraw_serif', url: '/html5client/fonts/tldraw/IBMPlexSerif-Medium.woff2' },
        { name: 'tldraw_mono', url: '/html5client/fonts/tldraw/IBMPlexMono-Medium.woff2' },
      ];
      fonts.forEach(({ name, url }) => {
        const font = new FontFace(name, `url(${window.location.origin}${url})`);
        font.load().then(loaded => popup.document.fonts.add(loaded));
      });

      // Remove cursor style from the class tl-canvas,
      //  otherwise cursor stays the same when pencil, text, line, note
      //  tools are selected before popping up.
      // Remove height from the class tlui-toolbar__tools
      //  and remove height and width from the class tlui-icon,
      //  otherwise toolbar shrunken when enlarging the popup window
      //  that was detached when the toolbar was horizontally arranged.
      Array.from(popup.document.styleSheets).forEach(styleSheet => {
        try {
          const rules = styleSheet.cssRules || styleSheet.rules;
          if (!rules) return;

          for (let i = rules.length - 1; i >= 0; i--) {
            const rule = rules[i];
            if (rule.selectorText && rule.selectorText.includes('.tl-canvas')) {
              if (rule.style && rule.style.cursor) {
                if ((rule.style.cursor.indexOf('pencil.png') > -1) ||
                    (rule.style.cursor.indexOf('text.png') > -1) ||
                   (rule.style.cursor.indexOf('line.png') > -1) ||
                    (rule.style.cursor.indexOf('square.png') > -1) ){
                  rule.style.removeProperty('cursor');
                }
              }
            } else if
               (rule.selectorText &&
                rule.selectorText.includes('.tlui-toolbar__tools.tlui-toolbar__tools__mobile')) {
              if (rule.style && rule.style.height) {
                rule.style.removeProperty('height');
              }
            } else if
               (rule.selectorText &&
                rule.selectorText.includes('.tlui-layout__mobile .tlui-button__tool > .tlui-icon')) {
              if (rule.style && rule.style.height) {
                rule.style.removeProperty('height');
              }
              if (rule.style && rule.style.width) {
                rule.style.removeProperty('width');
              }
            }
          }
        } catch (e) {
          console.warn('Failed to copy style sheets:', e);
        }
      });

      syncDarkReaderStylesToPopup(document, popup.document);
      
      toggleDetachPresentation(popup);

      const closePopup = () => {
        if (popup && !popup.closed) popup.close();
      };

      const handleDarkModeChange = () => {
        window.requestAnimationFrame(() => {
          if (popup.closed) return;

          syncDarkReaderStylesToPopup(
            document,
            popup.document,
          );
        });
      };

      const handlePopupBeforeUnload = () => {
        window.removeEventListener('beforeunload', closePopup);
        window.removeEventListener('darkmodechange', handleDarkModeChange);
        toggleDetachPresentation(null);
      };

      window.addEventListener('beforeunload', closePopup);

      popup.addEventListener(
        'beforeunload',
        handlePopupBeforeUnload,
      );

      window.addEventListener( 'darkmodechange',
        handleDarkModeChange,
      );
    } else {
      // to explicitely exit fullsreen; we do not need setState "isFullscreen: false".
      //  (in case user directly merge popup when it is fullscreen)
      this.props.layoutContextDispatch({
        type: ACTIONS.SET_FULLSCREEN_ELEMENT,
        value: { element: '', group: '' },
      });
      // Basically the app does not reach here...
      popupWindow?.close();
      toggleDetachPresentation(null);
    }
  }

  handlePanShortcut(e) {
    const { userIsPresenter } = this.props;
    const { isPanning } = this.state;
    if (e.keyCode === SPACE && userIsPresenter) {
      switch (e.type) {
        case 'keyup':
          return isPanning && this.setIsPanning();
        case 'keydown':
          return !isPanning && this.setIsPanning();
        default:
      }
    }
    return null;
  }

  handleResize() {
    const {
      isPresentationDetached,
    } = this.props;

    let presentationSizes;

    if (isPresentationDetached) {
      const targetWin = this.resizeWindow;
      if (!targetWin) return;

      const toolbarHeight = getToolbarHeight(targetWin.document);

      presentationSizes = {
        presentationHeight: targetWin.innerHeight - toolbarHeight,
        presentationWidth: targetWin.innerWidth,
      };
    } else {
      presentationSizes = this.getPresentationSizesAvailable();
    }

    if (Object.keys(presentationSizes).length > 0) {
      // updating the size of the space available for the slide
      if (!Session.getItem('componentPresentationWillUnmount')) {
        this.setState({
          presentationHeight: presentationSizes.presentationHeight,
          presentationWidth: presentationSizes.presentationWidth,
        });
      }
    }
  }

  onFullscreenChange() {
    const {
      isFullscreen,
    } = this.state;

    const {
      isPresentationDetached,
      layoutContextDispatch,
    } = this.props;

    const presentationContainer = this.refPresentationContainer;
    if (!presentationContainer) return;

    const fullscreenElement = isPresentationDetached
      ? presentationContainer.ownerDocument.documentElement
      : presentationContainer;

    const newIsFullscreen = FullscreenService.isFullScreen(fullscreenElement);

    if (isPresentationDetached && !newIsFullscreen) {
      layoutContextDispatch({
        type: ACTIONS.SET_FULLSCREEN_ELEMENT,
        value: {
          element: '',
          group: '',
        },
      });
    }
    if (isFullscreen !== newIsFullscreen) {
      this.setState({ isFullscreen: newIsFullscreen });
    }
  }

  updateResizeListener(targetWindow) {
    if (this.resizeWindow === targetWindow) return;

    if (this.resizeWindow) {
      this.resizeWindow.removeEventListener('resize', this.onResize, false);
    }

    this.resizeWindow = targetWindow;

    if (this.resizeWindow) {
      this.resizeWindow.addEventListener('resize', this.onResize, false);
    }
  }

  updateFullscreenChangeListener() {
    const fullscreenDocument = this.refPresentationContainer?.ownerDocument;

    if (!fullscreenDocument || fullscreenDocument === this.fullscreenDocument) {
      return;
    }

    if (this.fullscreenDocument) {
      this.fullscreenDocument.removeEventListener(
        FULLSCREEN_CHANGE_EVENT,
        this.onFullscreenChange,
      );
    }

    this.fullscreenDocument = fullscreenDocument;

    this.fullscreenDocument.addEventListener(
      FULLSCREEN_CHANGE_EVENT,
      this.onFullscreenChange,
    );
  }

  setTldrawAPI(api) {
    this.setState({
      tldrawAPI: api,
    });
  }

  setTldrawIsMounting(value) {
    this.setState({ tldrawIsMounting: value });
  }

  setIsPanning() {
    this.setState((prevState) => ({
      isPanning: !prevState.isPanning,
    }));
  }

  setIsToolbarVisible(isVisible) {
    this.setState({
      isToolbarVisible: isVisible,
    });
  }

  setPresentationRef(ref) {
    this.refPresentationContainer = ref;
  }

  // returns a ref to the svg element, which is required by a WhiteboardOverlay
  // to transform screen coordinates to svg coordinate system
  getSvgRef() {
    return this.svggroup;
  }

  getPresentationSizesAvailable() {
    const {
      presentationBounds,
      presentationAreaSize: newPresentationAreaSize,
    } = this.props;
    const presentationSizes = {
      presentationWidth: 0,
      presentationHeight: 0,
    };

    if (newPresentationAreaSize) {
      presentationSizes.presentationWidth = newPresentationAreaSize.presentationAreaWidth;
      presentationSizes.presentationHeight = newPresentationAreaSize.presentationAreaHeight
        - (getToolbarHeight() || 0);
      return presentationSizes;
    }

    presentationSizes.presentationWidth = presentationBounds.width;
    presentationSizes.presentationHeight = presentationBounds.height;
    return presentationSizes;
  }

  getInitialPresentationSizes() {
    // determining the presentationWidth and presentationHeight (available
    // space for the svg) on the initial load

    const presentationSizes = this.getPresentationSizesAvailable();
    if (Object.keys(presentationSizes).length > 0) {
      // setting the state of the available space for the svg
      this.setState({
        presentationHeight: presentationSizes.presentationHeight,
        presentationWidth: presentationSizes.presentationWidth,
      });
    }
  }

  zoomChanger(zoom) {
    const { currentSlide } = this.props;
    let boundZoom = parseInt(zoom, 10);
    const min = currentSlide?.infiniteWhiteboard ? MIN_PERCENT : HUNDRED_PERCENT;
    if (boundZoom < min) {
      boundZoom = min;
    } else if (boundZoom > MAX_PERCENT) {
      boundZoom = MAX_PERCENT;
    }
    this.setState({ zoom: boundZoom });
  }

  fitToWidthHandler() {
    const { setPresentationFitToWidth, fitToWidth } = this.props;
    this.setState(
      {
        zoom: HUNDRED_PERCENT,
      },
      () => {
        setPresentationFitToWidth(!fitToWidth);
      },
    );
  }

  updateLocalPosition(x, y, width, height, zoom) {
    this.setState({
      localPosition: {
        x,
        y,
        width,
        height,
      },
      zoom,
    });
  }

  calculateSize(viewBoxDimensions) {
    const { presentationHeight, presentationWidth } = this.state;

    const {
      userIsPresenter, currentSlide, slidePosition, fitToWidth,
    } = this.props;

    if (!currentSlide || !slidePosition) {
      return { width: 0, height: 0 };
    }

    const originalWidth = slidePosition.width;
    const originalHeight = slidePosition.height;
    const viewBoxWidth = viewBoxDimensions.width;
    const viewBoxHeight = viewBoxDimensions.height;

    let svgWidth;
    let svgHeight;

    if (!userIsPresenter) {
      svgWidth = (presentationHeight * viewBoxWidth) / viewBoxHeight;
      if (presentationWidth < svgWidth) {
        svgHeight = (presentationHeight * presentationWidth) / svgWidth;
        svgWidth = presentationWidth;
      } else {
        svgHeight = presentationHeight;
      }
    } else if (!fitToWidth) {
      svgWidth = (presentationHeight * originalWidth) / originalHeight;
      if (presentationWidth < svgWidth) {
        svgHeight = (presentationHeight * presentationWidth) / svgWidth;
        svgWidth = presentationWidth;
      } else {
        svgHeight = presentationHeight;
      }
    } else {
      svgWidth = presentationWidth;
      svgHeight = (svgWidth * originalHeight) / originalWidth;
      if (svgHeight > presentationHeight) svgHeight = presentationHeight;
    }

    if (typeof svgHeight !== 'number' || typeof svgWidth !== 'number') {
      return { width: 0, height: 0 };
    }

    return {
      width: svgWidth,
      height: svgHeight,
    };
  }

  panAndZoomChanger(w, h, x, y) {
    const { zoomSlide } = this.props;
    zoomSlide(w, h, x, y);
  }

  async loadCurrentSlideNote() {
    const { currentSlide, isPresentationDetached } = this.props;

    if (!isPresentationDetached || !currentSlide?.noteUri) {
      this.setState({ currentSlideNote: '' });
      return;
    }

    const noteUri = currentSlide.noteUri;

    const isCurrentNote = () => (
      this.props.isPresentationDetached
      && this.props.currentSlide?.noteUri === noteUri
    );

    try {
      const response = await fetch(noteUri, {
        cache: 'no-store',
      });

      // The slide may have changed while waiting for the response.
      if (!isCurrentNote()) return;

      if (!response.ok) {
        if (response.status === 404) {
          console.info(
            'Slide note is not available yet. Ignore the 404 error above.',
          );
        } else {
          console.error(
            `Failed to load slide note: HTTP ${response.status}`,
          );
        }

        this.setState({ currentSlideNote: '' });
        return;
      }

      const text = await response.text();

      // The slide may also have changed while reading the response body.
      if (!isCurrentNote()) return;

      this.setState({
        currentSlideNote: text.trim(),
      });
    } catch (e) {
      if (!isCurrentNote()) return;

      console.error('Failed to load slide note', e);
      this.setState({ currentSlideNote: '' });
    }
  }

  handlePresentationNotesUpdated(event) {
    const { currentSlide } = this.props;
    const updatedPresentationId = event.detail?.presentationId;

    if (updatedPresentationId !== currentSlide?.presentationId) return;

    this.loadCurrentSlideNote();
  }

  handlePresenterViewChange(presenterView) {
    const currentPageNum = this.props.currentSlide?.num;
    if (
      presenterView
      && Number(presenterView.pageId) !== Number(currentPageNum)
    ) {
      return;
    }
    this.setState({
      presenterView,
    });
  }

  clearPresenterAnnotations = () => {
    const previousObjectUrl =
      this.presenterAnnotationsObjectUrl;

    this.presenterAnnotationsObjectUrl = null;

    if (!this.state.presenterAnnotations) {
      if (previousObjectUrl) {
        URL.revokeObjectURL(previousObjectUrl);
      }
      return;
    }

    this.setState(
      {
        presenterAnnotations: null,
      },
      () => {
        if (previousObjectUrl) {
          URL.revokeObjectURL(previousObjectUrl);
        }
      },
    );
  };

  handlePresenterAnnotationsChange = ({
    presentationId,
    pageId,
    svgMarkup,
  }) => {
    const { currentSlide } = this.props;

    // Ignore an asynchronous result belonging to an old slide.
    if (
      !currentSlide
      || Number(pageId) !== Number(currentSlide.num)
      || (
        presentationId
        && currentSlide.presentationId
        && presentationId !== currentSlide.presentationId
      )
    ) {
      return;
    }

    if (!svgMarkup) {
      this.clearPresenterAnnotations();
      return;
    }

    const svgBlob = new Blob(
      [svgMarkup],
      { type: 'image/svg+xml;charset=utf-8' },
    );

    const nextObjectUrl = URL.createObjectURL(svgBlob);
    const previousObjectUrl =
      this.presenterAnnotationsObjectUrl;

    this.presenterAnnotationsObjectUrl = nextObjectUrl;

    this.setState(
      {
        presenterAnnotations: {
          presentationId,
          pageId,
          objectUrl: nextObjectUrl,
        },
      },
      () => {
        if (
          previousObjectUrl
          && previousObjectUrl !== nextObjectUrl
        ) {
          URL.revokeObjectURL(previousObjectUrl);
        }
      },
    );
  };

  renderPresentationToolbar(svgWidth = 0) {
    const {
      currentSlide,
      isMobile,
      layoutType,
      numCameras,
      fullscreenElementId,
      fullscreenContext,
      layoutContextDispatch,
      presentationIsOpen,
      slidePosition,
      setMultiUserWhiteboardEnabled,
      setMultiUserWhiteboardDisabled,
      multiUserSize,
      multiUser,
      fitToWidth,
      totalPages,
      userIsPresenter,
      hasPoll,
      currentPresentationPage,
      isPresentationDetached,
    } = this.props;
    const { zoom, isPanning, tldrawAPI } = this.state;

    if (!currentSlide) return null;

    const { presentationToolbarMinWidth } = DEFAULT_VALUES;

    const toolbarWidth = (this.refWhiteboardArea && svgWidth > presentationToolbarMinWidth)
      || isMobile
      || (layoutType === LAYOUT_TYPE.VIDEO_FOCUS && numCameras > 0)
      ? svgWidth
      : presentationToolbarMinWidth;
    return (
      <PresentationToolbarContainer
        {...{
          fitToWidth,
          zoom,
          currentSlide,
          slidePosition,
          toolbarWidth,
          fullscreenElementId,
          layoutContextDispatch,
          presentationIsOpen,
          userIsPresenter,
          currentPresentationPage,
          tldrawAPI,
        }}
        setIsPanning={this.setIsPanning}
        isPanning={isPanning}
        currentSlideNum={currentSlide.num}
        presentationId={currentSlide.presentationId}
        zoomChanger={this.zoomChanger}
        fitToWidthHandler={this.fitToWidthHandler}
        isFullscreen={fullscreenContext}
        fullscreenAction={ACTIONS.SET_FULLSCREEN_ELEMENT}
        fullscreenRef={this.refPresentationContainer}
        setMultiUserWhiteboardEnabled={setMultiUserWhiteboardEnabled}
        setMultiUserWhiteboardDisabled={setMultiUserWhiteboardDisabled}
        multiUserSize={multiUserSize}
        multiUser={multiUser}
        whiteboardId={currentSlide?.id}
        numberOfSlides={totalPages}
        layoutSwapped={false}
        hasPoll={hasPoll}
        isPresentationDetached={isPresentationDetached}
      />
    );
  }

  renderPresentationDownload() {
    const { presentationIsDownloadable, downloadPresentationUri } = this.props;

    if (!presentationIsDownloadable || !downloadPresentationUri) return null;

    const handleDownloadPresentation = () => {
      window.open(downloadPresentationUri);
    };

    return (
      <DownloadPresentationButton
        handleDownloadPresentation={handleDownloadPresentation}
        dark
      />
    );
  }

  renderPresentationMenu() {
    const {
      intl,
      fullscreenElementId,
      layoutContextDispatch,
      userIsPresenter,
      currentSlide,
      currentUser,
      isPresentationDetached,
    } = this.props;
    const { tldrawAPI, isToolbarVisible } = this.state;

    return (
      <PresentationMenu
        fullscreenRef={this.refPresentationContainer}
        tldrawAPI={tldrawAPI}
        elementName={intl.formatMessage(intlMessages.presentationLabel)}
        elementId={fullscreenElementId}
        layoutContextDispatch={layoutContextDispatch}
        setIsToolbarVisible={this.setIsToolbarVisible}
        isToolbarVisible={isToolbarVisible}
        amIPresenter={userIsPresenter}
        slideNum={currentSlide?.num}
        currentUser={currentUser}
        whiteboardId={currentSlide?.id}
        detachPresentation={this.detachPresentation}
        isPresentationDetached={isPresentationDetached}
      />
    );
  }

  renderPresentationContents() {
    const {
      userIsPresenter,
      hasWBAccess,
      currentSlide,
      slidePosition,
      presentationBounds,
      fullscreenContext,
      isMobile,
      layoutType,
      numCameras,
      currentPresentationId,
      intl,
      fullscreenElementId,
      layoutContextDispatch,
      presentationIsOpen,
      darkTheme,
      isViewersAnnotationsLocked,
      fitToWidth,
      annotationStreamData,
      initialPageAnnotations,
      refetchInitialPageAnnotations,
      restoreOnUpdate,
      isPresentationDetached,
      popupWindow,
    } = this.props;

    const {
      isFullscreen,
      localPosition,
      zoom,
      tldrawIsMounting,
      isPanning,
      tldrawAPI,
      isToolbarVisible,
      presentationWidth,
    } = this.state;

    let viewBoxDimensions;

    if (userIsPresenter && localPosition) {
      viewBoxDimensions = {
        width: localPosition.width,
        height: localPosition.height,
      };
    } else if (slidePosition) {
      viewBoxDimensions = {
        width: slidePosition.viewBoxWidth,
        height: slidePosition.viewBoxHeight,
      };
    } else {
      viewBoxDimensions = {
        width: 0,
        height: 0,
      };
    }

    const svgDimensions = this.calculateSize(viewBoxDimensions);
    const svgHeight = svgDimensions.height;
    const svgWidth = svgDimensions.width;

    const toolbarHeight = getToolbarHeight(isPresentationDetached && popupWindow ? popupWindow.document : document);

    const { presentationToolbarMinWidth } = DEFAULT_VALUES;

    const isLargePresentation = (svgWidth > presentationToolbarMinWidth || isMobile)
      && !(
        layoutType === LAYOUT_TYPE.VIDEO_FOCUS
        && numCameras > 0
        && !fullscreenContext
      );

    const containerWidth = isLargePresentation
      ? svgWidth
      : presentationToolbarMinWidth;

    const slideContent = currentSlide?.content
      ? `${intl.formatMessage(intlMessages.slideContentStart)}
    ${currentSlide.content}
    ${intl.formatMessage(intlMessages.slideContentEnd)}`
      : intl.formatMessage(intlMessages.noSlideContent);

    const isVideoFocus = layoutType === LAYOUT_TYPE.VIDEO_FOCUS;
    const presentationZIndex = fullscreenContext ? presentationBounds.zIndex : undefined;

    const APP_CRASH_METADATA = {
      logCode: 'whiteboard_crash',
      logMessage: 'Possible whiteboard crash',
    };
    const presentationIsHidden = !presentationBounds
      || presentationBounds.width === 0
      || presentationBounds.height === 0;
    if (!presentationIsOpen || presentationIsHidden) return null;

    return (
      <>
        <Styled.PresentationContainer
          role="region"
          data-test="presentationContainer"
          ref={(ref) => {
            this.refPresentationContainer = ref;
          }}
          style={{
            top: isPresentationDetached ? 0 : presentationBounds.top,
            left: isPresentationDetached ? 0 : presentationBounds.left,
            right: isPresentationDetached ? 0 : presentationBounds.right,
            //These do not work on Firefox
            //width: isPresentationDetached ? popupWindow.document.documentElement.clientWidth : presentationBounds.width,
            //height: isPresentationDetached ? popupWindow.document.documentElement.clientHeight : presentationBounds.height,
            width: isPresentationDetached ? popupWindow.innerWidth : presentationBounds.width,
            height: isPresentationDetached ? popupWindow.innerHeight : presentationBounds.height,
            display: !presentationIsOpen ? 'none' : 'flex',
            overflow: 'hidden',
            zIndex: !isVideoFocus ? presentationZIndex : 1,
            background:
              layoutType === isVideoFocus && !fullscreenContext
                ? colorContentBackground
                : null,
          }}
        >
          <h2 className="sr-only">{intl.formatMessage(intlMessages.presentationHeader)}</h2>
          <Styled.Presentation
            ref={(ref) => {
              this.refPresentation = ref;
            }}
          >
            <Styled.SvgContainer
              style={{
                height: svgHeight + toolbarHeight,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: svgDimensions.width < 0 ? 0 : svgDimensions.width,
                  height: svgDimensions.height < 0 ? 0 : svgDimensions.height,
                  textAlign: 'center',
                  display: !presentationIsOpen ? 'none' : 'block',
                  zIndex: 1,
                }}
                id="presentationInnerWrapper"
              >
                {this.renderPresentationDownload()}
                <Styled.VisuallyHidden id="currentSlideText">
                  {slideContent}
                </Styled.VisuallyHidden>
                {((userIsPresenter || hasWBAccess) && (!tldrawIsMounting && presentationWidth > 0 && currentSlide)) && <Styled.ExtraTools {...{isToolbarVisible}}>
                  <TooltipContainer title={intl?.messages["app.shortcut-help.undo"]}>
                    <Styled.Button
                      aria-label={intl?.messages["app.shortcut-help.undo"]}
                      onClick={() => tldrawAPI?.undo()}
                      className="tlui-undo"
                    >
                      <Styled.IconWithMask mask={`${window.meetingClientSettings.public.app.basename}/svgs/tldraw/undo.svg`} />
                    </Styled.Button>
                  </TooltipContainer>
                  <TooltipContainer title={intl?.messages["app.shortcut-help.redo"]}>
                    <Styled.Button
                      aria-label={intl?.messages["app.shortcut-help.redo"]}
                      onClick={() => tldrawAPI?.redo()}
                      className="tlui-redo"
                    >
                      <Styled.IconWithMask mask={`${window.meetingClientSettings.public.app.basename}/svgs/tldraw/redo.svg`} />
                    </Styled.Button>
                  </TooltipContainer>
                </Styled.ExtraTools>}
                {!tldrawIsMounting
                  && presentationWidth > 0
                  && currentSlide
                  && this.renderPresentationMenu()}
                <LocatedErrorBoundary Fallback={FallbackView} logMetadata={APP_CRASH_METADATA}>
                  <WhiteboardContainer
                    whiteboardId={currentSlide?.id}
                    slidePosition={slidePosition}
                    getSvgRef={this.getSvgRef}
                    tldrawAPI={tldrawAPI}
                    setTldrawAPI={this.setTldrawAPI}
                    curPageId={currentSlide?.num.toString() || '0'}
                    svgUri={currentSlide?.svgUri}
                    intl={intl}
                    presentationWidth={svgWidth}
                    presentationHeight={svgHeight}
                    presentationAreaHeight={isPresentationDetached ?
                      popupWindow.innerHeight - toolbarHeight :
                      presentationBounds.height - toolbarHeight}
                    presentationAreaWidth={isPresentationDetached ?
                      popupWindow.innerWidth :
                      presentationBounds.width}
                    isPanning={isPanning}
                    zoomChanger={this.zoomChanger}
                    fitToWidth={fitToWidth}
                    zoomValue={zoom}
                    setTldrawIsMounting={this.setTldrawIsMounting}
                    setIsToolbarVisible={this.setIsToolbarVisible}
                    isFullscreen={isFullscreen}
                    fullscreenAction={ACTIONS.SET_FULLSCREEN_ELEMENT}
                    fullscreenElementId={fullscreenElementId}
                    layoutContextDispatch={layoutContextDispatch}
                    fullscreenRef={this.refPresentationContainer}
                    presentationId={currentPresentationId}
                    darkTheme={darkTheme}
                    isToolbarVisible={isToolbarVisible}
                    isViewersAnnotationsLocked={isViewersAnnotationsLocked}
                    annotationStreamData={annotationStreamData}
                    initialPageAnnotations={initialPageAnnotations}
                    refetchInitialPageAnnotations={refetchInitialPageAnnotations}
                    restoreOnUpdate={restoreOnUpdate}
                    isPresentationDetached={isPresentationDetached}
                    onPresenterViewChange={this.handlePresenterViewChange}
                    onPresenterAnnotationsChange={this.handlePresenterAnnotationsChange}
                  />
                </LocatedErrorBoundary>
                {isFullscreen && <PollingContainer />}
              </div>
              {!tldrawIsMounting && presentationWidth > 0 && (
                <Styled.PresentationToolbar
                  ref={(ref) => {
                    this.refPresentationToolbar = ref;
                  }}
                  style={{
                    width: containerWidth,
                  }}
                  isPresentationDetached={isPresentationDetached}
                >
                  {this.renderPresentationToolbar(svgWidth)}
                </Styled.PresentationToolbar>
              )}
            </Styled.SvgContainer>
          </Styled.Presentation>
        </Styled.PresentationContainer>
      </>
    );
  }

  renderPresenterTool() {
    const {
      currentSlide,
      nextSlide,
      presentationBounds,
      intl,
    } = this.props;

    const {
      currentSlideNote,
      presenterView,
      presenterAnnotations,
    } = this.state;

    if (
      !presentationBounds
      || presentationBounds.width === 0
      || presentationBounds.height === 0
    ) {
      return null;
    }

    if (!currentSlide && !nextSlide) return null;

    const hasNote = !!currentSlideNote;

    const renderSlideImage = (
      slide,
      labelMessage,
      emptyMessage,
      reflectPresenterView = false,
    ) => {
      if (!slide) {
        return (
          <Styled.PresenterToolEmptySlide>
            {intl.formatMessage(emptyMessage)}
          </Styled.PresenterToolEmptySlide>
        );
      }

      const label = intl.formatMessage(labelMessage);

      const presenterViewMatchesSlide = (
        reflectPresenterView
        && presenterView
        && Number(presenterView.pageId) === Number(slide.num)
        && (
          !presenterView.presentationId
          || presenterView.presentationId === slide.presentationId
        )
      );

      const annotationsMatchSlide = (
        reflectPresenterView
        && presenterAnnotations?.objectUrl
        && Number(presenterAnnotations.pageId) === Number(slide.num)
        && (
          !presenterAnnotations.presentationId
          || presenterAnnotations.presentationId === slide.presentationId
        )
      );

      return (
        <Styled.PresenterToolSlideFrame>
          <Styled.PresenterToolSlideLabel>
            {label}
          </Styled.PresenterToolSlideLabel>

          <Styled.PresenterToolSlideContent>
            {presenterViewMatchesSlide ? (
              <Styled.PresenterToolSlideViewport
                $aspectRatio={presenterView.viewportAspectRatio}
              >
                <Styled.PresenterToolTransformedSlideLayer
                  $leftRatio={presenterView.slide.leftRatio}
                  $topRatio={presenterView.slide.topRatio}
                  $widthRatio={presenterView.slide.widthRatio}
                  $heightRatio={presenterView.slide.heightRatio}
                >
                  <Styled.PresenterToolTransformedSlide
                    src={slide.svgUri}
                    alt={`${label} ${slide.num || ''}`}
                  />

                  {annotationsMatchSlide && (
                    <Styled.PresenterToolAnnotationsOverlay
                      src={presenterAnnotations.objectUrl}
                      alt=""
                      aria-hidden="true"
                    />
                  )}
                </Styled.PresenterToolTransformedSlideLayer>

                {presenterView.cursor.visible && (
                  <Styled.PresenterToolCursorDot
                    $leftRatio={presenterView.cursor.leftRatio}
                    $topRatio={presenterView.cursor.topRatio}
                  />
                )}
              </Styled.PresenterToolSlideViewport>
            ) : (
              <Styled.PresenterToolSlideImage
                src={slide.svgUri}
                alt={`${label} ${slide.num || ''}`}
                $compact={!reflectPresenterView}
              />
            )}
          </Styled.PresenterToolSlideContent>
        </Styled.PresenterToolSlideFrame>
      );
    };

    return (
      <Styled.PresenterToolContainer
        style={{
          top: presentationBounds.top,
          left: presentationBounds.left,
          width: presentationBounds.width,
          height: presentationBounds.height,
        }}
      >
        <Styled.PresenterToolSlidesResizable
          defaultSize={{
            width: '50%',
            height: '100%',
          }}
          minWidth="20%"
          maxWidth="80%"
          enable={{
            top: false,
            right: true,
            bottom: false,
            left: false,
            topRight: false,
            bottomRight: false,
            bottomLeft: false,
            topLeft: false,
          }}
          handleComponent={{
            right: <Styled.PresenterToolResizeHandle />,
          }}
        >
          <Styled.PresenterToolSlidesColumn>
            <Styled.PresenterToolCurrentSlideResizable
              defaultSize={{
                width: '100%',
                height: '60%',
              }}
              minHeight="20%"
              maxHeight="85%"
              enable={{
                top: false,
                right: false,
                bottom: true,
                left: false,
                topRight: false,
                bottomRight: false,
                bottomLeft: false,
                topLeft: false,
              }}
            >
              <Styled.PresenterToolSlidePane
                $withBorder
              >
                {renderSlideImage(
                  currentSlide,
                  intlMessages.currentSlide,
                  intlMessages.noCurrentSlide,
                  true,
                )}
              </Styled.PresenterToolSlidePane>
            </Styled.PresenterToolCurrentSlideResizable>

            <Styled.PresenterToolSlidePane>
              {renderSlideImage(
                nextSlide,
                intlMessages.nextSlide,
                intlMessages.noNextSlide,
              )}
            </Styled.PresenterToolSlidePane>
          </Styled.PresenterToolSlidesColumn>
        </Styled.PresenterToolSlidesResizable>

        <Styled.PresenterToolNotesPanel>
          {hasNote ? currentSlideNote : intl.formatMessage(intlMessages.noNotes)}
        </Styled.PresenterToolNotesPanel>
      </Styled.PresenterToolContainer>
    );
  }

  render() {
    const {
      isPresentationDetached,
      popupWindow,
    } = this.props;

    const presentationContent = this.renderPresentationContents();

    if (isPresentationDetached && popupWindow?.document?.head) {
      return (
        <>
          {ReactDOM.createPortal(
            /* Use StyleSheetManager to inject dynamic stylesheet elements of styled component */
            /*  such as isToolbarVisible of Styled.TldrawV2GlobalStyle in whiteboard/styles.js */
            <StyleSheetManager
              target={popupWindow.document.head}
            >   
              {presentationContent}
            </StyleSheetManager>,
            popupWindow.document.body
          )}
          {this.renderPresenterTool()}
        </>
      );
    }
    return presentationContent;
  }
}

export default injectIntl(Presentation);

Presentation.propTypes = {
  // Defines a boolean value to detect whether a current user is a presenter
  userIsPresenter: PropTypes.bool,
  currentSlide: PropTypes.shape({
    presentationId: PropTypes.string.isRequired,
    current: PropTypes.bool.isRequired,
    num: PropTypes.number.isRequired,
    id: PropTypes.string.isRequired,
    imageUri: PropTypes.string.isRequired,
    curPageId: PropTypes.string,
    svgUri: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
  }),
  slidePosition: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    viewBoxWidth: PropTypes.number.isRequired,
    viewBoxHeight: PropTypes.number.isRequired,
  }),
  // current multi-user status
  multiUser: PropTypes.bool.isRequired,
  setPresentationIsOpen: PropTypes.func.isRequired,
  layoutContextDispatch: PropTypes.func.isRequired,
  presentationIsDownloadable: PropTypes.bool,
  currentPresentationId: PropTypes.string,
  presentationIsOpen: PropTypes.bool,
  totalPages: PropTypes.number.isRequired,
  presentationBounds: PropTypes.shape({
    top: PropTypes.number,
    left: PropTypes.number,
    right: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    zIndex: PropTypes.number,
  }),
  restoreOnUpdate: PropTypes.bool.isRequired,
  numCameras: PropTypes.number.isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  isMobile: PropTypes.bool.isRequired,
  fullscreenContext: PropTypes.bool.isRequired,
  presentationAreaSize: PropTypes.shape({
    presentationAreaWidth: PropTypes.number.isRequired,
    presentationAreaHeight: PropTypes.number.isRequired,
  }),
  zoomSlide: PropTypes.func.isRequired,
  setMultiUserWhiteboardEnabled: PropTypes.func.isRequired,
  setMultiUserWhiteboardDisabled: PropTypes.func.isRequired,
  multiUserSize: PropTypes.number.isRequired,
  layoutType: PropTypes.string.isRequired,
  fullscreenElementId: PropTypes.string.isRequired,
  downloadPresentationUri: PropTypes.string,
  darkTheme: PropTypes.bool.isRequired,
};

Presentation.defaultProps = {
  currentSlide: undefined,
  slidePosition: undefined,
  presentationAreaSize: undefined,
  presentationBounds: undefined,
  downloadPresentationUri: undefined,
  userIsPresenter: false,
  presentationIsDownloadable: false,
  currentPresentationId: '',
  presentationIsOpen: true,
};
