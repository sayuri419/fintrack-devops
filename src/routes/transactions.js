'use strict';

const express = require('express');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { schemas } = require('../utils/validators');
const service = require('../services/transactionService');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { month, category, type } = req.query;
  res.json({ items: service.list(req.user.id, { month, category, type }) });
});

router.post('/', validate(schemas.transaction), (req, res) => {
  res.status(201).json(service.create(req.user.id, req.body));
});

router.get('/:id', (req, res) => {
  res.json(service.get(req.user.id, req.params.id));
});

router.patch('/:id', validate(schemas.transactionUpdate), (req, res) => {
  res.json(service.update(req.user.id, req.params.id, req.body));
});

router.delete('/:id', (req, res) => {
  service.remove(req.user.id, req.params.id);
  res.status(204).end();
});

module.exports = router;
