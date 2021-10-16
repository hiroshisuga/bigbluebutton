import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {Meteor} from "meteor/meteor";

const ANNOTATION_CONFIG = Meteor.settings.public.whiteboard.annotations;
const DRAW_START = ANNOTATION_CONFIG.status.start;
const DRAW_UPDATE = ANNOTATION_CONFIG.status.update;
const DRAW_END = ANNOTATION_CONFIG.status.end;

// maximum value of z-index to prevent other things from overlapping
const MAX_Z_INDEX = (2 ** 31) - 1;

export default class ShapeDrawListener extends Component {
  constructor(props) {
    super(props);

    // there is no valid defaults for the coordinates, and we wouldn't want them anyway
    this.initialCoordinate = {
      x: undefined,
      y: undefined,
    };
    this.lastSentCoordinate = {
      x: undefined,
      y: undefined,
    };
    this.currentCoordinate = {
      x: undefined,
      y: undefined,
    };

    this.isFilled = false;
    // to track the status of drawing
    this.isDrawing = false;

    this.currentStatus = undefined;

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.resetState = this.resetState.bind(this);
    this.sendLastMessage = this.sendLastMessage.bind(this);
    this.sendCoordinates = this.sendCoordinates.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleTouchCancel = this.handleTouchCancel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    const { presentationWindow } = this.props;
    // to send the last message if the user refreshes the page while drawing
    presentationWindow.addEventListener('beforeunload', this.sendLastMessage);
  }

  componentWillUnmount() {
    const { presentationWindow } = this.props;
    presentationWindow.removeEventListener('beforeunload', this.sendLastMessage);

    // sending the last message on componentDidUnmount
    this.sendLastMessage();
  }

  commonDrawStartHandler(clientX, clientY) {
    this.isDrawing = true;

    const {
      actions,
    } = this.props;

    const {
      getTransformedSvgPoint,
      generateNewShapeId,
      svgCoordinateToPercentages,
    } = actions;

    // sending the first message
    let transformedSvgPoint = getTransformedSvgPoint(clientX, clientY);

    // transforming svg coordinate to percentages relative to the slide width/height
    transformedSvgPoint = svgCoordinateToPercentages(transformedSvgPoint);

    // generating new shape id
    generateNewShapeId();

    // setting the initial current status
    this.currentStatus = DRAW_START;

    // saving the coordinates for future references
    this.initialCoordinate = {
      x: transformedSvgPoint.x,
      y: transformedSvgPoint.y,
    };

    this.currentCoordinate = {
      x: transformedSvgPoint.x,
      y: transformedSvgPoint.y,
    };

    // All the messages will be send on timer by sendCoordinates func
    this.sendCoordinates();
  }

