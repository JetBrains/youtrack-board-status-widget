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
import Link from '@jetbrains/ring-ui/components/link/link';
import {SmartUserCardTooltip} from '@jetbrains/ring-ui/components/user-card/user-card';
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
import {
  getYouTrackService,
  loadAgiles,
  loadExtendedSprintData,
  getHubUser
} from './resources';
import ServiceUnavailableScreen from './service-unavailable-screen';


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
      isLoading: true,
      isLoadDataError: false
    };

    registerWidgetApi({
      onConfigure: () => this.setState({isConfiguring: true}),
      onRefresh: () => this.loadSelectedSprintData()
    });
  }

  componentDidMount() {
    this.initialize(this.props.dashboardApi);
  }

  async initialize(dashboardApi) {
    this.setLoadingEnabled(true);
    const config = await dashboardApi.readConfig();
    const youTrackService = await this.getYouTrack(config);
    if (youTrackService && youTrackService.id) {
      this.setYouTrack(youTrackService);
    }
    if (config && config.selectedAgile) {
      this.changeAgile(config.selectedAgile);
    }
    if (youTrackService) {
      const agiles = await loadAgiles(this.fetchYouTrack);
      this.setState({agiles});
      if (!this.state.selectedAgile) {
        this.changeAgile(agiles[0]);
      }
      await this.loadSelectedSprintData();
    }
    this.updateTitle();
    this.setLoadingEnabled(false);
  }

  async getYouTrack(config) {
    const {dashboardApi} = this.props;
    const configYouTrackId = config && config.youTrack && config.youTrack.id;
    const fetchHub = dashboardApi.fetchHub.bind(dashboardApi);
    return await getYouTrackService(fetchHub, configYouTrackId);
  }

  fetchYouTrack = async (url, params) => {
    const {youTrack} = this.state;
    const {dashboardApi} = this.props;
    return dashboardApi.fetch(youTrack.id, url, params);
  };

  setYouTrack(youTrackService) {
    this.setState({
      youTrack: {
        id: youTrackService.id,
        homeUrl: youTrackService.homeUrl
      }
    });
  }

  setLoadingEnabled(isLoading) {
    this.props.dashboardApi.setLoadingAnimationEnabled(isLoading);
    this.setState({isLoading});
  }

  saveConfig = async () => {
    const {selectedAgile, selectedSprint, youTrack} = this.state;
    await this.props.dashboardApi.storeConfig({
      selectedAgile,
      selectedSprint,
      youTrack
    });
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
    const {selectedAgile, selectedSprint, youTrack} = this.state;
    if (selectedAgile) {
      let title = `Board ${selectedAgile.name}`;
      let link = `${youTrack.homeUrl}/agiles/${selectedAgile.id}`;
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
            <Select
              data={agiles.map(toSelectItem)}
              selected={toSelectItem(selectedAgile)}
              onSelect={this.changeAgile}
              filter={true}
              label="Select board"
            />
          </div>
          {areSprintsEnabled(selectedAgile) &&
            <div className="ring-form__group">
              <Select
                data={(selectedAgile.sprints || []).map(toSelectItem)}
                selected={toSelectItem(selectedSprint)}
                onSelect={this.changeSprint}
                filter={true}
                label="Select sprint"
              />
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
    try {
      const extendedSprintData = await loadExtendedSprintData(
        this.fetchYouTrack, selectedAgile.id, selectedSprint.id
      );
      this.setState({extendedSprintData});
    } catch (err) {
      this.setState({isLoadDataError: true});
    }
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

    const homeUrl = this.state.youTrack.homeUrl;
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

    const dashboardApi = this.props.dashboardApi;
    const fetchHub = dashboardApi.fetchHub.bind(dashboardApi);
    const userSource = () =>
      getHubUser(fetchHub, selectedAgile.owner.ringId, homeUrl);

    return (
      <div className={styles.widget}>
        {
          extendedSprintData.goal &&
          <div className={styles.sprintCommonInfo}>
            {extendedSprintData.goal}
          </div>
        }
        <div className={styles.sprintCommonInfo}>
          <b>{'Owner:'}</b>&nbsp;
          <SmartUserCardTooltip userDataSource={userSource}>
            <Link
              href={`${homeUrl}/users/${selectedAgile.owner.ringId}`}
            >
              {selectedAgile.owner.fullName}
            </Link>
          </SmartUserCardTooltip>
        </div>
        <div
          className={styles.sprintProgress}
          style={progressBarWrapperStyle}
        >
          {
            boardProgressBars.map(boardProgressBar => (
              <Link
                key={`link-${boardProgressBar.columnId}`}
                href={getColumnUrl(boardProgressBar.columnId)}
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
              </Link>
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

  renderLoadDataError() {
    return (
      <div className={styles.widget}>
        <ServiceUnavailableScreen/>
      </div>
    );
  }

  render() {
    const {
      isConfiguring,
      selectedAgile,
      selectedSprint,
      isLoading,
      extendedSprintData,
      isLoadDataError
    } = this.state;

    if (isLoadDataError) {
      return this.renderLoadDataError();
    }
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
