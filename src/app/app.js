import 'babel-polyfill';
import DashboardAddons from 'hub-dashboard-addons';
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {render} from 'react-dom';
import Select from '@jetbrains/ring-ui/components/select/select';
import Panel from '@jetbrains/ring-ui/components/panel/panel';
import Button from '@jetbrains/ring-ui/components/button/button';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import Tooltip from '@jetbrains/ring-ui/components/tooltip/tooltip';
import classNames from 'classnames';

import '@jetbrains/ring-ui/components/form/form.scss';
import '@jetbrains/ring-ui/components/input-size/input-size.scss';

import 'file-loader?name=[name].[ext]!../../manifest.json'; // eslint-disable-line import/no-unresolved
import styles from './app.css';
import {
  countBoardProgress,
  getColumnSearchUrl,
  areSprintsEnabled,
  MAX_PROGRESS_BAR_HEIGHT
} from './agile-board-model';
import {getYouTrackService, loadAgiles, loadExtendedSprintData} from './resources';


class Widget extends Component {
  static propTypes = {
    dashboardApi: PropTypes.object,
    registerWidgetApi: PropTypes.func
  };

  constructor(props) {
    super(props);
    const {registerWidgetApi} = props;

    this.state = {
      isConfiguring: false,
      isLoading: true
    };

    registerWidgetApi({
      onConfigure: () => this.setState({isConfiguring: true}),
      onRefresh: () => this.loadSelectedSprintData()
    });
  }

  componentDidMount() {
    this.initialize(this.props.dashboardApi);
  }

  initialize = async dashboardApi => {
    this.setLoadingEnabled(true);
    const fetchHub = dashboardApi.fetchHub.bind(dashboardApi);
    this.ytTrackService = await getYouTrackService(fetchHub);
    this.fetchYouTrack = async (url, params) =>
      dashboardApi.fetch(this.ytTrackService.id, url, params);
    const agiles = await loadAgiles(this.fetchYouTrack);
    const config = await dashboardApi.readConfig();
    const selectedAgile = (config && config.selectedAgile) || agiles[0];
    this.changeAgile(selectedAgile);
    this.setState({agiles});
    this.updateTitle();
    this.setLoadingEnabled(false);
  };

  setLoadingEnabled(isLoading) {
    this.props.dashboardApi.setLoadingAnimationEnabled(isLoading);
    this.setState({isLoading});
  }

  saveConfig = async () => {
    const {selectedAgile, selectedSprint} = this.state;
    await this.props.dashboardApi.storeConfig({selectedAgile, selectedSprint});
    await this.loadSelectedSprintData();
    this.setState({isConfiguring: false});
    this.updateTitle();
  };

  cancelConfig = async () => {
    this.setState({isConfiguring: false});
    await this.props.dashboardApi.exitConfigMode();
    this.initialize(this.props.dashboardApi);
  };

  changeAgile = selected => {
    const selectedAgile = selected.model || selected;
    const sprints = selectedAgile && selectedAgile.sprints || [];
    if (sprints.length) {
      this.changeSprint(sprints[0]);
    }
    this.setState({selectedAgile});
  };

  changeSprint = selected => {
    this.setState({
      selectedSprint: selected.model || selected
    });
  };

  updateTitle() {
    const {selectedAgile, selectedSprint} = this.state;
    if (selectedAgile) {
      let title = `Board ${selectedAgile.name}`;
      let link = `${this.ytTrackService.homeUrl}/agiles/${selectedAgile.id}`;
      if (selectedSprint && areSprintsEnabled(selectedAgile)) {
        title += `: ${selectedSprint.name}`;
        link += `/${selectedSprint.id}`;
      }
      this.props.dashboardApi.setTitle(title, link);
    }
  }

  renderConfiguration() {
    const toSelectItem = it => it && {key: it.id, label: it.name, model: it};
    const {agiles, selectedAgile, selectedSprint} = this.state;

    return (
      <div className={styles.widget}>
        <div className={classNames('ring-form', styles.widgetEditForm)}>
          <div className="ring-form__group">
            <label className="ring-form__label">{'Board'}</label>
            <div className="ring-form__control ring-form__control_small">
              <Select
                className="ring-input-size_md"
                data={agiles.map(toSelectItem)}
                selected={toSelectItem(selectedAgile)}
                onSelect={this.changeAgile}
                label="Select board"
              />
            </div>
          </div>
          {areSprintsEnabled(selectedAgile) &&
            <div className="ring-form__group">
              <label className="ring-form__label">{'Sprint'}</label>
              <div className="ring-form__control ring-form__control_small">
                <Select
                  className="ring-input-size_md"
                  data={(selectedAgile.sprints || []).map(toSelectItem)}
                  selected={toSelectItem(selectedSprint)}
                  onSelect={this.changeSprint}
                  label="Select sprint"
                />
              </div>
            </div>
          }
        </div>
        <Panel>
          <Button blue={true} onClick={this.saveConfig}>{'Save'}</Button>
          <Button onClick={this.cancelConfig}>{'Cancel'}</Button>
        </Panel>
      </div>
    );
  }

