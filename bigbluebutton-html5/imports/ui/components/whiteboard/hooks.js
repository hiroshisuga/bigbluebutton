import React, { useEffect } from 'react';
import { throttle } from 'radash';

// Keep native listeners stable while calling the latest committed handler.
const useEventCallback = (callback) => {
  const callbackRef = React.useRef(callback);

  React.useLayoutEffect(() => { callbackRef.current = callback; });

  return React.useCallback((...args) => callbackRef.current(...args), []);
};

const hasBackgroundImageUrl = (el) => {
  const style = window.getComputedStyle(el);
  const bg = style.backgroundImage || '';
  return bg.includes('url(');
};

const useCursor = (publishCursorUpdate, whiteboardId, getLaserType) => {
  const publishRef = React.useRef(publishCursorUpdate);
  const whiteboardIdRef = React.useRef(whiteboardId);
  const getLaserTypeRef = React.useRef(getLaserType);
  const pendingRef = React.useRef(null);
  const rafRef = React.useRef(null);

  useEffect(() => { publishRef.current = publishCursorUpdate; }, [publishCursorUpdate]);
  useEffect(() => { whiteboardIdRef.current = whiteboardId; }, [whiteboardId]);
  useEffect(() => { getLaserTypeRef.current = getLaserType; }, [getLaserType]);

  useEffect(() => () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (pendingRef.current) {
        publishRef.current({
          whiteboardId: whiteboardIdRef.current,
          ...pendingRef.current,
          laserType: getLaserTypeRef.current?.() ?? ''
        });
        pendingRef.current = null;
      }
    }
  }, []);

  const updateCursorPosition = React.useCallback((newX, newY) => {
    if (newX === undefined || newX === null || newY === undefined || newY === null) return;
    pendingRef.current = { xPercent: newX, yPercent: newY };
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current) {
          publishRef.current({
            whiteboardId: whiteboardIdRef.current,
            ...pendingRef.current,
            laserType: getLaserTypeRef.current?.() ?? '' 
          });
          pendingRef.current = null;
        }
      });
    }
  }, []);

  return updateCursorPosition;
};

const getPresentationOptionsMenuItem = () => document.querySelector('li#presentationFullscreen')
    || document.querySelector('li#presentationSnapshot')
    || document.querySelector('li#toolVisibility')
    || null;

const getTldrawOpenMenu = () => {
  const tlElement = document.querySelectorAll('[id^=radix-]');
  const tldrawMenu = Array.from(tlElement).find((el) => {
    const menuClasses = ['tlui-popover__content', 'tlui-menu'];
    if (el && menuClasses.includes(el.className)) {
      return el;
    }
    return false;
  });
  return tldrawMenu;
};

