import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {i18n} from 'hub-dashboard-addons/dist/localization';

import styles from './widget-error-screen.css';

export default class WidgetErrorScreen extends Component {

  static propTypes = {
    smile: PropTypes.string,
    text: PropTypes.string,
    children: PropTypes.node
  };

  static defaultProps = {
    smile: '{{ (>_<) }}',
    text: i18n('Can\'t load information from service.')
  };

  render() {
    const {smile, text, children} = this.props;

    return (
      <div className={styles.widgetErrorScreen}>
        <div className={styles.widgetErrorSmile}>
          { smile }
        </div>
        <div className={styles.widgetErrorMessage}>
          { text }
        </div>
        <div className={styles.widgetErrorAdditional}>
          { children }
        </div>
      </div>
    );
  }
}
