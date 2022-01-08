import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Logger from '/imports/startup/client/logger';
import Storage from '/imports/ui/services/storage/session';

const ANNOTATION_CONFIG = Meteor.settings.public.whiteboard.annotations;
const DRAW_START = ANNOTATION_CONFIG.status.start;
const DRAW_UPDATE = ANNOTATION_CONFIG.status.update;
const DRAW_END = ANNOTATION_CONFIG.status.end;
const PALM_REJECTION_MODE = 'palmRejectionMode';

// maximum value of z-index to prevent other things from overlapping
const MAX_Z_INDEX = (2 ** 31) - 1;
const POINTS_TO_BUFFER = 2;
const POINTS_TO_BUFFER_SYNC = Meteor.settings.public.app.defaultSettings.dataSaving.syncPencilPointsToBuffer;

export default class PencilPointerListener extends Component {
  constructor() {
    super();

    // to track the status of drawing
    this.isDrawing = false;
    this.palmRejectionActivated = Storage.getItem(PALM_REJECTION_MODE);
    this.points = [];

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);

    this.resetState = this.resetState.bind(this);
    this.sendLastMessage = this.sendLastMessage.bind(this);
    this.sendCoordinates = this.sendCoordinates.bind(this);
    this.discardAnnotation = this.discardAnnotation.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    const { presentationWindow } = this.props;
    // to send the last DRAW_END message in case if a user reloads the page while drawing
    presentationWindow.addEventListener('beforeunload', this.sendLastMessage);
  }

  componentWillUnmount() {
    const { presentationWindow } = this.props;
    presentationWindow.removeEventListener('beforeunload', this.sendLastMessage);

    // sending the last message on componentDidUnmount
    this.sendLastMessage();
  }

  commonDrawStartHandler(clientX, clientY) {
    const {
      actions,
      drawSettings,
    } = this.props;

    const {
      getTransformedSvgPoint,
      generateNewShapeId,
      svgCoordinateToPercentages,
    } = actions;

    // changing isDrawing to true
    this.isDrawing = true;

    // sending the first message
    let transformedSvgPoint = getTransformedSvgPoint(clientX, clientY);

    // transforming svg coordinate to percentages relative to the slide width/height
    transformedSvgPoint = svgCoordinateToPercentages(transformedSvgPoint);

    // sending the first message
    this.points = [transformedSvgPoint.x, transformedSvgPoint.y];
    this.handleDrawPencil(this.points, DRAW_START, generateNewShapeId(), undefined, drawSettings.tool);
  }

  commonDrawMoveHandler(clientX, clientY) {
    if (this.isDrawing) {
      const {
        actions,
        synchronizeWBUpdate,
      } = this.props;

      const {
        checkIfOutOfBounds,
        getTransformedSvgPoint,
        svgCoordinateToPercentages,
      } = actions;

      // get the transformed svg coordinate
      let transformedSvgPoint = getTransformedSvgPoint(clientX, clientY);

      // check if it's out of bounds
      transformedSvgPoint = checkIfOutOfBounds(transformedSvgPoint);

      // transforming svg coordinate to percentages relative to the slide width/height
      transformedSvgPoint = svgCoordinateToPercentages(transformedSvgPoint);

      // saving the coordinate to the array
      this.points.push(transformedSvgPoint.x);
      this.points.push(transformedSvgPoint.y);

      if (this.points.length > (synchronizeWBUpdate ? POINTS_TO_BUFFER_SYNC : POINTS_TO_BUFFER)) {
        this.sendCoordinates();
      }
    }
  }

  sendCoordinates() {
    if (this.isDrawing && this.points.length > 0) {
      const {
        actions,
        drawSettings,
      } = this.props;

      const { getCurrentShapeId } = actions;
      this.handleDrawPencil(this.points, DRAW_UPDATE, getCurrentShapeId(), undefined, drawSettings.tool);
      this.points = [];
    }
  }

  handleDrawPencil(points, status, id, dimensions, pencilType) {
    const {
      whiteboardId,
      userId,
      actions,
      drawSettings,
      synchronizeWBUpdate,
    } = this.props;

    const {
      normalizeThickness,
      sendAnnotation,
    } = actions;

    const {
      thickness,
      color,
    } = drawSettings;

    if (status == DRAW_END && synchronizeWBUpdate && points.length === 2) {
      // see the comment in pencil-draw-listner
      points = points.concat(points);
    }

    const annotation = {
      id,
      status,
      annotationType: pencilType,
      annotationInfo: {
        color,
        thickness: normalizeThickness(thickness),
        points,
        id,
        whiteboardId,
        status,
        type: pencilType,
      },
      wbId: whiteboardId,
      userId,
      position: 0,
    };

    // dimensions are added to the 'DRAW_END', last message
    if (dimensions) {
      annotation.annotationInfo.dimensions = dimensions;
    }

    sendAnnotation(annotation, synchronizeWBUpdate);
  }

  sendLastMessage() {
    if (this.isDrawing) {
      const {
        physicalSlideWidth,
        physicalSlideHeight,
        actions,
        drawSettings,
      } = this.props;

      const { getCurrentShapeId } = actions;

      this.handleDrawPencil(
        this.points,
        DRAW_END,
        getCurrentShapeId(),
        [Math.round(physicalSlideWidth), Math.round(physicalSlideHeight)],
        drawSettings.tool,
      );
      this.resetState();
    }
  }

  resetState() {
    const { presentationWindow } = this.props;
    // resetting the current info
    this.points = [];
    this.isDrawing = false;
    // remove event listener
    presentationWindow.removeEventListener('pointerup', this.handlePointerUp);
    presentationWindow.removeEventListener('pointermove', this.handlePointerMove);
    presentationWindow.removeEventListener('pointercancel', this.handlePointerCancel, true);
    presentationWindow.removeEventListener('keydown', this.handleKeyDown, true);
    
  }

  discardAnnotation() {
    const {
      actions,
    } = this.props;

    const {
      getCurrentShapeId,
      clearPreview,
    } = actions;

    this.resetState();
    clearPreview(getCurrentShapeId());
  }

  handlePointerDown(event) {
    const { presentationWindow } = this.props;
    this.palmRejectionActivated = Storage.getItem(PALM_REJECTION_MODE);
    switch (event.pointerType) {
      case 'mouse': {
        const isLeftClick = event.button === 0;
        const isRightClick = event.button === 2;

        if (!this.isDrawing) {
          if (isLeftClick) {
            presentationWindow.addEventListener('pointerup', this.handlePointerUp);
            presentationWindow.addEventListener('pointermove', this.handlePointerMove);
            presentationWindow.addEventListener('keydown', this.handleKeyDown, true);

            const { clientX, clientY } = event;
            this.commonDrawStartHandler(clientX, clientY);
          }

        // if you switch to a different window using Alt+Tab while mouse is down and release it
        // it wont catch mouseUp and will keep tracking the movements. Thus we need this check.
        } else if (isRightClick) {
          this.discardAnnotation();
        }
        break;
      }
      case 'pen': {
        this.touchPenDownHandler(event);
        break;
      }
      case 'touch': {
        if (!this.palmRejectionActivated) {
          this.touchPenDownHandler(event);
        }
        break;
      }
      default: {
        Logger.error({ logCode: 'pencil_pointer_listener_unkownPointerTypeError' }, 'PointerType is unknown or could not be detected!');
      }
    }
  }

  handleKeyDown(event) {
    const {
      physicalSlideWidth,
      physicalSlideHeight,
    } = this.props;

    const iter = this.points.length / 2;

    const d = {
      x: 1.0 * physicalSlideHeight /(physicalSlideWidth + physicalSlideHeight),
      y: 1.0 * physicalSlideWidth  /(physicalSlideWidth + physicalSlideHeight),
    };

    if        (event.keyCode == '38') { // up arrow
      for (let i = 0; i < iter; i++) {
        const move = -d.y * (this.points[i * 2 + 0] - this.points[this.points.length - 2]) /
                            (this.points[        0] - this.points[this.points.length - 2]);
        this.points[i * 2 + 1] += move;
      }
    } else if (event.keyCode == '40') { // down arrow
      for (let i = 0; i < iter; i++) {
        const move =  d.y * (this.points[i * 2 + 0] - this.points[this.points.length - 2]) /
                            (this.points[        0] - this.points[this.points.length - 2]);
        this.points[i * 2 + 1] += move;
      }
    } else if (event.keyCode == '37') { // left arrow
      for (let i = 0; i < iter; i++) {
        const move = -d.x * (this.points[i * 2 + 1] - this.points[this.points.length - 1]) /
                            (this.points[        1] - this.points[this.points.length - 1]);
        this.points[i * 2    ] += move;
      }
    } else if (event.keyCode == '39') { // right arrow
      for (let i = 0; i < iter; i++) {
        const move =  d.x * (this.points[i * 2 + 1] - this.points[this.points.length - 1]) /
                            (this.points[        1] - this.points[this.points.length - 1]);
        this.points[i * 2    ] += move;
      }
    }
    event.stopPropagation();
    this.sendCoordinates();
  }

  // handler for finger touch and pencil touch
  touchPenDownHandler(event) {
    const { presentationWindow } = this.props;
    event.preventDefault();
    if (!this.isDrawing) {
      presentationWindow.addEventListener('pointerup', this.handlePointerUp);
      presentationWindow.addEventListener('pointermove', this.handlePointerMove);
      presentationWindow.addEventListener('pointercancel', this.handlePointerCancel, true);
      presentationWindow.addEventListener('keydown', this.handleKeyDown, true);

      const { clientX, clientY } = event;
      this.commonDrawStartHandler(clientX, clientY);

      // if you switch to a different window using Alt+Tab while mouse is down and release it
      // it wont catch mouseUp and will keep tracking the movements. Thus we need this check.
    } else {
      this.sendLastMessage();
    }
  }

  handlePointerUp(event) {
    switch (event.pointerType) {
      case 'mouse': {
        this.sendLastMessage();
        break;
      }
      case 'pen': {
        this.sendLastMessage();
        break;
      }
      case 'touch': {
        if (!this.palmRejectionActivated) {
          this.sendLastMessage();
        }
        break;
      }
      default: {
        Logger.error({ logCode: 'pencil_pointer_listener_unkownPointerTypeError' }, 'PointerType is unknown or could not be detected!');
      }
    }
  }

  handlePointerMove(event) {
    switch (event.pointerType) {
      case 'mouse': {
        const { clientX, clientY } = event;
        this.commonDrawMoveHandler(clientX, clientY);
        break;
      }
      case 'pen': {
        event.preventDefault();
        const { clientX, clientY } = event;
        this.commonDrawMoveHandler(clientX, clientY);
        break;
      }
      case 'touch': {
        if (!this.palmRejectionActivated) {
          event.preventDefault();
          const { clientX, clientY } = event;
          this.commonDrawMoveHandler(clientX, clientY);
        }
        break;
      }
      default: {
        Logger.error({ logCode: 'pencil_pointer_listener_unkownPointerTypeError' }, 'PointerType is unknown or could not be detected!');
      }
    }
  }

  handlePointerCancel(event) {
    switch (event.pointerType) {
      case 'pen': {
        this.sendLastMessage();
        break;
      }
      case 'touch': {
        if (!this.palmRejectionActivated) {
          this.sendLastMessage();
        }
        break;
      }
      default: {
        Logger.error({ logCode: 'pencil_pointer_listener_unkownPointerTypeError' }, 'PointerType is unknown or could not be detected!');
      }
    }
  }

  render() {
    const {
      actions,
      drawSettings,
      isPresentationDetached,
    } = this.props;

    const { contextMenuHandler } = actions;

    const {
      tool,
    } = drawSettings;

    let baseName = Meteor.settings.public.app.cdn + Meteor.settings.public.app.basename;
    const hostUri = `https://${window.document.location.hostname}`;
    if (isPresentationDetached) {
      baseName = hostUri + baseName ;
    }
    const pencilDrawStyle = {
      width: '100%',
      height: '100%',
      touchAction: 'none',
      zIndex: MAX_Z_INDEX,
      cursor: `url('${baseName}/resources/images/whiteboard-cursor/${tool}.png') 2 22, default`,
    };

    return (
      <div
        onPointerDown={this.handlePointerDown}
        role="presentation"
        style={pencilDrawStyle}
        onContextMenu={contextMenuHandler}
      />
    );
  }
}

