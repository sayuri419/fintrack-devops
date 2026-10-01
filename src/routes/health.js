'use strict';

const express = require('express');
const config = require('../config');
const { register } = require('../metrics');

const router = express.Router();
const startedAt = Date.now();

// Liveness: the process is up.
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: config.version,
    commit: config.commit,
    env: config.appEnv,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  });
});

// Readiness: used by Docker healthcheck and the deploy scripts.
router.get('/ready', (req, res) => {
  res.json({ ready: true });
});

// Prometheus scrape endpoint.
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = router;
