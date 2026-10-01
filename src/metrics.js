'use strict';

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'fintrack_' });

const httpRequests = new client.Counter({
  name: 'fintrack_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: 'fintrack_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [register],
});

const transactionsCreated = new client.Counter({
  name: 'fintrack_transactions_created_total',
  help: 'Business metric: transactions recorded',
  labelNames: ['type'],
  registers: [register],
});

const buildInfo = new client.Gauge({
  name: 'fintrack_build_info',
  help: 'Build metadata (value is always 1)',
  labelNames: ['version', 'commit', 'env'],
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    // Use the matched route pattern, not the raw URL, to keep label cardinality low.
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
}

module.exports = { register, metricsMiddleware, transactionsCreated, buildInfo };
