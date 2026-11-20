function getFullscreenElement(doc = document) {
  if (doc.fullscreenElement) return doc.fullscreenElement;
  if (doc.webkitFullscreenElement) return doc.webkitFullscreenElement;
  if (doc.mozFullScreenElement) return doc.mozFullScreenElement;
  if (doc.msFullscreenElement) return doc.msFullscreenElement;
  return null;
}

const isFullScreen = (element) => {
  const doc = element?.ownerDocument || document;
  return getFullscreenElement(doc) === element;
};

function cancelFullScreen(doc = document) {
  if (doc.exitFullscreen) {
    doc.exitFullscreen();
  } else if (doc.mozCancelFullScreen) {
    doc.mozCancelFullScreen();
  } else if (doc.webkitExitFullscreen) {
    doc.webkitExitFullscreen();
  }
}

function fullscreenRequest(element) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  } else {
    return;
  }
  const doc = element.ownerDocument;
  doc.activeElement?.blur();
  element.focus();
}

const toggleFullScreen = (ref = null) => {
  const element = ref || document.documentElement;
  const doc = element.ownerDocument;

  if (isFullScreen(element)) {
    cancelFullScreen(doc);
  } else {
    fullscreenRequest(element);
  }
};

export default {
  toggleFullScreen,
  isFullScreen,
  getFullscreenElement,
};
