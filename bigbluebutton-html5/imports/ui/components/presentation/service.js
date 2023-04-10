import Presentations from '/imports/api/presentations';
import { Slides, SlidePositions } from '/imports/api/slides';
import ReactPlayer from 'react-player';
import WhiteboardService, { Annotations } from '/imports/ui/components/whiteboard/service';
import PollService from '/imports/ui/components/poll/service';
import { safeMatch } from '/imports/utils/string-utils';

const isUrlValid = url => ReactPlayer.canPlay(url);
const POLL_SETTINGS = Meteor.settings.public.poll;
const MAX_CUSTOM_FIELDS = POLL_SETTINGS.maxCustom;

const getCurrentAnnotationsId = (whiteboardId) => {
  if (!whiteboardId) {
    return null;
  }

  return Annotations.find(
    {
      whiteboardId,
    },
    {
      sort: { position: 1 },
      fields: { status: 1, _id: 1, id: 1, annotationType: 1, selected: 1 },
    },
  ).fetch();
};

const getSelectedAnnotationsId = (whiteboardId) => {
  if (!whiteboardId) {
    return null;
  }

  return Annotations.find(
    {
      whiteboardId,
      selected: true,
    },
    {
      sort: { position: 1 },
      fields: { id: 1, userId: 1, position: 1 },
    },
  ).fetch();
};

const selectAllAnnotation = (whiteboardId)  => {
  if (!whiteboardId) {
    return null;
  }

  const selector = {
    whiteboardId,
  };

  if (WhiteboardService.isMultiUserActive(whiteboardId)) {
    selector.userId = Auth.userID;
  }

  const modifier = {
    $set: {
      selected: true,
    },
  };

  Annotations.update(selector, modifier, {multi: true});
}

const moveSelectedAnnotations = (whiteboardId, selected, dx, dy) => {
  if (!whiteboardId) {
    return null;
  }

  for (let key in selected) {
    // Move only owned annotations in case of multiuser mode
    if (WhiteboardService.isMultiUserActive(whiteboardId) && selected[key].userId != Auth.userID) {
      continue;
    }
    WhiteboardService.moveAndUpdateOneAnnotation(whiteboardId, selected[key].id, {x: dx, y: dy});
  }
};

const bringAnnotations = (whiteboardId, selected, up) => {
  // "selected" must be sorted by position - getSelectedAnnotationsId does do the job
  if (!whiteboardId) {
    return null;
  }

  const sortedAnnotations = Annotations.find({whiteboardId},{ sort: { position: 1 }, fields: {id:1, position:1}}).fetch();

  const id2idx = new Map(); // annotation ID -> the position index in the array
  for (let key in sortedAnnotations) {
    id2idx.set(sortedAnnotations[key].id, key);
  }

  var orderContainer = []; // to get new position <-> annotation.id
  for (const a of sortedAnnotations) {
    orderContainer.push({position: a.position, id:""});
  }

  const selectedAnnotationId2position = new Map(); // IDs of selected annotations -> annotation.position
  // Increase positions of the selected annotations and put them into the container
  var moved = 0;
  if (up) {
    // Bringing up (forward)
    for (const s of selected.slice().reverse()) {
      // Include only owned annotations in case of multiuser mode
      if (WhiteboardService.isMultiUserActive(whiteboardId) && s.userId != Auth.userID) { continue; }
      selectedAnnotationId2position.set(s.id, s.position);
      let newIdx = parseInt(id2idx.get(s.id)) + 1;
      if (newIdx >= sortedAnnotations.length) { newIdx = sortedAnnotations.length - 1; }
      if (orderContainer[newIdx].id !== "") {
        newIdx -= 1;
      }
      orderContainer[newIdx].id = s.id;
      if (id2idx.get(s.id) != newIdx) {
        moved += 1;
      }
    }
  } else {
    // Bringing down (backward)
    for (const s of selected) {
      // Include only owned annotations in case of multiuser mode
      if (WhiteboardService.isMultiUserActive(whiteboardId) && s.userId != Auth.userID) { continue; }
      selectedAnnotationId2position.set(s.id, s.position);
      let newIdx = parseInt(id2idx.get(s.id)) - 1;
      if (newIdx < 0) { newIdx = 0; }
      if (orderContainer[newIdx].id !== "") {
        newIdx += 1;
      }
      orderContainer[newIdx].id = s.id;
      if (id2idx.get(s.id) != newIdx) {
        moved += 1;
      }
    }
  }

  if (moved == 0) {
    // No position change
    return null;
  } else {
    // Put the non-selected annotations to the rest of the container
    for (const a of sortedAnnotations) {
      if (selectedAnnotationId2position.get(a.id) === undefined){
        for (let key in orderContainer) {
          if (orderContainer[key].id === "") {
            orderContainer[key].id = a.id;
            break;
          }
        }
      }
    }

    for (const ac of orderContainer) {
      const selector = {
        whiteboardId,
        id: ac.id,
      };
      const modifier = {
        $set: {
          position: ac.position,
        },
      };
      Annotations.update(selector, modifier);
    }

    return orderContainer;
  }
};

