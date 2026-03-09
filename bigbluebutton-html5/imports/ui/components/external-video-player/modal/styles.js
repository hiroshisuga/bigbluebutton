import styled from 'styled-components';
import { smallOnly } from '/imports/ui/stylesheets/styled-components/breakpoints';
import {
  borderSize,
  borderRadius,
  smPaddingY,
} from '/imports/ui/stylesheets/styled-components/general';
import {
  colorText,
  colorGrayLighter,
  colorGray,
  colorWhite,
  colorLink,
  colorBlueLight,
  colorPrimary,
} from '/imports/ui/stylesheets/styled-components/palette';
import { fontSizeSmall } from '/imports/ui/stylesheets/styled-components/typography';
import Modal from '/imports/ui/components/common/modal/simple/component';
import Button from '/imports/ui/components/common/button/component';

const UrlError = styled.div`
  color: red;
  padding: 1em 0;

  ${({ animations }) => animations && `
    transition: 1s;
  `}
`;

const Icon = styled.div`
  width: 1%;
  & > i {
    font-size: 1.35rem;
  }
`;

const Item = styled.tr`
  cursor: pointer;
`;

const Name = styled.th`
  height: 1rem;
  width: auto;
  position: relative;
  &:before {
    content: "\00a0";
    visibility: hidden;
  }
  & > span {
    @extend %text-elipsis;
    position: absolute;
    left: 0;
    right: 0;
    [dir="rtl"] & {
      right: 1rem;
    }
  }
`;

const Hidden = styled.div`
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  height: 1px; width: 1px;
  margin: -1px; padding: 0; border: 0;
`;

const List = styled.div`
  /*@include scrollbox-vertical();*/
  max-height: 35vh;
  width: 100%;
  padding: .5rem 0;
`;

const Table = styled.div`
  width: 100%;
  border-spacing: 0;
  border-collapse: collapse;
  & > thead {
  }
  & > tbody {
    text-align: left;
    [dir="rtl"] & {
      text-align: right;
    }
    & > tr {
      border-bottom: 1px solid var(--color-gray-light);
      &:last-child {
        border-bottom: 0;
      }
      &:hover,
      &:focus {
        background-color: transparentize(#8B9AA8, .85);
      }
      th,
      td {
        padding: calc(var(--sm-padding-y) * 2) calc(var(--sm-padding-x) / 2);
        white-space: nowrap;
      }
      th {
        font-weight: bold;
        color: var(--color-gray-dark);
      }
      td {
      }
    }
  }
`;

const ExternalVideoModal = styled(Modal)`
  padding: 1.5rem;
  min-height: 23rem;
`;

const Header = styled.header`
  margin: 0;
  padding: 0;
  border: none;
  line-height: 2rem;
`;

const Title = styled.h3`
  text-align: center;
  font-weight: 400;
  font-size: 1.3rem;
  white-space: normal;

  @media ${smallOnly} {
    font-size: 1rem;
    padding: 0 1rem;
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0;
  margin-right: auto;
  margin-left: auto;
  width: 100%;
`;

const VideoUrl = styled.div`
  margin: 0 ${borderSize} 0 ${borderSize};

  & > label {
    display: block;
  }

  & > label input {
    display: block;
    margin: 10px 0 10px 0;
    padding: 0.4em;
    color: ${colorText};
    line-height: 2rem;
    width: 100%;
    font-family: inherit;
    font-weight: inherit;
    border: 1px solid ${colorGrayLighter};
    border-radius: ${borderRadius};

    ${({ animations }) => animations && `
      transition: box-shadow .2s;
    `}

    &:focus {
      outline: none;
      border-radius: ${borderSize};
      box-shadow: 0 0 0 ${borderSize} ${colorBlueLight}, inset 0 0 0 1px ${colorPrimary};
    }
  }

  & > span {
    font-weight: 600;
  }
`;

const ExternalVideoNote = styled.div`
  color: ${colorGray};
  font-size: ${fontSizeSmall};
  font-style: italic;
  padding-top: ${smPaddingY};
`;

const StartButton = styled(Button)`
  display: flex;
  align-self: center;

  &:focus {
    outline: none !important;
  }

  & > i {
    color: #3c5764;
  }

  margin: 0;
  width: 40%;
  display: block;
  bottom: 20px;
  color: ${colorWhite} !important;
  background-color: ${colorLink} !important;
`;

export default {
  UrlError,
  ExternalVideoModal,
  Header,
  Title,
  Content,
  VideoUrl,
  ExternalVideoNote,
  StartButton,
  Item,
  Icon,
  Name,
};
