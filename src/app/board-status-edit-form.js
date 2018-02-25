import '@jetbrains/ring-ui/components/form/form.scss';

import React from 'react';
import PropTypes from 'prop-types';
import Panel from '@jetbrains/ring-ui/components/panel/panel';
import Button from '@jetbrains/ring-ui/components/button/button';
import Select from '@jetbrains/ring-ui/components/select/select';
import List from '@jetbrains/ring-ui/components/list/list';
import classNames from 'classnames';

import {
  getYouTrackServices,
  loadAgiles
} from './resources';
import {
  areSprintsEnabled,
  isCurrentSprint
} from './agile-board-model';
import {responseErrorMessage} from './response-error-message';
import styles from './agile-board-widget.css';

export default class BoardStatusEditForm extends React.Component {
  static propTypes = {
    agile: PropTypes.object,
    sprint: PropTypes.object,
    currentSprintMode: PropTypes.bool,
    onSubmit: PropTypes.func,
    onCancel: PropTypes.func,
    dashboardApi: PropTypes.object,
    youTrackId: PropTypes.string
  };

  static toSelectItem = it => it && {
    key: it.id,
    label: it.name,
    description: it.homeUrl,
    model: it
  };

  static getCurrentSprintSelectOption = currentSprint => ({
    key: 'current-sprint',
    label: 'Always display current sprint',
    description: currentSprint ? currentSprint.name : ''
  });

  constructor(props) {
    super(props);

    const selectedYouTrack = {
      id: props.youTrackId
    };
    this.state = {
      selectedAgile: props.agile,
      selectedSprint: props.sprint,
      currentSprintMode: props.currentSprintMode,
      agiles: [],
      selectedYouTrack,
      youTracks: [selectedYouTrack]
    };
  }

  componentDidMount() {
    this.loadYouTrackList();
  }

  setFormLoaderEnabled(isLoading) {
    this.setState({isLoading});
    if (isLoading) {
      this.setState({noConnection: false});
      const showLoaderDuration = 2000;
      setTimeout(() => {
        if (this.state.isLoading) {
          this.setState({
            isLoading: false,
            errorMessage: 'Failed to connect to server',
            noConnection: true
          });
        }
      }, showLoaderDuration);
    }
  }

  async loadYouTrackList() {
    const {selectedYouTrack} = this.state;
    const youTracks = await getYouTrackServices(
      this.props.dashboardApi.fetchHub
    );
    const selectedYouTrackWithAllFields = youTracks.
      filter(yt => yt.id === selectedYouTrack.id)[0];
    this.setState({
      youTracks, selectedYouTrack: selectedYouTrackWithAllFields
    }, async () => await this.onAfterYouTrackChanged());
  }

  async onAfterYouTrackChanged() {
    this.setFormLoaderEnabled(true);
    try {
      await this.loadAgiles();
    } catch (err) {
      this.setState({
        isLoading: false,
        errorMessage: responseErrorMessage(err)
      });
      return;
    }
    this.setFormLoaderEnabled(false);
  }

  async loadAgiles() {
    const {selectedAgile, selectedSprint} = this.state;
    this.setState({agiles: [], selectedAgile: null, selectedSprint: null});
    const agiles = await loadAgiles(this.fetchYouTrack);
    const hasRememberedAgileInNewAgilesList = (agiles || []).
      some(agile => selectedAgile && selectedAgile.id === agile.id);
    this.setState({agiles});
    if (hasRememberedAgileInNewAgilesList) {
      this.setState({
        selectedAgile,
        selectedSprint
      });
    } else if (agiles.length) {
      this.changeAgile(agiles[0]);
    }
  }

  changeYouTrack = selected => {
    this.setState({
      selectedYouTrack: selected.model,
      errorMessage: ''
    }, () => this.onAfterYouTrackChanged());
  };

  submitForm = async () => {
    const {
      selectedAgile, selectedSprint, selectedYouTrack, currentSprintMode
    } = this.state;
    await this.props.onSubmit({
      agile: selectedAgile,
      sprint: selectedSprint,
      youTrack: selectedYouTrack,
      currentSprintMode
    });
  };

