import React, { PureComponent, Fragment } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import WhiteboardOverlayContainer from '/imports/ui/components/whiteboard/whiteboard-overlay/container';
import WhiteboardToolbarContainer from '/imports/ui/components/whiteboard/whiteboard-toolbar/container';
import { HUNDRED_PERCENT, MAX_PERCENT } from '/imports/utils/slideCalcUtils';
import { defineMessages, injectIntl } from 'react-intl';
import { toast } from 'react-toastify';
import { Session } from 'meteor/session';
import PresentationToolbarContainer from './presentation-toolbar/container';
import PresentationPlaceholder from './presentation-placeholder/component';
import CursorWrapperContainer from './cursor/cursor-wrapper-container/container';
import AnnotationGroupContainer from '../whiteboard/annotation-group/container';
import PresentationOverlayContainer from './presentation-overlay/container';
import Slide from './slide/component';
import Styled from './styles';
import MediaService, { shouldEnableSwapLayout } from '../media/service';
import PresentationCloseButton from './presentation-close-button/component';
import DownloadPresentationButton from './download-presentation-button/component';
import FullscreenService from '/imports/ui/components/common/fullscreen-button/service';
import Icon from '/imports/ui/components/common/icon/component';
import PollingContainer from '/imports/ui/components/polling/container';
import { ACTIONS, LAYOUT_TYPE } from '../layout/enums';
import DEFAULT_VALUES from '../layout/defaultValues';
import { colorContentBackground } from '/imports/ui/stylesheets/styled-components/palette';
import browserInfo from '/imports/utils/browserInfo';
import PresentationMenu from './presentation-menu/container';
import { addNewAlert } from '../screenreader-alert/service';
import { clearCursors } from '/imports/ui/components/cursor/service';
import { copyStyles } from './service';

