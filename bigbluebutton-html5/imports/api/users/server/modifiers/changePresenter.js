import Logger from '/imports/startup/server/logger';
import Users from '/imports/api/users';
import Meetings from '/imports/api/meetings';
import { Slides } from '/imports/api/slides';
import stopWatchingExternalVideo from '/imports/api/external-videos/server/methods/stopWatchingExternalVideo';
import modifyWhiteboardAccess from '/imports/api/whiteboard-multi-user/server/modifiers/modifyWhiteboardAccess';
import RedisPubSub from '/imports/startup/server/redis';

export default function changePresenter(presenter, userId, meetingId, changedBy) {
  const selector = {
    meetingId,
    userId,
  };

  const modifier = {
    $set: {
      presenter,
      whiteboardAccess: presenter,
    },
  };

  try {
    const meeting = Meetings.findOne({ meetingId });
    if (meeting && meeting.externalVideoUrl) {
      Logger.info(`ChangePresenter:There is external video being shared. Stopping it due to presenter change, ${meeting.externalVideoUrl}`);
      stopWatchingExternalVideo({ meetingId, requesterUserId: userId });
    }

    const currentSlide = Slides.findOne({
      podId: 'DEFAULT_PRESENTATION_POD',
      meetingId,
      current: true,
    }, {
      fields: {
        id: 1,
      },
    });

    if (currentSlide) {
      modifyWhiteboardAccess(meetingId, currentSlide.id, 0);
      RedisPubSub.publishUserMessage(Meteor.settings.private.redis.channels.toAkkaApps, 'ModifyWhiteboardAccessPubMsg', meetingId, userId, {multiUser: 0, whiteboardId: currentSlide.id});
    }
    
    const numberAffected = Users.update(selector, modifier);

    if (numberAffected) {
      Logger.info(`Changed presenter=${presenter} id=${userId} meeting=${meetingId}`
        + `${changedBy ? ` changedBy=${changedBy}` : ''}`);
    }
  } catch (err) {
    Logger.error(`Changed user role: ${err}`);
  }
}
