import { check } from 'meteor/check';

const ANNOTATION_TYPE_TEXT = 'text';
const ANNOTATION_TYPE_PENCIL = 'pencil';

// line, triangle, ellipse, rectangle
function handleCommonAnnotation(meetingId, whiteboardId, userId, annotation, multiUser) {
  const {
    id, status, annotationType, annotationInfo, wbId, position,
  } = annotation;

  const selector = {
    meetingId,
    id,
    userId,
  };

  const modifier = {
    $set: {
      whiteboardId,
      meetingId,
      id,
      status,
      annotationType,
      annotationInfo,
      wbId,
      currentMultiUser: multiUser,
    },
    $setOnInsert: {
      position,
    },
    $inc: { version: 1 },
  };

  return { selector, modifier };
}

function handleTextUpdate(meetingId, whiteboardId, userId, annotation, multiUser) {
  const {
    id, status, annotationType, annotationInfo, wbId, position,
  } = annotation;

  const selector = {
    meetingId,
    id,
    userId,
  };

  annotationInfo.text = annotationInfo.text.replace(/[\r]/g, '\n');

  const modifier = {
    $set: {
      whiteboardId,
      meetingId,
      id,
      status,
      annotationType,
      annotationInfo,
      wbId,
      currentMultiUser: multiUser,
    },
    $setOnInsert: {
      position,
    },
    $inc: { version: 1 },
  };

  return { selector, modifier };
}

function handlePencilUpdate(meetingId, whiteboardId, userId, annotation, multiUser) {
  const DRAW_START = 'DRAW_START';
  const DRAW_UPDATE = 'DRAW_UPDATE';
  const DRAW_END = 'DRAW_END';

  const {
    id, status, annotationType, annotationInfo, wbId, position,
  } = annotation;

  const baseSelector = {
    meetingId,
    id,
    userId,
    whiteboardId,
  };

  let baseModifier;
  switch (status) {
    case DRAW_START:
      // on start we split the points

      // create the 'pencil_base'
      // TODO: find and removed unused props (chunks, version, etc)
      baseModifier = {
        $set: {
          id,
          userId,
          meetingId,
          whiteboardId,
          position,
          status,
          annotationType,
          annotationInfo,
          wbId,
          version: 1,
        },
      };
      break;
    case DRAW_UPDATE:
      baseModifier = {
        $push: {
          'annotationInfo.points': { $each: annotationInfo.points },
        },
        $set: {
          status,
        },
        $inc: { version: 1 },
      };
      break;
    case DRAW_END:
      // Updating the main pencil object with the final info
      baseModifier = {
        $set: {
          whiteboardId,
          meetingId,
          id,
          status,
          annotationType,
          annotationInfo,
          wbId,
          position,
          currentMultiUser: multiUser,
        },
        $inc: { version: 1 },
      };
      break;
    default:
      break;
  }

  return { selector: baseSelector, modifier: baseModifier };
}

export default function addAnnotation(meetingId, whiteboardId, userId, annotation, multiUser) {
  check(meetingId, String);
  check(whiteboardId, String);
  check(annotation, Object);

  switch (annotation.annotationType) {
    case ANNOTATION_TYPE_TEXT:
      return handleTextUpdate(meetingId, whiteboardId, userId, annotation, multiUser);
    case ANNOTATION_TYPE_PENCIL:
      return handlePencilUpdate(meetingId, whiteboardId, userId, annotation, multiUser);
    default:
      return handleCommonAnnotation(meetingId, whiteboardId, userId, annotation, multiUser);
  }
}
