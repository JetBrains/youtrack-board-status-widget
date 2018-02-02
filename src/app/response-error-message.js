export function getDefaultResponseErrorMessage() {
  return 'Something went wrong =(';
}

export function responseErrorMessage(responseError) {
  const responseErrorData = (responseError && responseError.data) || {};
  const message = responseErrorData.error_description ||
    responseErrorData.error_developer_message;
  return message || getDefaultResponseErrorMessage();
}
