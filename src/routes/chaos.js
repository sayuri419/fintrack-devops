'use strict';

// Incident simulation for the Monitoring stage. Disabled unless CHAOS_ENABLED=true,
// and every call needs the X-Chaos-Token header. When "errors" mode is on, a share
// of API requests return HTTP 500 so the HighErrorRate alert can be proven end to end.
const express = require('express');
const config = require('../config');
const { unauthorized, badRequest } = require('../utils/errors');

const state = { errorRate: 0, latencyMs: 0 };
const router = express.Router();

function guard(req, res, next) {
  if (!config.chaosEnabled) return res.status(404).json({ error: 'Not found' });
  if (!config.chaosToken || req.get('x-chaos-token') !== config.chaosToken) {
    return next(unauthorized('Invalid chaos token'));
  }
  return next();
}

router.get('/', guard, (req, res) => res.json(state));

router.post('/', guard, (req, res, next) => {
  const errorRate = Number(req.body.errorRate ?? 0);
  const latencyMs = Number(req.body.latencyMs ?? 0);
  if (!(errorRate >= 0 && errorRate <= 1) || !(latencyMs >= 0 && latencyMs <= 5000)) {
    return next(badRequest('errorRate must be 0..1 and latencyMs 0..5000'));
  }
  state.errorRate = errorRate;
  state.latencyMs = latencyMs;
  return res.json(state);
});

function chaosMiddleware(req, res, next) {
  if (!config.chaosEnabled || (state.errorRate === 0 && state.latencyMs === 0)) return next();
  setTimeout(() => {
    if (Math.random() < state.errorRate) {
      return next(Object.assign(new Error('Simulated failure'), { status: 500 }));
    }
    return next();
  }, state.latencyMs);
}

function resetChaos() {
  state.errorRate = 0;
  state.latencyMs = 0;
}

module.exports = { router, chaosMiddleware, resetChaos, state };
