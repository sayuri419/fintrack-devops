'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized } = require('../utils/errors');

module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Missing bearer token'));
  }
  try {
    // Pin the algorithm so a token signed with 'none' or RS/HS confusion is rejected (GHSA-qwph-4952-7xr6).
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }
};
