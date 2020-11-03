import 'babel-polyfill';

import DashboardAddons from 'hub-dashboard-addons/dist/dashboard-api';
import ConfigWrapper from '@jetbrains/hub-widget-ui/dist/config-wrapper';
import React from 'react';
import {render} from 'react-dom';

import AgileBoardWidget from './agile-board-widget';
import {initTranslations} from './translations';

const CONFIG_FIELDS = ['agileId', 'sprintId', 'currentSprintMode', 'youTrack'];

DashboardAddons.registerWidget(async (dashboardApi, registerWidgetApi) => {
  initTranslations(DashboardAddons.locale);
  const configWrapper = new ConfigWrapper(dashboardApi, CONFIG_FIELDS);

  render(
    <AgileBoardWidget
      dashboardApi={dashboardApi}
      registerWidgetApi={registerWidgetApi}
      configWrapper={configWrapper}
      editable={DashboardAddons.editable}
    />,
    document.getElementById('app-container')
  );
});