const intlMessages = defineMessages({
  presentationLabel: {
    id: 'app.presentationUploder.title',
    description: 'presentation area element label',
  },
  changeNotification: {
    id: 'app.presentation.notificationLabel',
    description: 'label displayed in toast when presentation switches',
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
});

const ALLOW_FULLSCREEN = Meteor.settings.public.app.allowFullscreen;
const OLD_MINIMIZE_BUTTON_ENABLED = Meteor.settings.public.presentation.oldMinimizeButton;
const { isSafari } = browserInfo;
const FULLSCREEN_CHANGE_EVENT = isSafari ? 'webkitfullscreenchange' : 'fullscreenchange';

let presentationWindow = window;
class WindowPortal extends React.PureComponent {
  // Most of the idea and code were copied from https://stackoverflow.com/questions/47909601/onclick-not-working-inside-the-pop-up-opened-via-react-portals
  constructor(props) {
    super(props);
    this.state = { win: null, el: null };
  }

  componentDidMount() {
    const {
      svgSize,
      setEventExternalWindow,
      setPresentationDetached,
      toolbarHeight,
    } = this.props;

    let win = window.open('', '', `innerWidth=${svgSize.width},innerHeight=${svgSize.height+toolbarHeight}`);
    win.document.title = 'BigBlueButton Portal Window';
    win.document.body.style.position = 'relative'; // to center the slide
    copyStyles(document, win.document);
    let el = document.createElement('div');
    win.document.body.appendChild(el);
    presentationWindow = win;
    setEventExternalWindow(win, toolbarHeight);

    win.addEventListener('beforeunload', () => {
      presentationWindow = window;
      setPresentationDetached(false); //for closing the window by X button
    });

    this.setState({ win, el });
  }

  componentWillUnmount() {
    this.state.win.close();
  }

  render() {
    const { el } = this.state;
    if (!el) {
      return null;
    }
    return createPortal(this.props.children, el);
  }
}

class Presentation extends PureComponent {
  constructor() {
    super();

    this.state = {
      presentationWidth: 0,
      presentationHeight: 0,
      showSlide: false,
      zoom: 100,
      fitToWidth: false,
      isFullscreen: false,
      hadPresentation: false,
    };

    this.currentPresentationToastId = null;

    this.getSvgRef = this.getSvgRef.bind(this);
    this.setFitToWidth = this.setFitToWidth.bind(this);
    this.zoomChanger = this.zoomChanger.bind(this);
    this.updateLocalPosition = this.updateLocalPosition.bind(this);
    this.panAndZoomChanger = this.panAndZoomChanger.bind(this);
    this.fitToWidthHandler = this.fitToWidthHandler.bind(this);
    this.onFullscreenChange = this.onFullscreenChange.bind(this);
    this.getPresentationSizesAvailable = this.getPresentationSizesAvailable.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.setEventExternalWindow = this.setEventExternalWindow.bind(this);

    this.onResize = () => setTimeout(this.handleResize.bind(this), 0);
    this.renderCurrentPresentationToast = this.renderCurrentPresentationToast.bind(this);
    this.setPresentationRef = this.setPresentationRef.bind(this);
    Session.set('componentPresentationWillUnmount', false);
  }

  static getDerivedStateFromProps(props, state) {
    const { prevProps } = state;
    const stateChange = { prevProps: props };

    if (props.userIsPresenter
      && (!prevProps || !prevProps.userIsPresenter)
      && props.currentSlide
      && props.slidePosition) {
      let potentialZoom = 100 / (props.slidePosition.viewBoxWidth / props.slidePosition.width);
      potentialZoom = Math.max(HUNDRED_PERCENT, Math.min(MAX_PERCENT, potentialZoom));
      stateChange.zoom = potentialZoom;
    }

    if (!prevProps) return stateChange;

    // When presenter is changed or slide changed we reset localPosition
    if (prevProps.currentSlide?.id !== props.currentSlide?.id
      || prevProps.userIsPresenter !== props.userIsPresenter) {
      stateChange.localPosition = undefined;
    }

    return stateChange;
  }

  componentDidMount() {
    const { isPresentationDetached } = this.props;
    this.getInitialPresentationSizes();
    this.refPresentationContainer
      .addEventListener(FULLSCREEN_CHANGE_EVENT, this.onFullscreenChange);
    if (isPresentationDetached){
      presentationWindow.addEventListener('resize', this.onResize, false);
    } else {
      window.addEventListener('resize', this.onResize, false);
    }

    const {
      currentSlide, slidePosition, layoutContextDispatch,
    } = this.props;

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
    }
  }

  componentDidUpdate(prevProps) {
    const {
      currentPresentation,
      slidePosition,
      layoutSwapped,
      currentSlide,
      publishedPoll,
      toggleSwapLayout,
      restoreOnUpdate,
      layoutContextDispatch,
      userIsPresenter,
      presentationBounds,
      numCameras,
      intl,
      multiUser,
      clearFakeAnnotations,
    } = this.props;

    const { presentationWidth, presentationHeight, hadPresentation } = this.state;
    const {
      numCameras: prevNumCameras,
      presentationBounds: prevPresentationBounds,
      multiUser: prevMultiUser,
    } = prevProps;

    if (prevMultiUser && !multiUser) {
      clearFakeAnnotations();
      clearCursors();
    }

    if (numCameras !== prevNumCameras) {
      this.onResize();
    }

    if (
      currentSlide?.num != null
      && prevProps?.currentSlide?.num != null
      && currentSlide?.num !== prevProps.currentSlide?.num
    ) {
      addNewAlert(intl.formatMessage(intlMessages.slideContentChanged, { 0: currentSlide.num }));
    }

    if (currentPresentation) {
      const downloadableOn = !prevProps?.currentPresentation?.downloadable
        && currentPresentation.downloadable;

      const shouldCloseToast = !(currentPresentation.downloadable && !userIsPresenter);

      if (
        prevProps?.currentPresentation?.name !== currentPresentation.name
        || (downloadableOn && !userIsPresenter)
      ) {
        if (this.currentPresentationToastId) {
          toast.update(this.currentPresentationToastId, {
            autoClose: shouldCloseToast,
            render: this.renderCurrentPresentationToast(),
          });
        } else {
          this.currentPresentationToastId = toast(this.renderCurrentPresentationToast(), {
            onClose: () => { this.currentPresentationToastId = null; },
            autoClose: shouldCloseToast,
            className: 'actionToast currentPresentationToast',
          });
        }
      }

      const downloadableOff = prevProps?.currentPresentation?.downloadable
        && !currentPresentation.downloadable;

      if (this.currentPresentationToastId && downloadableOff) {
        toast.update(this.currentPresentationToastId, {
          autoClose: true,
          render: this.renderCurrentPresentationToast(),
        });
      }

      if (layoutSwapped && restoreOnUpdate && currentSlide && hadPresentation) {
        toggleSwapLayout(layoutContextDispatch);
        this.setState({ hadPresentation: false });
      }
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

      if (layoutSwapped && restoreOnUpdate && !userIsPresenter && currentSlide) {
        const slideChanged = currentSlide.id !== prevProps.currentSlide.id;
        const positionChanged = slidePosition
          .viewBoxHeight !== prevProps.slidePosition.viewBoxHeight
          || slidePosition.viewBoxWidth !== prevProps.slidePosition.viewBoxWidth;
        const pollPublished = publishedPoll && !prevProps.publishedPoll;
        if (slideChanged || positionChanged || pollPublished) {
          toggleSwapLayout(layoutContextDispatch);
        }
      }

      if ((presentationBounds !== prevPresentationBounds) ||
        (!presentationWidth && !presentationHeight)) this.onResize();
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

    if (prevProps.currentSlide && !currentSlide) {
      this.setState({ hadPresentation: true });
    }
  }

  componentWillUnmount() {
    Session.set('componentPresentationWillUnmount', true);
    const { fullscreenContext, layoutContextDispatch, isPresentationDetached } = this.props;

    if (isPresentationDetached) {
      presentationWindow.removeEventListener('resize', this.onResize, false);
    } else {
      window.removeEventListener('resize', this.onResize, false);
    }

    this.refPresentationContainer
      .removeEventListener(FULLSCREEN_CHANGE_EVENT, this.onFullscreenChange);

    if (fullscreenContext) {
      layoutContextDispatch({
        type: ACTIONS.SET_FULLSCREEN_ELEMENT,
        value: {
          element: '',
          group: '',
        },
      });
    }
  }

  handleResize() {
    const { isPresentationDetached } = this.props;
    const presentationSizes = this.getPresentationSizesAvailable();
    if (Object.keys(presentationSizes).length > 0) {
      // updating the size of the space available for the slide
      //This condition enables the resizing of detached window, by removing this condition, the original window start to resize after merging the detached window.
      if (!Session.get('componentPresentationWillUnmount') || !isPresentationDetached) {
        this.setState({
          presentationHeight: presentationSizes.presentationHeight,
          presentationWidth: presentationSizes.presentationWidth,
        });
      }
    }
  }

  setEventExternalWindow (win, toolbarHeight) {
    win.addEventListener('resize', () => {
      this.setState({
        presentationWidth: win.innerWidth,
        presentationHeight: win.innerHeight - toolbarHeight,
      });
    });

    win.addEventListener('fullscreenchange', () => {
      const { isFullscreen } = this.state;
      const newIsFullscreen = FullscreenService.isFullScreen(presentationWindow.document.documentElement);
      if (isFullscreen !== newIsFullscreen) {
        this.setState({ isFullscreen: newIsFullscreen });
      }
      this.setState({
        presentationWidth: win.innerWidth,
        presentationHeight: win.innerHeight - toolbarHeight,
      });
    });
  }
  
  onFullscreenChange() {
    const { isFullscreen } = this.state;
    const newIsFullscreen = FullscreenService.isFullScreen(this.refPresentationContainer);
    if (isFullscreen !== newIsFullscreen) {
      this.setState({ isFullscreen: newIsFullscreen });
    }
  }

  setPresentationRef(ref) {
    this.refPresentationContainer = ref;
  }

  // returns a ref to the svg element, which is required by a WhiteboardOverlay
  // to transform screen coordinates to svg coordinate system
  getSvgRef() {
    return this.svggroup;
  }

  getToolbarHeight() {
    const { refPresentationToolbar } = this;
    let height = 0;
    if (refPresentationToolbar) {
      const { clientHeight } = refPresentationToolbar;
      height = clientHeight;
    }
    return height;
  }

  getPresentationSizesAvailable() {
    const { isPresentationDetached } = this.props;
    const {
      presentationBounds,
      presentationAreaSize: newPresentationAreaSize,
    } = this.props;
    const presentationSizes = {
      presentationWidth: 0,
      presentationHeight: 0,
    };

    if (isPresentationDetached && presentationWindow.innerWidth != 0) {
      presentationSizes.presentationWidth = presentationWindow.innerWidth;
      presentationSizes.presentationHeight = presentationWindow.innerHeight - (this.getToolbarHeight() || 0)
    } else {
      if (newPresentationAreaSize) {
        presentationSizes.presentationWidth = newPresentationAreaSize.presentationAreaWidth;
        presentationSizes.presentationHeight = newPresentationAreaSize
          .presentationAreaHeight - (this.getToolbarHeight() || 0);
        return presentationSizes;
      }
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
      // and set the showSlide to true to start rendering the slide
      this.setState({
        presentationHeight: presentationSizes.presentationHeight,
        presentationWidth: presentationSizes.presentationWidth,
        showSlide: true,
      });
    }
  }

  setFitToWidth(fitToWidth) {
    this.setState({ fitToWidth });
  }

  calculateSize(viewBoxDimensions) {
    const {
      presentationHeight,
      presentationWidth,
      fitToWidth,
    } = this.state;

    const {
      userIsPresenter,
      currentSlide,
      slidePosition,
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

  zoomChanger(incomingZoom) {
    const {
      zoom,
    } = this.state;

    let newZoom = incomingZoom;

    if (newZoom <= HUNDRED_PERCENT) {
      newZoom = HUNDRED_PERCENT;
    } else if (incomingZoom >= MAX_PERCENT) {
      newZoom = MAX_PERCENT;
    }

    if (newZoom !== zoom) this.setState({ zoom: newZoom });
  }

  fitToWidthHandler() {
    const {
      fitToWidth,
    } = this.state;

    this.setState({
      fitToWidth: !fitToWidth,
      zoom: HUNDRED_PERCENT,
    });
  }

  isPresentationAccessible() {
    const {
      currentSlide,
      slidePosition,
    } = this.props;
    // sometimes tomcat publishes the slide url, but the actual file is not accessible
    return currentSlide && slidePosition;
  }

  updateLocalPosition(x, y, width, height, zoom) {
    this.setState({
      localPosition: {
        x, y, width, height,
      },
      zoom,
    });
  }

  panAndZoomChanger(w, h, x, y) {
    const {
      currentSlide,
      podId,
      zoomSlide,
    } = this.props;

    zoomSlide(currentSlide.num, podId, w, h, x, y);
  }

  renderOverlays(slideObj, svgDimensions, viewBoxPosition, viewBoxDimensions, physicalDimensions) {
    const {
      userIsPresenter,
      multiUser,
      podId,
      currentSlide,
      slidePosition,
      isPresentationDetached,
    } = this.props;

    const {
      zoom,
      fitToWidth,
    } = this.state;

    if (!userIsPresenter && !multiUser) {
      return null;
    }

    // retrieving the pre-calculated data from the slide object
    const {
      width,
      height,
    } = slidePosition;

    return (
      <PresentationOverlayContainer
        podId={podId}
        userIsPresenter={userIsPresenter}
        currentSlideNum={currentSlide.num}
        slide={slideObj}
        slideWidth={width}
        slideHeight={height}
        viewBoxX={viewBoxPosition.x}
        viewBoxY={viewBoxPosition.y}
        viewBoxWidth={viewBoxDimensions.width}
        viewBoxHeight={viewBoxDimensions.height}
        physicalSlideWidth={physicalDimensions.width}
        physicalSlideHeight={physicalDimensions.height}
        svgWidth={svgDimensions.width}
        svgHeight={svgDimensions.height}
        zoom={zoom}
        zoomChanger={this.zoomChanger}
        updateLocalPosition={this.updateLocalPosition}
        panAndZoomChanger={this.panAndZoomChanger}
        getSvgRef={this.getSvgRef}
        fitToWidth={fitToWidth}
        presentationWindow={presentationWindow}
        isPresentationDetached={isPresentationDetached}
      >
        <WhiteboardOverlayContainer
          getSvgRef={this.getSvgRef}
          userIsPresenter={userIsPresenter}
          whiteboardId={slideObj.id}
          slide={slideObj}
          slideWidth={width}
          slideHeight={height}
          viewBoxX={viewBoxPosition.x}
          viewBoxY={viewBoxPosition.y}
          viewBoxWidth={viewBoxDimensions.width}
          viewBoxHeight={viewBoxDimensions.height}
          physicalSlideWidth={physicalDimensions.width}
          physicalSlideHeight={physicalDimensions.height}
          zoom={zoom}
          zoomChanger={this.zoomChanger}
          presentationWindow={presentationWindow}
          isPresentationDetached={isPresentationDetached}
        />
      </PresentationOverlayContainer>
    );
  }

  // renders the whole presentation area
  renderPresentation(svgDimensions, viewBoxDimensions) {
    const {
      intl,
      podId,
      currentSlide,
      slidePosition,
      userIsPresenter,
      layoutSwapped,
      isPresentationDetached,
    } = this.props;

    const {
      localPosition,
    } = this.state;

    if (!this.isPresentationAccessible()) {
      return null;
    }

    // retrieving the pre-calculated data from the slide object
    const {
      width,
      height,
    } = slidePosition;

    const {
      imageUri,
      content,
    } = currentSlide;

    let viewBoxPosition;

    if (userIsPresenter && localPosition) {
      viewBoxPosition = {
        x: localPosition.x,
        y: localPosition.y,
      };
    } else {
      viewBoxPosition = {
        x: slidePosition.x,
        y: slidePosition.y,
      };
    }

    const widthRatio = viewBoxDimensions.width / width;
    const heightRatio = viewBoxDimensions.height / height;

    const physicalDimensions = {
      width: (svgDimensions.width / widthRatio),
      height: (svgDimensions.height / heightRatio),
    };

    const svgViewBox = `${viewBoxPosition.x} ${viewBoxPosition.y} `
      + `${viewBoxDimensions.width} ${Number.isNaN(viewBoxDimensions.height) ? 0 : viewBoxDimensions.height}`;

    const slideContent = content ? `${intl.formatMessage(intlMessages.slideContentStart)}
      ${content}
      ${intl.formatMessage(intlMessages.slideContentEnd)}` : intl.formatMessage(intlMessages.noSlideContent);

    let presentationStyle = {
      position: 'absolute',
      width: svgDimensions.width < 0 ? 0 : svgDimensions.width,
      height: svgDimensions.height < 0 ? 0 : svgDimensions.height,
      textAlign: 'center',
      display: layoutSwapped ? 'none' : 'block',
    };

    if ( userIsPresenter && isPresentationDetached ) {
      presentationStyle.left = "50%";
      presentationStyle.transform = "translateX(-50%)";
    }
    
    return (
      <div
        style={presentationStyle}
      >
        <Styled.VisuallyHidden id="currentSlideText">{slideContent}</Styled.VisuallyHidden>
        {this.renderPresentationDownload()}
        {this.renderPresentationMenu()}
        <Styled.PresentationSvg
          key={currentSlide.id}
          data-test="whiteboard"
          width={svgDimensions.width < 0 ? 0 : svgDimensions.width}
          height={svgDimensions.height < 0 ? 0 : svgDimensions.height}
          ref={(ref) => { if (ref != null) { this.svggroup = ref; } }}
          viewBox={svgViewBox}
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="viewBox">
              <rect x={viewBoxPosition.x} y={viewBoxPosition.y} width="100%" height="100%" fill="none" />
            </clipPath>
          </defs>
          <g clipPath="url(#viewBox)">
            <Slide
              imageUri={imageUri}
              svgWidth={width}
              svgHeight={height}
            />
            <AnnotationGroupContainer
              {...{
                width,
                height,
              }}
              published
              whiteboardId={currentSlide.id}
            />
            <AnnotationGroupContainer
              {...{
                width,
                height,
              }}
              published={false}
              whiteboardId={currentSlide.id}
            />
            <CursorWrapperContainer
              podId={podId}
              whiteboardId={currentSlide.id}
              widthRatio={widthRatio}
              physicalWidthRatio={svgDimensions.width / width}
              slideWidth={width}
              slideHeight={height}
            />
          </g>
          {this.renderOverlays(
            currentSlide,
            svgDimensions,
            viewBoxPosition,
            viewBoxDimensions,
            physicalDimensions,
          )}
        </Styled.PresentationSvg>
      </div>
    );
  }

  renderPresentationToolbar(svgWidth) {
    const {
      currentSlide,
      podId,
      isPresentationDetached,
      togglePresentationDetached,
      isMobile,
      layoutType,
      numCameras,
      fullscreenElementId,
      fullscreenContext,
      layoutContextDispatch,
    } = this.props;
    const { zoom, fitToWidth } = this.state;

    if (!currentSlide) return null;

    const { presentationToolbarMinWidth } = DEFAULT_VALUES;

    const toolbarWidth = ((this.refWhiteboardArea && svgWidth > presentationToolbarMinWidth)
      || isMobile
      || (layoutType === LAYOUT_TYPE.VIDEO_FOCUS && numCameras > 0))
      ? svgWidth
      : presentationToolbarMinWidth;
    return (
      <PresentationToolbarContainer
        {...{
          fitToWidth,
          zoom,
          podId,
          currentSlide,
          toolbarWidth,
          fullscreenElementId,
          layoutContextDispatch,
        }}
        currentSlideNum={currentSlide.num}
        presentationId={currentSlide.presentationId}
        zoomChanger={this.zoomChanger}
        fitToWidthHandler={this.fitToWidthHandler}
        togglePresentationDetached={togglePresentationDetached}
        isPresentationDetached={isPresentationDetached}
        presentationWindow={presentationWindow}
        fullscreenRef={presentationWindow.document.documentElement}
        isFullscreen={fullscreenContext}
        fullscreenAction={ACTIONS.SET_FULLSCREEN_ELEMENT}
        fullscreenRef={this.refPresentationContainer}
      />
    );
  }

  renderWhiteboardToolbar(svgDimensions) {
    const { currentSlide, userIsPresenter } = this.props;
    if (!this.isPresentationAccessible()) return null;

    return (
      <WhiteboardToolbarContainer
        whiteboardId={currentSlide.id}
        height={svgDimensions.height}
        presentationWindow={presentationWindow}
        isPresenter={userIsPresenter}
      />
    );
  }

  renderPresentationDownload() {
    const { presentationIsDownloadable, downloadPresentationUri } = this.props;

    if (!presentationIsDownloadable) return null;

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
      isPresentationDetached,
      layoutContextDispatch,
    } = this.props;

    return (
      <PresentationMenu
        fullscreenRef={this.refPresentationContainer}
        getScreenshotRef={this.getSvgRef}
        elementName={intl.formatMessage(intlMessages.presentationLabel)}
        elementId={fullscreenElementId}
        isPresentationDetached={isPresentationDetached}
        presentationWindow={presentationWindow}
        toggleSwapLayout={MediaService.toggleSwapLayout}
        layoutContextDispatch={layoutContextDispatch}
      />
    );
  }

  renderCurrentPresentationToast() {
    const {
      intl, currentPresentation, userIsPresenter, downloadPresentationUri,
    } = this.props;
    const { downloadable } = currentPresentation;

    return (
      <Styled.InnerToastWrapper>
        <Styled.ToastIcon>
          <Styled.IconWrapper>
            <Icon iconName="presentation" />
          </Styled.IconWrapper>
        </Styled.ToastIcon>

        <Styled.ToastTextContent data-test="toastSmallMsg">
          <div>{`${intl.formatMessage(intlMessages.changeNotification)}`}</div>
          <Styled.PresentationName>{`${currentPresentation.name}`}</Styled.PresentationName>
        </Styled.ToastTextContent>

        {downloadable && !userIsPresenter
          ? (
            <Styled.ToastDownload>
              <Styled.ToastSeparator />
              <a
                data-test="toastDownload"
                aria-label={`${intl.formatMessage(intlMessages.downloadLabel)} ${currentPresentation.name}`}
                href={downloadPresentationUri}
                target="_blank"
                rel="noopener noreferrer"
              >
                {intl.formatMessage(intlMessages.downloadLabel)}
              </a>
            </Styled.ToastDownload>
          ) : null}
      </Styled.InnerToastWrapper>
    );
  }

  render() {
    const {
      userIsPresenter,
      multiUser,
      slidePosition,
      isPresentationDetached,
      setPresentationDetached,
      setPreviousSvgSize,
      getPreviousSvgSize,
      setPreviousToolbarHeight,
      getPreviousToolbarHeight,
      presentationBounds,
      fullscreenContext,
      isMobile,
      layoutType,
      numCameras,
      currentPresentation,
      layoutSwapped,
      layoutContextDispatch,
    } = this.props;

    const {
      showSlide,
      isFullscreen,
      localPosition,
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

    const toolbarHeight = this.getToolbarHeight();
    
    let toolbarWidth = 0;
    if (this.refWhiteboardArea) {
      toolbarWidth = svgWidth;
    }

    const { presentationToolbarMinWidth } = DEFAULT_VALUES;

    const isLargePresentation = (svgWidth > presentationToolbarMinWidth || isMobile)
      && !(layoutType === LAYOUT_TYPE.VIDEO_FOCUS && numCameras > 0 && !fullscreenContext);

    const containerWidth = isLargePresentation
      ? svgWidth
      : presentationToolbarMinWidth;

    if (!currentPresentation && this.refPresentationContainer) {
      return (
        <PresentationPlaceholder
          {
          ...presentationBounds
          }
          layoutContextDispatch={layoutContextDispatch}
          setPresentationRef={this.setPresentationRef}
        />
      );
    }

    const slide =
            showSlide && svgWidth > 0 && svgHeight > 0
              ? this.renderPresentation(svgDimensions, viewBoxDimensions)
              : null ;

    const wToolbar =
            showSlide && (userIsPresenter || multiUser)
              ? this.renderWhiteboardToolbar(svgDimensions)
              : null ;

    let pToolbarStyle = {width: containerWidth};
    if (userIsPresenter && isPresentationDetached){
      pToolbarStyle.left = "50%";
      pToolbarStyle.transform = "translateX(-50%)";
    }

    const pToolbar =
            showSlide && userIsPresenter
              ? (
                <Styled.PresentationToolbar
                  ref={(ref) => { this.refPresentationToolbar = ref; }}
                  style={pToolbarStyle}
                >
                  {this.renderPresentationToolbar(svgWidth)}
                </Styled.PresentationToolbar>
              )
              : null ;

    if (svgHeight != 0 && svgWidth != 0) {
      setPreviousSvgSize(svgWidth, svgHeight);
    }
    if (toolbarHeight != 0) {
      setPreviousToolbarHeight(toolbarHeight);
    }
    
    if (isPresentationDetached) {
      // Injecting submenu styles to the detached window.
      const isRTL = document.documentElement.getAttribute("dir") === "rtl";
      const styleId = "supplementedSubmenuStyle";
      const submenuStyleText = Styled.submenuStyleText({ isRTL} );
      const oldElement = presentationWindow.document.getElementById(styleId);
      if (oldElement) {
        presentationWindow.document.head.removeChild(oldElement);
      }
      const suppStyle = presentationWindow.document.createElement('style');
      suppStyle.id = styleId;
      suppStyle.appendChild(presentationWindow.document.createTextNode(submenuStyleText));
      presentationWindow.document.head.appendChild(suppStyle);
    }

    return (
      <Styled.PresentationContainer
        role="region"
        ref={(ref) => { this.refPresentationContainer = ref; }}
        style={{
          top: presentationBounds.top,
          left: presentationBounds.left,
          right: presentationBounds.right,
          width: presentationBounds.width,
          height: presentationBounds.height,
          display: layoutSwapped ? 'none' : 'flex',
          zIndex: fullscreenContext ? presentationBounds.zIndex : undefined,
          background: layoutType === LAYOUT_TYPE.VIDEO_FOCUS && numCameras > 0 && !fullscreenContext
            ? colorContentBackground
            : null,
        }}
        data-test="presentationContainer"
      >
        {isFullscreen && <PollingContainer />}

        <Styled.Presentation ref={(ref) => { this.refPresentation = ref; }}>
          <Styled.WhiteboardSizeAvailable ref={(ref) => { this.refWhiteboardArea = ref; }} />
          <Styled.SvgContainer
            style={{
              height: svgHeight + toolbarHeight,
            }}
          >
          {userIsPresenter && isPresentationDetached
            ?
              <Fragment>
                <WindowPortal
                  setPresentationDetached={setPresentationDetached}
                  setEventExternalWindow={this.setEventExternalWindow}
                  svgSize={getPreviousSvgSize()}
                  toolbarHeight={getPreviousToolbarHeight()}
                >
                  {slide}
                  {wToolbar}
                  {pToolbar}
                </WindowPortal>
                {/*
                  wToolbar can be here if it impairs the slide visibility
                */}
              </Fragment>
            :
              <Fragment>
                {slide}
                {wToolbar}
                {pToolbar}
              </Fragment>
          }
          </Styled.SvgContainer>
        </Styled.Presentation>
      </Styled.PresentationContainer>
    );
  }
}

export default injectIntl(Presentation);

Presentation.propTypes = {
  podId: PropTypes.string.isRequired,
  // Defines a boolean value to detect whether a current user is a presenter
  userIsPresenter: PropTypes.bool.isRequired,
  currentSlide: PropTypes.shape({
    presentationId: PropTypes.string.isRequired,
    current: PropTypes.bool.isRequired,
    num: PropTypes.number.isRequired,
    id: PropTypes.string.isRequired,
    imageUri: PropTypes.string.isRequired,
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
};

Presentation.defaultProps = {
  currentSlide: undefined,
  slidePosition: undefined,
};
