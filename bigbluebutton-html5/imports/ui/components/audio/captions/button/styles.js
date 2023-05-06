import styled from 'styled-components';
import Button from '/imports/ui/components/common/button/component';
import Toggle from '/imports/ui/components/common/switch/component';
import {
  colorWhite,
  colorPrimary,
  colorOffWhite,
  colorDangerDark,
  colorSuccess,
} from '/imports/ui/stylesheets/styled-components/palette';

const ClosedCaptionToggleButton = styled(Button)`
  ${({ ghost }) => ghost && `
    span {
      box-shadow: none;
      background-color: transparent !important;
      border-color: ${colorWhite} !important;
    }
    i {
      margin-top: .4rem;
    }
  `}
`;

const SpanButtonWrapper = styled.span`
  position: relative;
`;

const TranscriptionToggle = styled(Toggle)`
  display: flex;
  justify-content: flex-start;
  padding-left: 1em;
`;

const TranslationToggle = styled(Toggle)`
  display: flex;
  justify-content: flex-start;
  padding-left: 1em;
`;

const TitleLabel = {
  fontWeight: 'bold',
  opacity: 1,
};

const EnableTrascription = {
  color: colorSuccess,
  textIndent: '1em',
};

const DisableTrascription = {
  color: colorDangerDark,
  textIndent: '1em',
};

const EnableTraslation = {
  color: colorSuccess,
  textIndent: '1em',
};

const DisableTraslation = {
  color: colorDangerDark,
  textIndent: '1em',
};

const NormalLabel = {
  textIndent: '1em',
};

const SelectedLabel = {
  color: colorPrimary,
  backgroundColor: colorOffWhite,
  textIndent: '1em',
};

export default {
  ClosedCaptionToggleButton,
  SpanButtonWrapper,
  TranscriptionToggle,
  TranslationToggle,
  TitleLabel,
  EnableTrascription,
  DisableTrascription,
  EnableTraslation,
  DisableTraslation,
  NormalLabel,
  SelectedLabel,
};
