'use strict';

const config = require('./config');
const logger = require('./logger');
const { createApp } = require('./app');

const server = createApp().listen(config.port, () => {
  logger.info({ port: config.port, env: config.appEnv, version: config.version }, 'FinTrack API started');
});

// Graceful shutdown so container restarts during deploy/rollback don't drop requests.
function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
