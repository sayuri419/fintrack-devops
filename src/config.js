'use strict';

// Central configuration. Every value can be overridden per environment
// (.env.staging / .env.production) so the same image runs everywhere.
const env = process.env;

const config = {
  env: env.NODE_ENV || 'development',
  appEnv: env.APP_ENV || 'local',
  port: Number(env.PORT || 3000),
  logLevel: env.LOG_LEVEL || 'info',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '1h',
  rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE || 300),
  chaosEnabled: env.CHAOS_ENABLED === 'true',
  chaosToken: env.CHAOS_TOKEN || '',
  version: env.APP_VERSION || require('../package.json').version,
  commit: env.GIT_COMMIT || 'local',
};

if (config.env === 'production' && config.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