const isAnnotationSelected = (whiteboardId, id) => {
  const isSelected =Annotations.findOne(
    {
      whiteboardId,
      id,
      selected: true,
    }
  );
  return isSelected ? true : false;
};

const handleSelectAnnotation = (whiteboardId, id) => {
  const selector = {
    whiteboardId,
    id,
  };

  const modifier = {
    $set: {
      selected: true,
    },
  };

  Annotations.update(selector, modifier);
};

const handleUnselectAnnotation = (whiteboardId, id) => {
  const selector = {
    whiteboardId,
    id,
  };

  const modifier = {
    $set: {
      selected: false,
    },
  };

  Annotations.update(selector, modifier);
};

const handleUnselectAllAnnotations = (whiteboardId) => {
  const selector = {
    whiteboardId,
    selected: true,
  };

  const modifier = {
    $set: {
      selected: false,
    },
  };

  Annotations.update(selector, modifier, {multi: true});
};

const getCurrentPresentation = (podId) => Presentations.findOne({
  podId,
  current: true,
});

const downloadPresentationUri = (podId) => {
  const currentPresentation = getCurrentPresentation(podId);
  if (!currentPresentation) {
    return null;
  }

  const presentationFileName = `${currentPresentation.id}.${currentPresentation.name.split('.').pop()}`;

  const APP = Meteor.settings.public.app;
  const uri = `${APP.bbbWebBase}/presentation/download/`
    + `${currentPresentation.meetingId}/${currentPresentation.id}`
    + `?presFilename=${encodeURIComponent(presentationFileName)}`;

  return uri;
};

const isPresentationDownloadable = (podId) => {
  const currentPresentation = getCurrentPresentation(podId);
  if (!currentPresentation) {
    return null;
  }

  return currentPresentation.downloadable;
};

const getCurrentSlide = (podId) => {
  const currentPresentation = getCurrentPresentation(podId);

  if (!currentPresentation) {
    return null;
  }

  return Slides.findOne({
    podId,
    presentationId: currentPresentation.id,
    current: true,
  }, {
    fields: {
      meetingId: 0,
      thumbUri: 0,
      swfUri: 0,
      txtUri: 0,
    },
  });
};

const getSlidePosition = (podId, presentationId, slideId) => SlidePositions.findOne({
  podId,
  presentationId,
  id: slideId,
});

const currentSlidHasContent = () => {
  const currentSlide = getCurrentSlide('DEFAULT_PRESENTATION_POD');
  if (!currentSlide) return false;

  const {
    content,
  } = currentSlide;

  return !!content.length;
};

