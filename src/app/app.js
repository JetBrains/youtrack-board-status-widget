import 'babel-polyfill';

import DashboardAddons from 'hub-dashboard-addons/dist/dashboard-api';
import {setLocale} from 'hub-dashboard-addons/dist/localization';
import React from 'react';
import {render} from 'react-dom';

import AgileBoardWidget from './agile-board-widget';
import TRANSLATIONS from './translations';

DashboardAddons.registerWidget(async (dashboardApi, registerWidgetApi) => {
  setLocale(DashboardAddons.locale, TRANSLATIONS);

  render(
    <AgileBoardWidget
      dashboardApi={dashboardApi}
      registerWidgetApi={registerWidgetApi}
    />,
    document.getElementById('app-container')
  );
});