const useMouseEvents = ({
  whiteboardRef, tlEditorRef, isWheelZoomRef, initialZoomRef, isPresenterRef,
  mountedTldrawEditor,
}, {
  hasWBAccess,
  whiteboardToolbarAutoHide,
  animations,
  updateCursorPosition,
  toggleToolsAnimations,
  currentPresentationPage,
  zoomChanger,
  setIsMouseDown,
  setIsWheelZoom,
  setWheelZoomTimeout,
  isInfiniteWhiteboard,
}) => {
  const timeoutIdRef = React.useRef();
  const mouseLeaveTimeoutRef = React.useRef();
  const handleMouseUp = useEventCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    timeoutIdRef.current = setTimeout(() => {
      setIsMouseDown(false);
    }, 1000);

    tlEditorRef?.current?.updateInstanceState({ canMoveCamera: true, isReadonly: false });
  });

  const handleMouseDownWhiteboard = useEventCallback((event) => {
    if (!isPresenterRef.current && !hasWBAccess) {
      const updateProps = { isReadonly: false };

      if (event.button === 1) {
        updateProps.canMoveCamera = false;
      }

      tlEditorRef?.current?.updateInstanceState(updateProps);
    }

    setIsMouseDown(true);
  });

  const handleMouseDownWindow = useEventCallback((event) => {
    const { target } = event;
    const editor = tlEditorRef.current;
    const presentationInnerWrapper = document.getElementById('presentationInnerWrapper');

    if (!(presentationInnerWrapper && presentationInnerWrapper.contains(target))) {
      if (editor?.getEditingShape()) {
        return editor.complete();
      }
    }

    const selectedShapes = editor?.getSelectedShapes();
    if (
      selectedShapes?.length === 1
      && selectedShapes[0].type === 'frame'
      && editor?.getCurrentToolId() === 'select'
      && !target.matches('[data-testid*="selection.resize"]')
      && !target.matches('[data-testid*="selection.target"]')
      && hasBackgroundImageUrl(target)
    ) {
      editor.selectNone();
      return editor.complete();
    }

    return undefined;
  });

  const handleMouseEnter = useEventCallback(() => {
    clearTimeout(mouseLeaveTimeoutRef.current);
    if (whiteboardToolbarAutoHide) {
      toggleToolsAnimations(
        'fade-out',
        'fade-in',
        animations ? '.3s' : '0s',
        hasWBAccess || isPresenterRef.current,
      );
    }
  });

  const handleMouseLeave = useEventCallback(() => {
    if (whiteboardToolbarAutoHide) {
      clearTimeout(mouseLeaveTimeoutRef.current);
      const presentationWBOptionsMenuItem = getPresentationOptionsMenuItem();
      const tldrawMenu = getTldrawOpenMenu();
      if (presentationWBOptionsMenuItem || tldrawMenu) {
        if (tldrawMenu) {
          mouseLeaveTimeoutRef.current = setTimeout(() => {
            handleMouseLeave();
          }, 500);
        } else if (presentationWBOptionsMenuItem) {
          const ulElement = presentationWBOptionsMenuItem.parentElement;
          const menuWrapper = ulElement.parentElement;
          const isVisible = menuWrapper.style.visibility !== 'hidden';
          if (isVisible) {
            mouseLeaveTimeoutRef.current = setTimeout(() => {
              handleMouseLeave();
            }, 500);
          } else {
            toggleToolsAnimations(
              'fade-in',
              'fade-out',
              animations ? '3s' : '0s',
              hasWBAccess || isPresenterRef.current,
            );
          }
        } else {
          toggleToolsAnimations(
            'fade-in',
            'fade-out',
            animations ? '3s' : '0s',
            hasWBAccess || isPresenterRef.current,
          );
        }
      }
    }

    setTimeout(() => {
      updateCursorPosition(-1, -1);
    }, 150);
  });

  useEffect(() => () => clearTimeout(mouseLeaveTimeoutRef.current), []);

  const onMouseWheel = useEventCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!tlEditorRef.current || !isPresenterRef.current || !currentPresentationPage) {
      return;
    }

    setIsWheelZoom(true);

    const MAX_ZOOM_FACTOR = 4; // Represents 400%
    const MIN_ZOOM_FACTOR = isInfiniteWhiteboard ? 0.25 : 1;
    const ZOOM_IN_FACTOR = 0.25;
    const ZOOM_OUT_FACTOR = 0.25;

    // Get the current mouse position
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Get the current camera position and zoom level
    const { x: cx, y: cy, z: cz } = tlEditorRef.current.getCamera();

    let currentZoomLevel = cz / initialZoomRef.current;
    if (event.deltaY < 0) {
      currentZoomLevel = Math.min(currentZoomLevel + ZOOM_IN_FACTOR, MAX_ZOOM_FACTOR);
    } else {
      currentZoomLevel = Math.max(currentZoomLevel - ZOOM_OUT_FACTOR, MIN_ZOOM_FACTOR);
    }

    // Convert zoom level to a percentage for backend
    const zoomPercentage = currentZoomLevel * 100;
    zoomChanger(zoomPercentage);

    // Calculate the new camera zoom factor
    const newCameraZoomFactor = currentZoomLevel * initialZoomRef.current;

    // Calculate the mouse position in canvas space using whiteboardRef
    const rect = whiteboardRef.current?.getBoundingClientRect();
    const canvasMouseX = (mouseX - (rect?.left || 0)) / cz + cx;
    const canvasMouseY = (mouseY - (rect?.top || 0)) / cz + cy;

    // Calculate the new camera position to keep the mouse position under the cursor
    const nextCamera = {
      x: cx + (canvasMouseX - cx) * (cz / newCameraZoomFactor - 1),
      y: cy + (canvasMouseY - cy) * (cz / newCameraZoomFactor - 1),
      z: newCameraZoomFactor,
    };

    tlEditorRef.current.setCamera(nextCamera, { duration: 175 });

    if (isWheelZoomRef.currentTimeout) {
      clearTimeout(isWheelZoomRef.currentTimeout);
    }

    setWheelZoomTimeout();
  });

  const handleMouseWheel = React.useMemo(
    () => throttle({ interval: 175 }, onMouseWheel),
    [onMouseWheel],
  );

  React.useEffect(() => {
    if (whiteboardToolbarAutoHide) {
      toggleToolsAnimations(
        'fade-in',
        'fade-out',
        animations ? '3s' : '0s',
        hasWBAccess || isPresenterRef.current,
      );
    } else {
      toggleToolsAnimations(
        'fade-out',
        'fade-in',
        animations ? '.3s' : '0s',
        hasWBAccess || isPresenterRef.current,
      );
    }
  }, [whiteboardToolbarAutoHide]);

  React.useEffect(() => {
    const presentationWrapper = document.getElementById('presentationInnerWrapper');
    window.addEventListener('mousedown', handleMouseDownWindow);
    if (presentationWrapper) {
      presentationWrapper.addEventListener('mousedown', handleMouseDownWhiteboard);
      presentationWrapper.addEventListener('mouseup', handleMouseUp);
      presentationWrapper.addEventListener('mouseenter', handleMouseEnter);
      presentationWrapper.addEventListener('mouseleave', handleMouseLeave);
      presentationWrapper.addEventListener('wheel', handleMouseWheel, { passive: false, capture: true });
    }

    return () => {
      if (presentationWrapper) {
        presentationWrapper.removeEventListener('mousedown', handleMouseDownWhiteboard);
        presentationWrapper.removeEventListener('mouseup', handleMouseUp);
        presentationWrapper.removeEventListener('mouseenter', handleMouseEnter);
        presentationWrapper.removeEventListener('mouseleave', handleMouseLeave);
        presentationWrapper.removeEventListener('wheel', handleMouseWheel, { capture: true });
      }
      window.removeEventListener('mousedown', handleMouseDownWindow);
    };
  }, [
    tlEditorRef,
    isPresenterRef,
    mountedTldrawEditor,
    handleMouseDownWindow,
    handleMouseDownWhiteboard,
    handleMouseUp,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseWheel,
  ]);
};

export {
  useMouseEvents,
  useCursor,
  useEventCallback,
};
