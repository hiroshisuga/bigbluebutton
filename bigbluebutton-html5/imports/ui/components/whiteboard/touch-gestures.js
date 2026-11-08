import React from 'react';
import { throttle } from 'radash';
import { useEventCallback } from './hooks';

const PINCH_THRESHOLD = 10;
const POST_PINCH_LASER_THRESHOLD = 10;

const createGesture = () => ({
  fingerCount: 0,
  initialPinchDistance: 0,
  pinching: false,
  multiTouch: false,
  postPinchTouchPoint: null,
  suppressLaser: false,
});

const getDistanceBetweenTouches = (first, second) => {
  const dx = second.clientX - first.clientX;
  const dy = second.clientY - first.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const useTouchGestures = ({
  editor, whiteboardRef, initialZoomRef, isTouchZoomRef, isPresenter, hasWBAccess, laserMode,
  currentPresentationPage, zoomChanger, isInfiniteWhiteboard,
}) => {
  const gestureRef = React.useRef(createGesture());
  const cameraRef = React.useRef(null);
  const touchZoomResetTimeoutRef = React.useRef();

  // Keep pinch limits and camera synchronization active through the animation.
  const resetTouchZoomAfterCameraSettles = useEventCallback(() => {
    clearTimeout(touchZoomResetTimeoutRef.current);
    touchZoomResetTimeoutRef.current = setTimeout(() => {
      // eslint-disable-next-line no-param-reassign
      isTouchZoomRef.current = false;
    }, 175);
  });

  const setCanMoveCamera = useEventCallback((canMoveCamera) => {
    const camera = cameraRef.current;
    if (!camera?.laserEnabled) return;
    if (camera.editor.getInstanceState().canMoveCamera === canMoveCamera) return;
    camera.editor.updateInstanceState({ canMoveCamera });
  });

  const resetGesture = useEventCallback((keepSuppression = false) => {
    const suppressLaser = keepSuppression && gestureRef.current.suppressLaser;
    gestureRef.current = { ...createGesture(), suppressLaser };
    setCanMoveCamera(cameraRef.current?.originalCanMoveCamera);
  });

  // Resume mouse/pen input after the remaining touch has been released.
  const resumeLaserForPointer = (event) => {
    const gesture = gestureRef.current;
    if (
      (event.pointerType === 'mouse' || event.pointerType === 'pen')
      && gesture.suppressLaser
      && !gesture.postPinchTouchPoint
    ) {
      gesture.suppressLaser = false;
    }
  };

  const handlePointerDown = useEventCallback((event) => {
    resumeLaserForPointer(event);
    if (event.pointerType !== 'touch') return;
    if (!event.isPrimary && !isPresenter) {
      event.stopPropagation();
      editor?.cancel();
    }
    if (!cameraRef.current?.laserEnabled || editor.getCurrentToolId() !== 'hand') return;

    const gesture = gestureRef.current;
    if (event.isPrimary) {
      gesture.suppressLaser = false;
      gesture.postPinchTouchPoint = null;
      if (!gesture.multiTouch) setCanMoveCamera(false);
    } else {
      gesture.multiTouch = true;
      setCanMoveCamera(cameraRef.current.originalCanMoveCamera);
    }
  });

  const handlePointerMove = useEventCallback((event) => {
    resumeLaserForPointer(event);
    const gesture = gestureRef.current;
    if (event.pointerType !== 'touch' || !cameraRef.current?.laserEnabled) return;
    if (!gesture.suppressLaser || !gesture.postPinchTouchPoint) return;

    const distance = Math.hypot(
      event.clientX - gesture.postPinchTouchPoint.x,
      event.clientY - gesture.postPinchTouchPoint.y,
    );
    if (distance < POST_PINCH_LASER_THRESHOLD) return;

    gesture.suppressLaser = false;
    gesture.postPinchTouchPoint = null;
    gesture.multiTouch = false;
    setCanMoveCamera(false);
  });

  const handleTouchStart = useEventCallback((event) => {
    const gesture = gestureRef.current;
    if (event.touches.length === 2) {
      clearTimeout(touchZoomResetTimeoutRef.current);
      if (isPresenter) {
        // eslint-disable-next-line no-param-reassign
        isTouchZoomRef.current = true;
      }
      if (!isPresenter) {
        event.preventDefault();
        event.stopPropagation();
      }
      gesture.fingerCount = 2;
      gesture.pinching = false;
      const [first, second] = event.touches;
      gesture.initialPinchDistance = getDistanceBetweenTouches(first, second);
    } else {
      gesture.fingerCount = event.touches.length === 3 ? 3 : 0;
    }
  });

  const onTouchMove = useEventCallback((event) => {
    const gesture = gestureRef.current;
    if (gesture.fingerCount !== 2 || event.touches.length !== 2) return;

    const [t1, t2] = event.touches;
    const currentDistance = getDistanceBetweenTouches(t1, t2);
    const distanceDiff = Math.abs(currentDistance - gesture.initialPinchDistance);
    if (distanceDiff <= PINCH_THRESHOLD) return;
    gesture.pinching = true;

    if (isPresenter && editor && currentPresentationPage) {
      const MAX_ZOOM_FACTOR = 4;
      const MIN_ZOOM_FACTOR = isInfiniteWhiteboard ? 0.25 : 1;
      const ZOOM_STEP = 0.1;

      const { x: cx, y: cy, z: cz } = editor.getCamera();
      let currentZoomLevel = cz / initialZoomRef.current;

      // Zoom in if fingers moving apart, zoom out if moving together
      if (currentDistance > gesture.initialPinchDistance) {
        currentZoomLevel = Math.min(currentZoomLevel + ZOOM_STEP, MAX_ZOOM_FACTOR);
      } else {
        currentZoomLevel = Math.max(currentZoomLevel - ZOOM_STEP, MIN_ZOOM_FACTOR);
      }

      const zoomPercentage = currentZoomLevel * 100;
      zoomChanger(zoomPercentage);

      const newCameraZoomFactor = currentZoomLevel * initialZoomRef.current;

      // Calculate center point between the two touches
      const centerX = (t1.clientX + t2.clientX) / 2;
      const centerY = (t1.clientY + t2.clientY) / 2;

      const rect = whiteboardRef.current?.getBoundingClientRect();
      const canvasCenterX = (centerX - (rect?.left || 0)) / cz + cx;
      const canvasCenterY = (centerY - (rect?.top || 0)) / cz + cy;

      const nextCamera = {
        x: cx + (canvasCenterX - cx) * (cz / newCameraZoomFactor - 1),
        y: cy + (canvasCenterY - cy) * (cz / newCameraZoomFactor - 1),
        z: newCameraZoomFactor,
      };

      editor.setCamera(nextCamera, { duration: 175 });

      // Update initial distance for continuous pinch
      gesture.initialPinchDistance = currentDistance;
    }
  });

  const handleTouchMove = React.useMemo(
    () => throttle({ interval: 175 }, onTouchMove),
    [onTouchMove],
  );

  const handleTouchEnd = useEventCallback((event) => {
    if (event.touches.length < 2) {
      resetTouchZoomAfterCameraSettles();
    }

    const gesture = gestureRef.current;
    if (cameraRef.current?.laserEnabled && gesture.multiTouch && event.touches.length === 1) {
      const [touch] = event.touches;
      gesture.suppressLaser = true;
      gesture.postPinchTouchPoint = { x: touch.clientX, y: touch.clientY };
      return;
    }
    if (event.touches.length !== 0) return;

    if (hasWBAccess || isPresenter) {
      if (gesture.fingerCount === 2 && !gesture.pinching && hasWBAccess) {
        editor?.undo();
      } else if (gesture.fingerCount === 3 && hasWBAccess) {
        editor?.redo();
      }
    }
    // Suppress final touch updates until a new touch or mouse/pen input resumes.
    resetGesture(true);
  });

  const handleTouchCancel = useEventCallback(() => {
    resetTouchZoomAfterCameraSettles();
    resetGesture();
  });

  React.useEffect(() => {
    const targetDoc = whiteboardRef.current?.ownerDocument || document;
    const targetWin = targetDoc.defaultView || window;
    const wrapper = targetDoc.getElementById('presentationInnerWrapper');
    const laserEnabled = Boolean(
      isPresenter && laserMode && editor && targetWin.navigator.maxTouchPoints >= 2,
    );
    gestureRef.current = createGesture();
    cameraRef.current = {
      editor,
      laserEnabled,
      originalCanMoveCamera: laserEnabled ? editor.getInstanceState().canMoveCamera : undefined,
    };

    if (wrapper) {
      wrapper.addEventListener('pointerdown', handlePointerDown, true);
      wrapper.addEventListener('pointermove', handlePointerMove, true);
      wrapper.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
      wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
      wrapper.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
      wrapper.addEventListener('touchcancel', handleTouchCancel, true);
    }

    return () => {
      if (wrapper) {
        wrapper.removeEventListener('pointerdown', handlePointerDown, true);
        wrapper.removeEventListener('pointermove', handlePointerMove, true);
        wrapper.removeEventListener('touchstart', handleTouchStart, true);
        wrapper.removeEventListener('touchmove', handleTouchMove);
        wrapper.removeEventListener('touchend', handleTouchEnd, true);
        wrapper.removeEventListener('touchcancel', handleTouchCancel, true);
      }
      // Do not let an old gesture's timer clear a replacement gesture's status.
      clearTimeout(touchZoomResetTimeoutRef.current);
      // eslint-disable-next-line no-param-reassign
      isTouchZoomRef.current = false;
      // Keep suppression while useCursor flushes a pending update on unmount.
      resetGesture(true);
      cameraRef.current = null;
    };
  }, [
    editor, whiteboardRef, isTouchZoomRef, isPresenter, laserMode,
    handlePointerDown, handlePointerMove,
    handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, resetGesture,
  ]);

  return gestureRef;
};

export default useTouchGestures;