  async loadSelectedSprintData() {
    const {selectedAgile, selectedSprint} = this.state;
    const extendedSprintData = await loadExtendedSprintData(
      this.fetchYouTrack, selectedAgile.id, selectedSprint.id
    );
    this.setState({extendedSprintData});
  }

  renderLoader() {
    return <LoaderInline/>;
  }

  renderWidgetBody(selectedAgile, selectedSprint, extendedSprintData) {
    const boardData = extendedSprintData.board;
    const boardProgressBars = countBoardProgress(boardData);

    const progressBarWrapperStyle = {
      height: `${MAX_PROGRESS_BAR_HEIGHT}px`
    };
    const tooltipHeight = 40;
    const plotWidthPercents = 100;
    const progressBarCSSWidthValue = `calc(${plotWidthPercents / boardProgressBars.length}% - 8px)`;
    const progressBarStyle = {
      height: `${MAX_PROGRESS_BAR_HEIGHT}px`,
      width: progressBarCSSWidthValue
    };
    const getProgressDataClassName = progressBarData => classNames(
      {
        [styles.sprintProgressData]: true,
        [styles.sprintProgressDataOverdue]: progressBarData.overdue
      }
    );

    const homeUrl = this.ytTrackService.homeUrl;
    const getColumnUrl = columnId => {
      const column = (boardData.columns || []).
        filter(currentColumn => currentColumn.id === columnId)[0];
      if (!column) {
        return '';
      }
      const searchUrl = getColumnSearchUrl(
        selectedAgile, selectedSprint, column
      );
      return `${homeUrl}/issues?q=${searchUrl}`;
    };

    return (
      <div className={styles.widget}>
        <div
          className={styles.sprintProgress}
          style={progressBarWrapperStyle}
        >
          {
            boardProgressBars.map(boardProgressBar => (
              <a
                key={`link-${boardProgressBar.columnId}`}
                href={getColumnUrl(boardProgressBar.columnId)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Tooltip
                  key={`tooltip-${boardProgressBar.columnId}`}
                  popupProps={{top: -(MAX_PROGRESS_BAR_HEIGHT + tooltipHeight)}}
                  title={boardProgressBar.title}
                >
                  <span
                    key={`bar-${boardProgressBar.columnId}`}
                    className={styles.sprintProgressBar}
                    style={progressBarStyle}
                  >
                    <span
                      key={`data-${boardProgressBar.columnId}`}
                      className={getProgressDataClassName(boardProgressBar)}
                      style={{height: `${boardProgressBar.height}px`}}
                    />
                  </span>
                </Tooltip>
              </a>
            ))
          }
        </div>
        <div>
          {
            boardProgressBars.map(boardProgressBar => (
              <span
                key={`bar-label-${boardProgressBar.columnId}`}
                className={styles.sprintProgressBarLabel}
                style={{width: progressBarCSSWidthValue}}
              >
                {boardProgressBar.columnName}
              </span>
            ))
          }
        </div>
      </div>
    );
  }

  render() {
    const {
      isConfiguring,
      selectedAgile,
      selectedSprint,
      isLoading,
      extendedSprintData
    } = this.state;

    if (isLoading) {
      return this.renderLoader();
    }
    if (isConfiguring) {
      return this.renderConfiguration();
    }
    if (!selectedAgile || !selectedSprint) {
      this.props.dashboardApi.enterConfigMode();
      return this.renderConfiguration();
    }
    if (!extendedSprintData) {
      this.loadSelectedSprintData();
      return this.renderLoader();
    }
    return this.renderWidgetBody(
      selectedAgile, selectedSprint, extendedSprintData
    );
  }
}

DashboardAddons.registerWidget(async (dashboardApi, registerWidgetApi) => {
  render(
    <Widget
      dashboardApi={dashboardApi}
      registerWidgetApi={registerWidgetApi}
    />,
    document.getElementById('app-container')
  );
});
