import PresentationPods from '/imports/api/presentation-pods';
import Presentations from '/imports/api/presentations';
import { Slides, SlidePositions } from '/imports/api/slides';
import Auth from '/imports/ui/services/auth';
import ReactPlayer from 'react-player';
import PollService from '/imports/ui/components/poll/service';

const isUrlValid = url => ReactPlayer.canPlay(url);
const POLL_SETTINGS = Meteor.settings.public.poll;
const MAX_CUSTOM_FIELDS = POLL_SETTINGS.maxCustom;

const getCurrentPresentation = podId => Presentations.findOne({
  podId,
  current: true,
});

const downloadPresentationUri = (podId) => {
  const currentPresentation = getCurrentPresentation(podId);
  if (!currentPresentation) {
    return null;
  }

  const presentationFileName = `${currentPresentation.id}.${currentPresentation.name.split('.').pop()}`;

  const uri = `https://${window.document.location.hostname}/bigbluebutton/presentation/download/`
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
  const pollTypes = PollService.pollTypes;
  const currentSlide = getCurrentSlide('DEFAULT_PRESENTATION_POD');
  const quickPollOptions = [];
  if (!currentSlide) return quickPollOptions;

  let {
    content,
  } = currentSlide;

  const pollRegex = /(\d{1,2}|[A-Za-z])[.)].*/g;
  let optionsPoll = content.match(pollRegex) || [];
  let optionsPollStrings = [];
  if (optionsPoll) optionsPollStrings = optionsPoll.map(opt => `${opt.replace(/^[^.)]{1,2}[.)]/,'').replace(/^\s+/, '')}`);
  if (optionsPoll) optionsPoll = optionsPoll.map(opt => `\r${opt.replace(/[.)].*/,'')}.`);

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
      if (isCurrentValueInteger){
        if (parseInt(currentValue.replace(/[\r.]g/,'')) == parseInt(lastOption.replace(/[\r.]g/,'')) + 1) {
          options.push(currentValue);
        } else {
          acc.push({
            options: [currentValue],
          });
        }
      } else {
        if (currentValue.toLowerCase().charCodeAt(1) == lastOption.toLowerCase().charCodeAt(1) + 1) {
          options.push(currentValue);
        } else {
          acc.push({
            options: [currentValue],
          });
        }
      }
    } else {
      acc.push({
        options: [currentValue],
      });
    }
    return acc;
  }, []).map(poll => {
    for (let i = 0 ; i < poll.options.length ; i++) {
      poll.options.shift();
      poll.options.push(optionsPollStrings.shift());
    }
    return poll;
  }).filter(({
    options,
  }) => options.length > 1 && options.length < 99).forEach(poll => {
      quickPollOptions.push({
        type: pollTypes.Custom,
        poll,
      })
  });

  if (quickPollOptions.length > 0) {
    content = content.replace(new RegExp(pollRegex), '');
  }

  const ynPoll = PollService.matchYesNoPoll(yesValue, noValue, content);
  const ynaPoll = PollService.matchYesNoAbstentionPoll(yesValue, noValue, abstentionValue, content);
  const tfPoll = PollService.matchTrueFalsePoll(trueValue, falseValue, content);

  ynPoll.forEach(poll => quickPollOptions.push({
    type: pollTypes.YesNo,
    poll,
  }));

  ynaPoll.forEach(poll => quickPollOptions.push({
    type: pollTypes.YesNoAbstention,
    poll,
  }));

  tfPoll.forEach(poll => quickPollOptions.push({
    type: pollTypes.TrueFalse,
    poll,
  }));

  const urlRegex = /((http|https):\/\/[a-zA-Z0-9\-.:]+(\/\S*)?)/g;
  const optionsUrls = content.match(urlRegex) || [];
  const videoUrls = optionsUrls.filter(value => isUrlValid(value));
  const urls = optionsUrls.filter(i => videoUrls.indexOf(i) == -1);
  
  return {
    slideId: currentSlide.id,
    quickPollOptions,
    videoUrls,
    urls,
  };
};

const isPresenter = (podId) => {
  const selector = {
    meetingId: Auth.meetingID,
    podId,
  };
  const pod = PresentationPods.findOne(selector);
  return pod?.currentPresenterId === Auth.userID;
};

export default {
  getCurrentSlide,
  getSlidePosition,
  isPresenter,
  isPresentationDownloadable,
  downloadPresentationUri,
  currentSlidHasContent,
  parseCurrentSlideContent,
  getCurrentPresentation,
};
