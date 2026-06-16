/**
 * Throw an app error
 * @param {String|{message: String, code: String, statusCode: Number, context: any, details: any}} errorMessage
 * @param {String} [errorCode]
 * @param {{context:any, details:any}} [options]
 */
function appError(errorMessage, errorCode = 'ERR', options = {}) {
  let message = errorMessage;
  let code = errorCode;
  let opts = options;
  let statusCode;

  if (message && typeof message === 'object') {
    ({ message, code, statusCode, ...opts } = errorMessage);
  }

  const error = new Error(message);
  error.isApplicationError = true;
  error.errorCode = code;

  if (statusCode) {
    error.statusCode = statusCode;
  }

  if (opts.context) {
    error.context = opts.context;
  }

  if (opts.details) {
    error.details = opts.details;
  }

  throw error;
}

module.exports = appError;
