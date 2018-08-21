import {i18n} from './i18n-translate';

export function getDefaultResponseErrorMessage() {
  return i18n('Something went wrong =(');
}

export function responseErrorMessage(responseError) {
  const responseErrorData = (responseError && responseError.data) || {};
  const message = responseErrorData.error_description ||
    responseErrorData.error_developer_message;
  return message || getDefaultResponseErrorMessage();
}
