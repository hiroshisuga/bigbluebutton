import React from 'react';
import Button from '/imports/ui/components/button/component';
import _ from 'lodash';
import { styles } from './styles';

const DEBOUNCE_TIMEOUT = 5000;
const DEBOUNCE_OPTIONS = {
  leading: true,
  trailing: false,
};

const ReloadButtonComponent = ({
  handleReload,
  label,
}) => (
  <div className={styles.button}>
    <Button
      color="primary"
      icon="refresh"
      size="md"
      circle
      onClick={_.debounce(handleReload, DEBOUNCE_TIMEOUT, DEBOUNCE_OPTIONS)}
      label={label}
      hideLabel
    />
  </div>
);

export default ReloadButtonComponent;
