import styled from 'styled-components';
import { colorWhite } from '/imports/ui/stylesheets/styled-components/palette';
import {
  mdPaddingX,
  mdPaddingY,
} from '/imports/ui/stylesheets/styled-components/general';
import { smallOnly } from '/imports/ui/stylesheets/styled-components/breakpoints';
import Select from 'react-select';

const SelectTranslation = styled(Select)`
  width: 100%;
`;

const Captions = styled.div`
  background-color: ${colorWhite};
  padding: ${mdPaddingY} ${mdPaddingY} ${mdPaddingX} ${mdPaddingX};
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  overflow: hidden;
  height: 100%;

  ${({ isChrome }) => isChrome && `
    transform: translateZ(0);
  `}

  @media ${smallOnly} {
    transform: none !important;
  }
`;

export default { Captions, SelectTranslation };