  commonDrawMoveHandler(clientX, clientY) {
    if (!this.isDrawing) {
      return;
    }

    const {
      actions,
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

    // saving the last sent coordinate
    this.currentCoordinate = transformedSvgPoint;
    this.sendCoordinates();
  }

  handleKeyDown(event) {
    const {
      physicalSlideWidth,
      physicalSlideHeight,
    } = this.props;

    const d = {
      x: 1.0 * physicalSlideHeight / (physicalSlideWidth + physicalSlideHeight),
      y: 1.0 * physicalSlideWidth  / (physicalSlideWidth + physicalSlideHeight),
    };

    if        (event.keyCode == '38') { // up arrow
      this.initialCoordinate.y -= d.y;
    } else if (event.keyCode == '40') { // down arrow
      this.initialCoordinate.y += d.y;
    } else if (event.keyCode == '37') { // left arrow
      this.initialCoordinate.x -= d.x;
    } else if (event.keyCode == '39') { // right arrow
      this.initialCoordinate.x += d.x;
    }
    event.stopPropagation();
    this.lastSentCoordinate = {x:undefined, y:undefined}; // a hacky solution; to avoid skipping the update in sendCoordinates().
    this.sendCoordinates();
  }

  handleTouchStart(event) {
    const { presentationWindow } = this.props;
    event.preventDefault();

    if (!this.isDrawing) {
      presentationWindow.addEventListener('touchend', this.handleTouchEnd, { passive: false });
      presentationWindow.addEventListener('touchmove', this.handleTouchMove, { passive: false });
      presentationWindow.addEventListener('touchcancel', this.handleTouchCancel, true);
      presentationWindow.addEventListener('keydown', this.handleKeyDown, true);

      const { clientX, clientY } = event.changedTouches[0];
      this.commonDrawStartHandler(clientX, clientY);

    // if you switch to a different window using Alt+Tab while mouse is down and release it
    // it wont catch mouseUp and will keep tracking the movements. Thus we need this check.
    } else {
      this.isFilled = event.ctrlKey;
      this.sendLastMessage();
    }
  }

  handleTouchMove(event) {
    event.preventDefault();
    const { clientX, clientY } = event.changedTouches[0];
    this.isFilled = event.ctrlKey;
    this.commonDrawMoveHandler(clientX, clientY);
  }

  handleTouchEnd(event) {
    this.isFilled = event.ctrlKey;
    this.sendLastMessage();
  }

  handleTouchCancel(event) {
    this.isFilled = event.ctrlKey;
    this.sendLastMessage();
  }

  // main mouse down handler
  handleMouseDown(event) {
    const { presentationWindow } = this.props;
    const isLeftClick = event.button === 0;
    const isRightClick = event.button === 2;

    if (!this.isDrawing) {
      if (isLeftClick) {
        presentationWindow.addEventListener('mouseup', this.handleMouseUp);
        presentationWindow.addEventListener('mousemove', this.handleMouseMove, true);
        presentationWindow.addEventListener('keydown', this.handleKeyDown, true);

        const { clientX, clientY } = event;
        this.commonDrawStartHandler(clientX, clientY);
      }

    // if you switch to a different window using Alt+Tab while mouse is down and release it
    // it wont catch mouseUp and will keep tracking the movements. Thus we need this check.
    } else if (isRightClick) {
      this.discardAnnotation();
    }
  }

  // main mouse move handler
  handleMouseMove(event) {
    const { clientX, clientY } = event;
    this.isFilled = event.ctrlKey;
    this.commonDrawMoveHandler(clientX, clientY);
  }

  // main mouse up handler
  handleMouseUp(event) {
    this.isFilled = event.ctrlKey;
    this.sendLastMessage();
  }

  sendCoordinates() {
    const {
      actions,
      drawSettings,
    } = this.props;

    // check the current drawing status
    if (!this.isDrawing) {
      return;
    }
    // check if a current coordinate is not the same as an initial one
    // it prevents us from drawing dots on random clicks
    if (this.currentCoordinate.x === this.initialCoordinate.x
        && this.currentCoordinate.y === this.initialCoordinate.y) {
      return;
    }

    // check if previously sent coordinate is not equal to a current one
    if (this.currentCoordinate.x === this.lastSentCoordinate.x
        && this.currentCoordinate.y === this.lastSentCoordinate.y) {
      return;
    }

    const { getCurrentShapeId } = actions;
    this.handleDrawCommonAnnotation(
      this.initialCoordinate,
      this.currentCoordinate,
      this.currentStatus,
      getCurrentShapeId(),
      drawSettings.tool,
      this.isFilled,
    );
    this.lastSentCoordinate = this.currentCoordinate;

    if (this.currentStatus === DRAW_START) {
      this.currentStatus = DRAW_UPDATE;
    }
  }

  sendLastMessage() {
    const {
      actions,
      drawSettings,
    } = this.props;

    if (this.isDrawing) {
      // make sure we are drawing and we have some coordinates sent for this shape before
      // to prevent sending DRAW_END on a random mouse click
      if (this.lastSentCoordinate.x && this.lastSentCoordinate.y) {
        const { getCurrentShapeId } = actions;
        this.handleDrawCommonAnnotation(
          this.initialCoordinate,
          this.currentCoordinate,
          DRAW_END,
          getCurrentShapeId(),
          drawSettings.tool,
          this.isFilled,
        );
      }
      this.resetState();
    }
  }

  resetState() {
    const { presentationWindow } = this.props;
    // resetting the current drawing state
    presentationWindow.removeEventListener('mouseup', this.handleMouseUp);
    presentationWindow.removeEventListener('mousemove', this.handleMouseMove, true);
    presentationWindow.removeEventListener('keydown', this.handleKeyDown, true);
    // touchend, touchmove and touchcancel are removed on devices
    presentationWindow.removeEventListener('touchend', this.handleTouchEnd, { passive: false });
    presentationWindow.removeEventListener('touchmove', this.handleTouchMove, { passive: false });
    presentationWindow.removeEventListener('touchcancel', this.handleTouchCancel, true);
    this.isDrawing = false;
    this.currentStatus = undefined;
    this.initialCoordinate = {
      x: undefined,
      y: undefined,
    };
    this.lastSentCoordinate = {
      x: undefined,
      y: undefined,
    };
    this.currentCoordinate = {
      x: undefined,
      y: undefined,
    };
  }

  // since Rectangle / Triangle / Ellipse / Line have the same coordinate structure
  // we use the same function for all of them
  handleDrawCommonAnnotation(startPoint, endPoint, status, id, shapeType, isFilled) {
    const {
      whiteboardId,
      userId,
      actions,
      drawSettings,
    } = this.props;

    const {
      normalizeThickness,
      sendAnnotation,
    } = actions;

    const {
      color,
      thickness,
    } = drawSettings;

    const annotation = {
      id,
      status,
      annotationType: shapeType,
      annotationInfo: {
        color,
        thickness: normalizeThickness(thickness),
        points: [
          startPoint.x,
          startPoint.y,
          endPoint.x,
          endPoint.y,
        ],
        id,
        whiteboardId,
        status,
        type: shapeType,
        fill: isFilled,
      },
      wbId: whiteboardId,
      userId,
      position: 0,
    };

    sendAnnotation(annotation, whiteboardId);
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

  render() {
    const {
      actions,
      drawSettings,
      isPresentationDetached,
    } = this.props;

    const {
      contextMenuHandler,
    } = actions;

    const {
      tool,
    } = drawSettings;

    let baseName = Meteor.settings.public.app.cdn + Meteor.settings.public.app.basename + Meteor.settings.public.app.instanceId;
    const hostUri = `https://${window.document.location.hostname}`;
    if (isPresentationDetached) {
      baseName = hostUri + baseName ;
    }
    const shapeDrawStyle = {
      width: '100%',
      height: '100%',
      touchAction: 'none',
      zIndex: MAX_Z_INDEX,
      cursor: `url('${baseName}/resources/images/whiteboard-cursor/${tool !== 'rectangle' ? tool : 'square'}.png'), default`,
    };

    return (
      <div
        onTouchStart={this.handleTouchStart}
        role="presentation"
        style={shapeDrawStyle}
        onMouseDown={this.handleMouseDown}
        onContextMenu={contextMenuHandler}
      />
    );
  }
}

ShapeDrawListener.propTypes = {
  // Defines a whiteboard id, which needed to publish an annotation message
  whiteboardId: PropTypes.string.isRequired,
  // Defines a user id, which needed to publish an annotation message
  userId: PropTypes.string.isRequired,
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
    // The name of the tool currently selected
    tool: PropTypes.string,
  }).isRequired,
};
