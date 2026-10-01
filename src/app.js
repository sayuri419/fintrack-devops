'use strict';

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const config = require('./config');
const logger = require('./logger');
const { metricsMiddleware, buildInfo } = require('./metrics');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');
const chaos = require('./routes/chaos');

function createApp() {
  const app = express();

  buildInfo.set({ version: config.version, commit: config.commit, env: config.appEnv }, 1);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => ['/health', '/ready', '/metrics'].includes(req.url) } }));
  app.use(metricsMiddleware);

  app.use('/', healthRoutes);
  app.use('/chaos', chaos.router);

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: config.rateLimitPerMinute, standardHeaders: 'draft-7', legacyHeaders: false }));
  api.use(chaos.chaosMiddleware);
  api.use('/auth', authRoutes);
  api.use('/transactions', transactionRoutes);
  api.use('/reports', reportRoutes);
  app.use('/api/v1', api);

  app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
