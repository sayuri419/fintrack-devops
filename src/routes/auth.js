'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { schemas } = require('../utils/validators');
const authService = require('../services/authService');

const router = express.Router();

router.post('/register', validate(schemas.register), async (req, res, next) => {
  try {
    res.status(201).json(await authService.register(req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    res.json(await authService.login(req.body));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
