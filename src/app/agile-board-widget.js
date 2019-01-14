import React, {Component} from 'react';
import PropTypes from 'prop-types';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import Tooltip from '@jetbrains/ring-ui/components/tooltip/tooltip';
import Link from '@jetbrains/ring-ui/components/link/link';
import {SmartUserCardTooltip} from '@jetbrains/ring-ui/components/user-card/user-card';
import classNames from 'classnames';
import {i18n} from 'hub-dashboard-addons/dist/localization';
import EmptyWidget, {EmptyWidgetFaces} from '@jetbrains/hub-widget-ui/dist/empty-widget';
import ConfigurableWidget from '@jetbrains/hub-widget-ui/dist/configurable-widget';

import '@jetbrains/ring-ui/components/form/form.scss';
import '@jetbrains/ring-ui/components/input-size/input-size.scss';
import styles from './agile-board-widget.css';
import {
  countBoardProgress,
  getColumnSearchUrl,
  areSprintsEnabled,
  isCurrentSprint,
  MAX_PROGRESS_BAR_HEIGHT
} from './agile-board-model';
import {
  getYouTrackService,
  loadExtendedSprintData,
  loadAgile,
  getHubUser
} from './resources';
import BoardStatusEditForm from './board-status-edit-form';


export default class AgileBoardWidget extends Component {
  static propTypes = {
    dashboardApi: PropTypes.object,
    registerWidgetApi: PropTypes.func
  };

  static getDefaultWidgetTitle = () =>
    i18n('Agile Board Status');

  static getContentWidgetTitle =
    (agile, sprint, currentSprintMode, youTrack) => {
      if (agile) {
        let text = i18n('Board {{name}}', {name: agile.name});
        let href = `${youTrack.homeUrl}/agiles/${agile.id}`;
        if (areSprintsEnabled(agile)) {
          if (sprint) {
            text += currentSprintMode
              ? i18n(': Current sprint ({{name}})', {name: sprint.name})
              : `: ${sprint.name}`;
            href += `/${sprint.id}`;
          } else if (currentSprintMode) {
            text += `: ${i18n('No current sprint found')}`;
          }
        }
        return {text, href};
      }
      return AgileBoardWidget.getDefaultWidgetTitle();
    };

