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
import ServiceResources from '@jetbrains/hub-widget-ui/dist/service-resources';

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
  loadExtendedSprintData,
  loadAgile,
  getHubUser
} from './resources';
import Configuration from './configuration';


export default class AgileBoardWidget extends Component {

  static getDefaultWidgetTitle = () =>
    i18n('Agile Board Status');

  static getContentWidgetTitle =
    (agile, sprint, currentSprintMode, youTrack) => {
      if (agile) {
        let text = i18n('Board {{name}}', {name: agile.name});
        const homeUrl =
          youTrack.homeUrl.charAt(youTrack.homeUrl.length - 1) === '/'
            ? youTrack.homeUrl
            : `${youTrack.homeUrl}/`;
        let href = `${homeUrl}agiles/${agile.id}`;
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

  static propTypes = {
    dashboardApi: PropTypes.object,
    registerWidgetApi: PropTypes.func,
    configWrapper: PropTypes.object,
    editable: PropTypes.bool
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
        const {configWrapper} = this.props;
        const agileId = configWrapper.getFieldValue('agileId');
        const sprintId = configWrapper.getFieldValue('sprintId');
        const currentSprintMode =
          configWrapper.getFieldValue('currentSprintMode');
        if (agileId) {
          await this.specifyAgile(agileId, sprintId, currentSprintMode);
        }
      }
    });
  }

  componentDidMount() {
    this.initialize(this.props.configWrapper);
  }

  async initialize(configWrapper) {
    this.setState({isLoading: true});

    await configWrapper.init();

    const youTrackService = await this.getYouTrack(
      configWrapper.getFieldValue('youTrack')
    );
    if (youTrackService && youTrackService.id) {
      this.setYouTrack(youTrackService);
      const agileId = configWrapper.getFieldValue('agileId');
      if (agileId) {
        await this.specifyAgile(
          agileId,
          configWrapper.getFieldValue('sprintId'),
          configWrapper.getFieldValue('currentSprintMode')
        );
      } else {
        this.setState({isConfiguring: true});
      }
    }
    this.setState({isLoading: false});
  }

  async getYouTrack(predefinedYouTrack) {
    const {dashboardApi} = this.props;
    const predefinedYouTrackId = predefinedYouTrack && predefinedYouTrack.id;
    return await ServiceResources.getYouTrackService(
      dashboardApi, predefinedYouTrackId
    );
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

  async specifyAgile(agileId, sprintId, currentSprintMode) {
    await this.showBoardFromCache(agileId);
    await this.specifyBoard(agileId, sprintId, currentSprintMode);
  }

  async specifyBoard(agileId, sprintId, currentSprintMode) {
    let agile;
    try {
      agile = await loadAgile(this.fetchYouTrack, agileId);
    } catch (err) {
      this.setState({isLoadDataError: true, isLoading: false});
      return;
    }
    const selectedSprintId = currentSprintMode
      ? (agile.currentSprint ||
        (agile.sprints || []).filter(isCurrentSprint)[0] || {}).id
      : sprintId;
    this.setState({
      agile,
      currentSprintMode,
      isLoadDataError: false
    }, async () => {
      if (selectedSprintId) {
        const sprint = await this.loadSelectedSprintData(selectedSprintId);
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

  saveConfig = async formModel => {
    const {agile, sprint, youTrack, currentSprintMode} = formModel;
    const agileId = agile.id;
    const sprintId = sprint && sprint.id;
    await this.props.configWrapper.replace({
      agileId, sprintId, currentSprintMode, youTrack
    });
    this.setState({
      isConfiguring: false,
      noCurrentSprintError: false,
      youTrack
    }, async () => {
      await this.specifyBoard(agileId, sprintId, currentSprintMode);
    });
  };

  loadAgileOwner = async () => {
    const {agile, youTrack} = this.state;

    if (agile && agile.owner && youTrack) {
      const dashboardApi = this.props.dashboardApi;
      const fetchHub = dashboardApi.fetchHub.bind(dashboardApi);
      return await getHubUser(fetchHub, agile.owner.ringId, youTrack.homeUrl);
    }

    return {};
  };

  cancelConfig = async () => {
    this.setState({isConfiguring: false});
    if (this.props.configWrapper.isNewConfig()) {
      await this.props.dashboardApi.removeWidget();
    } else {
      await this.props.dashboardApi.exitConfigMode();
      this.initialize(this.props.configWrapper);
    }
  };

  renderConfiguration = () => {
    const {
      agile,
      sprint,
      currentSprintMode,
      youTrack
    } = this.state;

    return (
      <div className={styles.widget}>
        <Configuration
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
    this.setState({isLoading: true});

    const {agile} = this.state;
    try {
      const sprintId = selectedSprintId || (this.state.sprint || {}).id;
      const sprint = await loadExtendedSprintData(
        this.fetchYouTrack, agile.id, sprintId
      );
      this.setState({
        sprint,
        fromCache: false,
        isLoadDataError: false,
        isLoading: false
      });
      return sprint;
    } catch (err) {
      this.setState({isLoadDataError: true, isLoading: false});
      return null;
    }
  }

  editWidgetSettings() {
    this.props.dashboardApi.enterConfigMode();
    this.setState({isConfiguring: true});
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
      return `${homeUrl}issues?q=${searchUrl}`;
    };

    return (
      <div className={styles.widget}>
        {
          sprint.goal &&
        (
          <div className={styles.sprintCommonInfo}>
            {sprint.goal}
          </div>
        )
        }
        <div className={styles.sprintCommonInfo}>
          <b>{i18n('Owner:')}</b>&nbsp;
          <SmartUserCardTooltip userDataSource={this.loadAgileOwner}>
            <Link
              href={`${homeUrl}users/${agile.owner.ringId}`}
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

  renderNoCurrentSprintError = () => (
    <div className={styles.widget}>
      <EmptyWidget
        face={EmptyWidgetFaces.OK}
        message={i18n('No current sprint found')}
      >
        {
          this.props.editable &&
        (
          <Link
            pseudo
            onClick={this.editWidgetSettings}
          >
            {i18n('Select sprint')}
          </Link>
        )
        }
      </EmptyWidget>
    </div>
  );

  renderContent = () => {
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
  };

  render() {
    const {
      agile,
      sprint,
      currentSprintMode,
      isLoading,
      youTrack
    } = this.state;

    const widgetTitle = this.state.isConfiguring
      ? AgileBoardWidget.getDefaultWidgetTitle()
      : AgileBoardWidget.getContentWidgetTitle(
        agile, sprint, currentSprintMode, youTrack
      );

    return (
      <ConfigurableWidget
        isConfiguring={this.state.isConfiguring}
        dashboardApi={this.props.dashboardApi}
        widgetTitle={widgetTitle}
        widgetLoader={isLoading}
        Configuration={this.renderConfiguration}
        Content={this.renderContent}
      />
    );
  }
}
