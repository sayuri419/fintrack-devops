'use strict';

const store = require('../repositories/memoryStore');
const { notFound } = require('../utils/errors');
const { transactionsCreated } = require('../metrics');

function toCents(amount) {
  return Math.round(amount * 100);
}

function create(userId, data) {
  const tx = store.createTransaction({
    userId,
    type: data.type,
    amountCents: toCents(data.amount),
    category: data.category,
    description: data.description || '',
    date: new Date(data.date).toISOString().slice(0, 10),
  });
  transactionsCreated.inc({ type: tx.type });
  return present(tx);
}

function list(userId, { month, category, type } = {}) {
  return store
    .listTransactions(userId)
    .filter((t) => !month || t.date.startsWith(month))
    .filter((t) => !category || t.category === category)
    .filter((t) => !type || t.type === type)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(present);
}

function getOwned(userId, id) {
  const tx = store.getTransaction(id);
  // A transaction owned by someone else is reported as not found (no data leakage).
  if (!tx || tx.userId !== userId) throw notFound('Transaction not found');
  return tx;
}

function get(userId, id) {
  return present(getOwned(userId, id));
}

function update(userId, id, changes) {
  getOwned(userId, id);
  const patch = { ...changes };
  if (patch.amount !== undefined) {
    patch.amountCents = toCents(patch.amount);
    delete patch.amount;
  }
  if (patch.date !== undefined) {
    patch.date = new Date(patch.date).toISOString().slice(0, 10);
  }
  return present(store.updateTransaction(id, patch));
}

function remove(userId, id) {
  getOwned(userId, id);
  store.deleteTransaction(id);
}

function present(tx) {
  const { amountCents, userId, ...rest } = tx; // eslint-disable-line no-unused-vars
  return { ...rest, amount: amountCents / 100 };
}

module.exports = { create, list, get, update, remove, toCents };