  constructor(props) {
    super(props);
    const {registerWidgetApi} = props;

    this.state = {
      isConfiguring: false,
      isLoading: true,
      noCurrentSprintError: false,
      isLoadDataError: false
    };

    registerWidgetApi({
      onConfigure: () => this.setState({
        isConfiguring: true,
        isLoadDataError: false
      }),
      onRefresh: async () => {
        await this.loadSelectedSprintData();
        this.updateTitle();
      }
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
      if (config && config.agileId) {
        await this.showBoardFromCache(config.agileId);
        await this.specifyBoard(
          config.agileId, config.sprintId, config.currentSprintMode
        );
      } else {
        this.setState({isConfiguring: true});
      }
    }
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

  async showBoardFromCache(agileId) {
    const {dashboardApi} = this.props;
    const cache = (await dashboardApi.readCache() || {}).result;
    if (cache && (cache.agile || {}).id === agileId) {
      this.setState({
        agile: cache.agile,
        sprint: cache.sprint,
        fromCache: true
      });
    }
  }

  async specifyBoard(agileId, sprintId, currentSprintMode) {
    let agile;
    try {
      agile = await loadAgile(this.fetchYouTrack, agileId);
    } catch (err) {
      this.setState({isLoadDataError: true});
      return;
    }
    const selectedSprintId = currentSprintMode
      ? (agile.currentSprint ||
        (agile.sprints || []).filter(isCurrentSprint)[0] || {}).id
      : sprintId;
    this.setState({
      agile,
      currentSprintMode
    }, async () => {
      if (selectedSprintId) {
        const sprint = await this.loadSelectedSprintData(selectedSprintId);
        this.updateTitle();
        if (sprint && agile) {
          this.props.dashboardApi.storeCache({sprint, agile});
        }
      } else if (currentSprintMode) {
        this.setState({noCurrentSprintError: true});
      }
    });
  }

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

  saveConfig = async formModel => {
    const {agile, sprint, youTrack, currentSprintMode} = formModel;
    const agileId = agile.id;
    const sprintId = sprint && sprint.id;
    await this.props.dashboardApi.storeConfig({
      agileId,
      sprintId,
      currentSprintMode,
      youTrack
    });
    this.setState({
      isConfiguring: false,
      noCurrentSprintError: false,
      youTrack
    }, async () => {
      await this.specifyBoard(agileId, sprintId, currentSprintMode);
    });
  };

  cancelConfig = async () => {
    this.setState({isConfiguring: false});
    await this.props.dashboardApi.exitConfigMode();
    this.initialize(this.props.dashboardApi);
  };

  updateTitle() {

  }

  renderConfiguration() {
    const {
      agile,
      sprint,
      currentSprintMode,
      youTrack
    } = this.state;

    return (
      <div className={styles.widget}>
        <BoardStatusEditForm
          agile={agile}
          sprint={sprint}
          currentSprintMode={currentSprintMode}
          onSubmit={this.saveConfig}
          onCancel={this.cancelConfig}
          dashboardApi={this.props.dashboardApi}
          youTrackId={youTrack.id}
        />
      </div>
    );
  }

  async loadSelectedSprintData(selectedSprintId) {
    const {agile} = this.state;
    try {
      const sprintId = selectedSprintId || (this.state.sprint || {}).id;
      const sprint = await loadExtendedSprintData(
        this.fetchYouTrack, agile.id, sprintId
      );
      this.setState({sprint, fromCache: false});
      return sprint;
    } catch (err) {
      this.setState({isLoadDataError: true});
      return null;
    }
  }

  renderLoader() {
    return <LoaderInline/>;
  }

  renderWidgetBody(agile, sprint) {
    if (!agile || !sprint) {
      return this.renderLoadDataError();
    }

    const boardData = sprint.board;
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
        agile, sprint, column
      );
      return `${homeUrl}/issues?q=${searchUrl}`;
    };

    const dashboardApi = this.props.dashboardApi;
    const fetchHub = dashboardApi.fetchHub.bind(dashboardApi);
    const userSource = () =>
      getHubUser(fetchHub, agile.owner.ringId, homeUrl);

    return (
      <div className={styles.widget}>
        {
          sprint.goal &&
          <div className={styles.sprintCommonInfo}>
            {sprint.goal}
          </div>
        }
        <div className={styles.sprintCommonInfo}>
          <b>{i18n('Owner:')}</b>&nbsp;
          <SmartUserCardTooltip userDataSource={userSource}>
            <Link
              href={`${homeUrl}/users/${agile.owner.ringId}`}
            >
              {agile.owner.fullName}
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
        <EmptyWidget
          face={EmptyWidgetFaces.ERROR}
          message={i18n('Can\'t load information from service.')}
        />
      </div>
    );
  }

  renderNoCurrentSprintError = () => {
    const editWidgetSettings = () => {
      this.props.dashboardApi.enterConfigMode();
      this.setState({isConfiguring: true});
    };

    return (
      <div className={styles.widget}>
        <EmptyWidget
          face={EmptyWidgetFaces.OK}
          message={i18n('No current sprint found')}
        >
          <Link
            pseudo={true}
            onClick={editWidgetSettings}
          >
            {i18n('Select sprint')}
          </Link>
        </EmptyWidget>
      </div>
    );
  };

  renderContent() {
    const {
      agile,
      sprint,
      isLoading,
      fromCache,
      isLoadDataError,
      noCurrentSprintError
    } = this.state;

    if (isLoadDataError) {
      return this.renderLoadDataError();
    }
    if (isLoading && !fromCache) {
      return this.renderLoader();
    }
    if (noCurrentSprintError) {
      return this.renderNoCurrentSprintError();
    }
    return this.renderWidgetBody(
      agile, sprint
    );
  }

  render() {
    const {
      agile,
      sprint,
      currentSprintMode,
      youTrack
    } = this.state;

    const widgetTitle = this.state.isConfiguring
      ? AgileBoardWidget.getDefaultWidgetTitle()
      : AgileBoardWidget.getContentWidgetTitle(
        agile, sprint, currentSprintMode, youTrack
      );
    const configuration = () => this.renderConfiguration();
    const content = () => this.renderContent();

    return (
      <ConfigurableWidget
        isConfiguring={this.state.isConfiguring}
        dashboardApi={this.props.dashboardApi}
        widgetTitle={widgetTitle}
        Configuration={configuration}
        Content={content}
      />
    );
  }
}
