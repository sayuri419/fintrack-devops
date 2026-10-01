'use strict';

const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.env === 'test' ? 'silent' : config.logLevel,
  base: { service: 'fintrack-api', env: config.appEnv, version: config.version },
  redact: ['req.headers.authorization', 'password'],
});

module.exports = logger;
