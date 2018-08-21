import 'babel-polyfill';
import 'file-loader?name=[name].[ext]!../../manifest.json'; // eslint-disable-line import/no-unresolved

import DashboardAddons from 'hub-dashboard-addons';
import React from 'react';
import {render} from 'react-dom';

import AgileBoardWidget from './agile-board-widget';
import {setLocale} from './i18n-translate';
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
