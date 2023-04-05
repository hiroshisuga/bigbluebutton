//@import "/imports/ui/stylesheets/variables/_all";
//@import "/imports/ui/components/modal/simple/styles";
//@import "/imports/ui/stylesheets/mixins/focus";
//@import "/imports/ui/stylesheets/mixins/_scrollable";
import styled from 'styled-components';
import Modal from '/imports/ui/components/common/modal/simple/component';
import Button from '/imports/ui/components/common/button/component';
import Dropzone from 'react-dropzone';

const Header = styled.header`
  margin: 0;
  padding: 0;
  border: none;
  line-height: 2rem;
`;

const Content = styled.h4`
  align-items: center;
  display: flex;
  flex-direction: column;
  padding: .5rem 0 2rem 0;
  overflow: hidden;
`;

/*const Overlay = styled(Modal)`
  @extend .overlay;
`;*/

const ModalStyle = styled(Modal)`
  @extend .modal;
  padding: 1.5rem;
  min-height: 20rem;
`;

const Title = styled.h3`
  text-align: center;
  font-weight: 400;
  font-size: 1.3rem;
  color: var(--color-background);
  white-space: normal;

  @include mq($small-only) {
    font-size: 1rem;
    padding: 0 1rem;
  }
`;

/*.dropzoneWrapper {
  width: 100%;
  display: flex;
  margin-top: calc(var(--lg-padding-y) * 5);
}*/

const DropzoneStyle = styled(Dropzone)`
  flex: auto;
  border: 2px dashed;
  border-radius: var(--border-radius);
  padding: calc(var(--lg-padding-y) * 2.5) var(--lg-padding-x);
  text-align: center;
  font-size: var(--font-size-large);
  cursor: pointer;
  width: 100%;
`;

/*.dropzoneActive {
  background-color: var(--color-gray-lighter);
}*/

/*.dropzoneIcon {
  font-size: calc(var(--font-size-large) * 3);
}*/

const DropzoneMessage = styled.p`
  margin: var(--md-padding-y) 0;
`;

const Hidden = styled.th`
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

const Table = styled.table`
  width: 100%;
  border-spacing: 0;
  border-collapse: collapse;

  > thead {
  }

  > tbody {
    text-align: left;

    [dir="rtl"] & {
      text-align: right;
    }

    > tr {
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

const Icon = styled.td`
  width: 1%;
  > i {
    font-size: 1.35rem;
  }
`;

const Actions = styled.td`
  width: 1%;
  text-align: left;

  [dir="rtl"] & {
    text-align: right;
  }
`;

/*.icon > i {
  font-size: 1.35rem;
}*/

const Name = styled.th`
  height: 1rem;
  width: auto;
  position: relative;

  &:before {
    content: "\00a0";
    visibility: hidden;
  }

  > span {
    /*@extend %text-elipsis;*/
    position: absolute;
    left: 0;
    right: 0;

    [dir="rtl"] & {
      right: 1rem;
    }
  }
`;

const Action = styled(Button)`
  div > i {
    margin-top: .25rem;
  }
  display: inline-block;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.35rem;
  color: var(--color-gray-light);
  padding: 0;

  :global(.animationsEnabled) & {
    transition: all .25s;
  }

  :hover, :focus {
    padding: unset !important;
  }

  background-color: transparent;
  border: 0 !important;

  & > i:focus,
  & > i:hover {
    color: var(--color-danger) !important;
    background-color: transparent;
  }

  &[aria-disabled="true"] {
    cursor: not-allowed;
    opacity: .5;
    box-shadow: none;
    pointer-events: none;
  }
`;

/*.action,
.action > i {
  display: inline-block;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.35rem;
  color: var(--color-gray-light);
  padding: 0;

  :global(.animationsEnabled) & {
    transition: all .25s;
  }

  :hover, :focus {
    padding: unset !important;
  }
}

.remove {
  background-color: transparent;
  border: 0 !important;

  & > i:focus,
  & > i:hover {
    color: var(--color-danger) !important;
    background-color: transparent;
  }

  &[aria-disabled="true"] {
    cursor: not-allowed;
    opacity: .5;
    box-shadow: none;
    pointer-events: none;
  }
}*/

const Buttons = styled.div`
  margin-left: auto;
  margin-right: 3px;


  [dir="rtl"] & {
    margin-right: auto;
    margin-left: 3px;
  }

  :first-child {
    margin-right: 3px;
    margin-left: inherit;

    [dir="rtl"] & {
      margin-right: inherit;
      margin-left: 3px;
    }
  }
`;

const Footer = styled.div`
  display: flex;
`;

export default {
  Header,
  Content,
  ModalStyle,
  Title,
  DropzoneStyle,
  DropzoneMessage,
  Hidden,
  List,
  Table,
  Icon,
  Actions,
  Name,
  Action,
  Buttons,
  Footer,
};
