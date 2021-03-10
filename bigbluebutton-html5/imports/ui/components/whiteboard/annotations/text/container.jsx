import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import TextShapeService from './service';
import TextDrawComponent from './component';

const TextDrawContainer = props => (
  <TextDrawComponent {...props} />
);

export default withTracker((params) => {
  const { whiteboardId } = params;
  const isPresenter = TextShapeService.isPresenter();
  const isMultiUser = TextShapeService.getMultiUserStatus(whiteboardId);
  const activeTextShapeId = TextShapeService.activeTextShapeId();
  let isActive = false;

  if ((isPresenter || isMultiUser) && activeTextShapeId === params.annotation.id) {
    isActive = true;
  }
  return {
    isActive,
    setTextShapeValue: TextShapeService.setTextShapeValue,
    resetTextShapeActiveId: TextShapeService.resetTextShapeActiveId,
    setTextShapeOffset: TextShapeService.setTextShapeOffset,
  };
})(TextDrawContainer);
