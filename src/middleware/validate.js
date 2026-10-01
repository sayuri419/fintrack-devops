'use strict';

const { badRequest } = require('../utils/errors');

// Validates req[source] against a Joi schema and replaces it with the cleaned value.
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(badRequest('Validation failed', error.details.map((d) => d.message)));
  }
  // Express 5 exposes req.query as a read-only getter, so redefine it explicitly.
  Object.defineProperty(req, source, { value, writable: true, configurable: true, enumerable: true });
  return next();
};
