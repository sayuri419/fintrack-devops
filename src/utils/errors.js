'use strict';

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new AppError(400, msg, details);
const unauthorized = (msg = 'Unauthorized') => new AppError(401, msg);
const notFound = (msg = 'Not found') => new AppError(404, msg);
const conflict = (msg) => new AppError(409, msg);

module.exports = { AppError, badRequest, unauthorized, notFound, conflict };
