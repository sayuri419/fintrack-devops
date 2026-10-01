'use strict';

const express = require('express');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { schemas } = require('../utils/validators');
const store = require('../repositories/memoryStore');
const reportService = require('../services/reportService');
const Joi = require('joi');

const router = express.Router();
router.use(requireAuth);

router.put('/budgets', validate(schemas.budget), (req, res) => {
  res.json(store.upsertBudget(req.user.id, req.body.category, req.body.monthlyLimit));
});

router.get('/budgets', (req, res) => {
  res.json({ items: store.listBudgets(req.user.id) });
});

router.get('/summary', validate(Joi.object({ month: schemas.month }), 'query'), (req, res) => {
  res.json(reportService.monthlySummary(req.user.id, req.query.month));
});

module.exports = router;