PencilPointerListener.propTypes = {
  // Defines a whiteboard id, which needed to publish an annotation message
  whiteboardId: PropTypes.string.isRequired,
  // Defines a user id, which needed to publish an annotation message
  userId: PropTypes.string.isRequired,
  // Defines the physical widith of the slide
  physicalSlideWidth: PropTypes.number.isRequired,
  // Defines the physical height of the slide
  physicalSlideHeight: PropTypes.number.isRequired,
  // Defines an object containing all available actions
  actions: PropTypes.shape({
    // Defines a function which transforms a coordinate from the window to svg coordinate system
    getTransformedSvgPoint: PropTypes.func.isRequired,
    // Defines a function which checks if the shape is out of bounds and returns
    // appropriate coordinates
    checkIfOutOfBounds: PropTypes.func.isRequired,
    // Defines a function which receives an svg point and transforms it into
    // percentage-based coordinates
    svgCoordinateToPercentages: PropTypes.func.isRequired,
    // Defines a function which returns a current shape id
    getCurrentShapeId: PropTypes.func.isRequired,
    // Defines a function which generates a new shape id
    generateNewShapeId: PropTypes.func.isRequired,
    // Defines a function which receives a thickness num and normalizes it before we send a message
    normalizeThickness: PropTypes.func.isRequired,
    // Defines a function which we use to publish a message to the server
    sendAnnotation: PropTypes.func.isRequired,
  }).isRequired,
  drawSettings: PropTypes.shape({
    // Annotation color
    color: PropTypes.number.isRequired,
    // Annotation thickness (not normalized)
    thickness: PropTypes.number.isRequired,
  }).isRequired,
  // Defines if palm rejection is active or not
  // palmRejection: PropTypes.bool.isRequired,
};
