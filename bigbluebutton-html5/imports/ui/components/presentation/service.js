import Presentations from '/imports/api/presentations';
import { Slides, SlidePositions } from '/imports/api/slides';
import ReactPlayer from 'react-player';
import PollService from '/imports/ui/components/poll/service';
import { safeMatch } from '/imports/utils/string-utils';

const isUrlValid = url => ReactPlayer.canPlay(url);
const POLL_SETTINGS = Meteor.settings.public.poll;
const MAX_CUSTOM_FIELDS = POLL_SETTINGS.maxCustom;

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
      txtUri: 0,
    },
  });
};

const getSlidesLength = (podId) => {
  return getCurrentPresentation(podId)?.pages?.length || 0;
}

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
  
  const pollRegex = /\b(\d{1,2}|[A-Za-z])[.)].*/g; //from (#16622) + #16650
  let optionsPoll = content.match(pollRegex) || [];
  let optionsPollStrings = [];
  if (optionsPoll) optionsPollStrings = optionsPoll.map(opt => `${opt.replace(/^[^.)]{1,2}[.)]/,'').replace(/^\s+/, '')}`);
  if (optionsPoll) optionsPoll = optionsPoll.map(opt => `\r${opt.replace(/[.)].*/,'')}.`);
  
  const questionRegex = /.*?\?/gm;
  const question = safeMatch(questionRegex, content, '');

  if (question?.length > 0) {
    const urlRegex = /\bhttps?:\/\/\S+\b/g;
    const hasUrl = safeMatch(urlRegex, question[0], '');
    if (hasUrl.length > 0) question.pop();
  }

  const doubleQuestionRegex = /\?{2}/gm;
  const doubleQuestion = safeMatch(doubleQuestionRegex, content, false);

  const yesNoPatt = /.*(yes\/no|no\/yes).*/gm;
  const hasYN = safeMatch(yesNoPatt, content, false);

  const trueFalsePatt = /.*(true\/false|false\/true).*/gm;
  const hasTF = safeMatch(trueFalsePatt, content, false);

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
  }) => options.length > 1 && options.length < MAX_CUSTOM_FIELDS).forEach((p) => {
    const poll = p;
    if (doubleQuestion) poll.multiResp = true;
      quickPollOptions.push({
        type: pollTypes.Custom,
        poll,
      });
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
    pollQuestion,
    videoUrls,
    urls,
  };
};

export default {
  getCurrentSlide,
  getSlidePosition,
  isPresentationDownloadable,
  downloadPresentationUri,
  currentSlidHasContent,
  parseCurrentSlideContent,
  getCurrentPresentation,
  getSlidesLength,
};
