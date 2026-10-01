'use strict';

const logger = require('../logger');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    logger.error({ err, path: req.path }, 'unhandled error');
  }
  const body = { error: status >= 500 ? 'Internal server error' : err.message };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
};