  fetchYouTrack = async (url, params) => {
    const {dashboardApi} = this.props;
    const {selectedYouTrack} = this.state;
    return await dashboardApi.fetch(selectedYouTrack.id, url, params);
  };

  changeAgile = selected => {
    const selectedAgile = selected.model || selected;
    const sprints = selectedAgile && selectedAgile.sprints || [];
    if (sprints.length) {
      const hasCurrentSprint = sprints.some(isCurrentSprint);
      this.changeSprint(
        hasCurrentSprint
          ? BoardStatusEditForm.getCurrentSprintSelectOption()
          : sprints[0]
      );
    }
    this.setState({selectedAgile});
  };

  changeSprint = selected => {
    if (selected.key === 'current-sprint') {
      this.setState({
        selectedSprint: null,
        currentSprintMode: true
      });
    } else {
      this.setState({
        selectedSprint: selected.model || selected,
        currentSprintMode: false
      });
    }
  };

  renderNoBoardsMessage() {
    return (
      <div className="ring-form__group">
        {'No sprints found'}
      </div>
    );
  }

  renderBoardsSelectors() {
    const {
      selectedAgile,
      selectedSprint,
      currentSprintMode,
      agiles
    } = this.state;

    const getSprintsOptions = () => {
      const sprints = (selectedAgile.sprints || []);
      const sprintsOptions = sprints.map(BoardStatusEditForm.toSelectItem);
      const currentSprint = sprints.filter(isCurrentSprint)[0];
      if (currentSprint) {
        sprintsOptions.unshift({
          rgItemType: List.ListProps.Type.SEPARATOR
        });
        sprintsOptions.unshift(
          BoardStatusEditForm.getCurrentSprintSelectOption(currentSprint)
        );
      }
      return sprintsOptions;
    };

    return (
      <div>
        <div className="ring-form__group">
          <Select
            data={agiles.map(BoardStatusEditForm.toSelectItem)}
            selected={BoardStatusEditForm.toSelectItem(selectedAgile)}
            onSelect={this.changeAgile}
            filter={true}
            label="Select board"
          />
        </div>
        {
          areSprintsEnabled(selectedAgile) &&
          <div className="ring-form__group">
            <Select
              data={getSprintsOptions()}
              selected={
                currentSprintMode
                  ? BoardStatusEditForm.getCurrentSprintSelectOption()
                  : BoardStatusEditForm.toSelectItem(selectedSprint)
              }
              onSelect={this.changeSprint}
              filter={true}
              label="Select sprint"
            />
          </div>
        }
      </div>
    );
  }

  render() {
    const {
      selectedAgile,
      agiles,
      youTracks,
      selectedYouTrack
    } = this.state;

    return (
      <div>
        <div className={classNames('ring-form', styles.widgetEditForm)}>
          {
            (youTracks || []).length > 1 &&
            <div className="ring-form__group">
              <Select
                data={youTracks.map(BoardStatusEditForm.toSelectItem)}
                selected={BoardStatusEditForm.toSelectItem(selectedYouTrack)}
                onSelect={this.changeYouTrack}
                filter={true}
                label="Select YouTrack Server"
              />
            </div>
          }
          {
            ((agiles || []).length > 0)
              ? this.renderBoardsSelectors()
              : this.renderNoBoardsMessage()
          }
        </div>
        <Panel className={styles.formPanel}>
          {
            this.state.errorMessage &&
            <div className={styles.formPanelError}>
              {this.state.errorMessage}
            </div>
          }
          <Button
            blue={true}
            loader={this.state.isLoading}
            disabled={this.state.errorMessage || !selectedAgile}
            onClick={this.submitForm}
          >
            {'Save'}
          </Button>
          <Button
            loader={this.state.isLoading}
            onClick={this.props.onCancel}
          >
            {'Cancel'}
          </Button>
        </Panel>
      </div>
    );
  }
}