const parseCurrentSlideContent = (yesValue, noValue, abstentionValue, trueValue, falseValue) => {
  const { pollTypes } = PollService;
  const currentSlide = getCurrentSlide('DEFAULT_PRESENTATION_POD');
  const quickPollOptions = [];
  if (!currentSlide) return quickPollOptions;

  let {
    content,
  } = currentSlide;

  const urlRegex = /((http|https):\/\/[a-zA-Z0-9\-.:]+(\/\S*)?)/g;
  const optionsUrls = content.match(urlRegex) || [];
  const videoUrls = optionsUrls.filter(value => isUrlValid(value));
  const urls = optionsUrls.filter(i => videoUrls.indexOf(i) == -1);
  content = content.replace(new RegExp(urlRegex), '');
  
  const questionRegex = /.*?\?/gm;
  const question = safeMatch(questionRegex, content, '');

  const doubleQuestionRegex = /\?{2}/gm;
  const doubleQuestion = safeMatch(doubleQuestionRegex, content, false);

  const yesNoPatt = /.*(yes\/no|no\/yes).*/gm;
  const hasYN = safeMatch(yesNoPatt, content, false);

  const trueFalsePatt = /.*(true\/false|false\/true).*/gm;
  const hasTF = safeMatch(trueFalsePatt, content, false);

  //const pollRegex = /[1-9A-Ia-i][.)].*/g;
  //const pollRegex = /(\d{1,2}|[A-Za-z])[.)].*/g;
  //const pollRegex = /\b[1-9A-Ia-i][.)] .*/g;
  const pollRegex = /\b(\d{1,2}|[A-Za-z])[.)] .*/g;
  let optionsPoll = safeMatch(pollRegex, content, []);
  const optionsWithLabels = [];

  if (hasYN) {
    optionsPoll = ['yes', 'no'];
  }

  if (optionsPoll) {
    optionsPoll = optionsPoll.map((opt) => {
      const MAX_CHAR_LIMIT = 30;
      const formattedOpt = opt.substring(0, MAX_CHAR_LIMIT);
      optionsWithLabels.push(formattedOpt);
      return `\r${opt[0]}.`;
    });
  }

  optionsPoll.reduce((acc, currentValue) => {
    const lastElement = acc[acc.length - 1];

    if (!lastElement) {
      acc.push({
        options: [currentValue],
      });
      return acc;
    }

    const {
      options,
    } = lastElement;

    const lastOption = options[options.length - 1];

    const isLastOptionInteger = !!parseInt(lastOption.charAt(1), 10);
    const isCurrentValueInteger = !!parseInt(currentValue.charAt(1), 10);

    if (isLastOptionInteger === isCurrentValueInteger) {
      if (currentValue.toLowerCase().charCodeAt(1) > lastOption.toLowerCase().charCodeAt(1)) {
        options.push(currentValue);
      } else {
        acc.push({
          options: [currentValue],
        });
      }
    } else {
      acc.push({
        options: [currentValue],
      });
    }
    return acc;
  }, []).filter(({
    options,
  }) => options.length > 1 && options.length < 99).forEach((p) => {
    const poll = p;
    if (doubleQuestion) poll.multiResp = true;
    if (poll.options.length <= 5 || MAX_CUSTOM_FIELDS <= 5) {
      const maxAnswer = poll.options.length > MAX_CUSTOM_FIELDS
        ? MAX_CUSTOM_FIELDS
        : poll.options.length;
      quickPollOptions.push({
        type: `${pollTypes.Letter}${maxAnswer}`,
        poll,
      });
    } else {
      quickPollOptions.push({
        type: pollTypes.Custom,
        poll,
      });
    }
  });

  if (question.length > 0 && optionsPoll.length === 0 && !doubleQuestion && !hasYN && !hasTF) {
    quickPollOptions.push({
      type: 'R-',
      poll: {
        question: question[0],
      },
    });
  }

  if (quickPollOptions.length > 0) {
    content = content.replace(new RegExp(pollRegex), '');
  }

  const ynPoll = PollService.matchYesNoPoll(yesValue, noValue, content);
  const ynaPoll = PollService.matchYesNoAbstentionPoll(yesValue, noValue, abstentionValue, content);
  const tfPoll = PollService.matchTrueFalsePoll(trueValue, falseValue, content);

  ynPoll.forEach((poll) => quickPollOptions.push({
    type: pollTypes.YesNo,
    poll,
  }));

  ynaPoll.forEach((poll) => quickPollOptions.push({
    type: pollTypes.YesNoAbstention,
    poll,
  }));

  tfPoll.forEach((poll) => quickPollOptions.push({
    type: pollTypes.TrueFalse,
    poll,
  }));

  const pollQuestion = (question?.length > 0 && question[0]?.replace(/ *\([^)]*\) */g, '')) || '';

  return {
    slideId: currentSlide.id,
    quickPollOptions,
    optionsWithLabels,
    pollQuestion,
    videoUrls,
    urls,
  };
};

export const copyStyles = (sourceDoc, targetDoc) => {
  //To be fair, I declare that this was copied from https://medium.com/hackernoon/using-a-react-16-portal-to-do-something-cool-2a2d627b0202
  const hostUri = `https://${window.document.location.hostname}`;
  const baseName = hostUri + Meteor.settings.public.app.cdn + Meteor.settings.public.app.basename + Meteor.settings.public.app.instanceId;
  Array.from(sourceDoc.styleSheets).forEach(styleSheet => {
    if (styleSheet.cssRules) {
      const newStyleEl = sourceDoc.createElement('style');
      Array.from(styleSheet.cssRules).forEach(cssRule => {
        let newCssText;
        if (cssRule.cssText.match(/url\(\"[fonts|files]/)) {
          newCssText = cssRule.cssText.replace(/url\(\"([^\"]*)/g, function(){return 'url("' + baseName + '/' + arguments[1]});
        } else {
          newCssText = cssRule.cssText;
        }
console.log("CSS", newCssText);
        newStyleEl.appendChild(sourceDoc.createTextNode(newCssText));
      });
      targetDoc.head.appendChild(newStyleEl);
    } else if (styleSheet.href) {
      const newLinkEl = sourceDoc.createElement('link');
      newLinkEl.rel = 'stylesheet';
      newLinkEl.href = styleSheet.href;
      targetDoc.head.appendChild(newLinkEl);
    }
  });
}

export default {
  getCurrentSlide,
  getSlidePosition,
  isPresentationDownloadable,
  downloadPresentationUri,
  currentSlidHasContent,
  parseCurrentSlideContent,
  getCurrentPresentation,
  getCurrentAnnotationsId,
  getSelectedAnnotationsId,
  moveSelectedAnnotations,
  bringAnnotations,
  isAnnotationSelected,
  handleSelectAnnotation,
  handleUnselectAnnotation,
  handleUnselectAllAnnotations,
  selectAllAnnotation,
};
