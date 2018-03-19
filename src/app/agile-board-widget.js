import React, {Component} from 'react';
import PropTypes from 'prop-types';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import Tooltip from '@jetbrains/ring-ui/components/tooltip/tooltip';
import Link from '@jetbrains/ring-ui/components/link/link';
import {SmartUserCardTooltip} from '@jetbrains/ring-ui/components/user-card/user-card';
import classNames from 'classnames';

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
import WidgetErrorScreen from './widget-error-screen';
import BoardStatusEditForm from './board-status-edit-form';


export default class AgileBoardWidget extends Component {
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
      noCurrentSprintError: false,
      isLoadDataError: false
    };

    registerWidgetApi({
      onConfigure: () => this.setState({isConfiguring: true}),
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

  async specifyBoard(agileId, sprintId, currentSprintMode) {
    const agile = await loadAgile(this.fetchYouTrack, agileId);
    const selectedSprintId = currentSprintMode
      ? ((agile.sprints || []).filter(isCurrentSprint)[0] || {}).id
      : sprintId;
    this.setState({
      agile,
      currentSprintMode
    }, async () => {
      if (selectedSprintId) {
        await this.loadSelectedSprintData(selectedSprintId);
        this.updateTitle();
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
    const {
      agile, sprint, currentSprintMode, youTrack
    } = this.state;
    if (agile) {
      let title = `Board ${agile.name}`;
      let link = `${youTrack.homeUrl}/agiles/${agile.id}`;
      if (areSprintsEnabled(agile)) {
        if (sprint) {
          title += currentSprintMode
            ? `: Current sprint (${sprint.name})`
            : `: ${sprint.name}`;
          link += `/${sprint.id}`;
        } else if (currentSprintMode) {
          title += ': No current sprint found';
        }
      }
      this.props.dashboardApi.setTitle(title, link);
    }
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
      this.setState({sprint});
    } catch (err) {
      this.setState({isLoadDataError: true});
    }
  }

  renderLoader() {
    return <LoaderInline/>;
  }

  renderWidgetBody(agile, sprint) {
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
          <b>{'Owner:'}</b>&nbsp;
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
        <WidgetErrorScreen/>
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
        <WidgetErrorScreen
          smile={'(・_・)'}
          text={'No current sprint found'}
        >
          <Link
            pseudo={true}
            onClick={editWidgetSettings}
          >
            {'Select sprint'}
          </Link>
        </WidgetErrorScreen>
      </div>
    );
  };

  render() {
    const {
      isConfiguring,
      agile,
      sprint,
      isLoading,
      isLoadDataError,
      noCurrentSprintError
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
    if (noCurrentSprintError) {
      return this.renderNoCurrentSprintError();
    }
    if (!agile || !sprint) {
      return this.renderLoader();
    }
    return this.renderWidgetBody(
      agile, sprint
    );
  }
}
