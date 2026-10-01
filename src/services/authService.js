'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const store = require('../repositories/memoryStore');
const { conflict, unauthorized } = require('../utils/errors');

const SALT_ROUNDS = config.env === 'test' ? 4 : 10;

function publicUser(user) {
  const { passwordHash, ...rest } = user; // eslint-disable-line no-unused-vars
  return rest;
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function register({ email, password, name }) {
  const normalised = email.toLowerCase();
  if (store.findUserByEmail(normalised)) {
    throw conflict('Email already registered');
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = store.createUser({ email: normalised, name, passwordHash });
  return { user: publicUser(user), token: issueToken(user) };
}

async function login({ email, password }) {
  const user = store.findUserByEmail(email);
  // Same message for unknown user and wrong password to avoid account enumeration.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Invalid email or password');
  }
  return { user: publicUser(user), token: issueToken(user) };
}

module.exports = { register, login, issueToken, publicUser };
