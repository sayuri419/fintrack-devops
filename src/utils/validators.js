'use strict';

const Joi = require('joi');

const CATEGORIES = ['salary', 'rent', 'groceries', 'transport', 'utilities', 'entertainment', 'health', 'savings', 'other'];

const schemas = {
  register: Joi.object({
    email: Joi.string().email().max(120).required(),
    password: Joi.string().min(8).max(72).pattern(/[A-Z]/).pattern(/[0-9]/).required()
      .messages({ 'string.pattern.base': 'password needs an uppercase letter and a digit' }),
    name: Joi.string().trim().min(1).max(60).required(),
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  transaction: Joi.object({
    type: Joi.string().valid('income', 'expense').required(),
    amount: Joi.number().positive().precision(2).max(1_000_000).required(),
    category: Joi.string().valid(...CATEGORIES).required(),
    description: Joi.string().trim().max(200).allow(''),
    date: Joi.date().iso().required(),
  }),
  transactionUpdate: Joi.object({
    type: Joi.string().valid('income', 'expense'),
    amount: Joi.number().positive().precision(2).max(1_000_000),
    category: Joi.string().valid(...CATEGORIES),
    description: Joi.string().trim().max(200).allow(''),
    date: Joi.date().iso(),
  }).min(1),
  budget: Joi.object({
    category: Joi.string().valid(...CATEGORIES).required(),
    monthlyLimit: Joi.number().positive().max(1_000_000).required(),
  }),
  month: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required()
    .messages({ 'string.pattern.base': 'month must be in YYYY-MM format' }),
};

module.exports = { schemas, CATEGORIES };
