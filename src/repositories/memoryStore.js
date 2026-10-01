'use strict';

const crypto = require('crypto');

// Simple repository layer. Kept behind an interface so it can be swapped
// for PostgreSQL without touching the services.
class MemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = new Map();
    this.transactions = new Map();
    this.budgets = new Map();
  }

  newId() {
    return crypto.randomUUID();
  }

  // users
  createUser(user) {
    const record = { id: this.newId(), createdAt: new Date().toISOString(), ...user };
    this.users.set(record.id, record);
    return record;
  }

  findUserByEmail(email) {
    const target = email.toLowerCase();
    return [...this.users.values()].find((u) => u.email === target) || null;
  }

  // transactions
  createTransaction(tx) {
    const record = { id: this.newId(), createdAt: new Date().toISOString(), ...tx };
    this.transactions.set(record.id, record);
    return record;
  }

  listTransactions(userId) {
    return [...this.transactions.values()].filter((t) => t.userId === userId);
  }

  getTransaction(id) {
    return this.transactions.get(id) || null;
  }

  updateTransaction(id, changes) {
    const updated = { ...this.transactions.get(id), ...changes, updatedAt: new Date().toISOString() };
    this.transactions.set(id, updated);
    return updated;
  }

  deleteTransaction(id) {
    return this.transactions.delete(id);
  }

  // budgets (one per user + category)
  upsertBudget(userId, category, monthlyLimit) {
    const key = `${userId}:${category}`;
    const record = { userId, category, monthlyLimit };
    this.budgets.set(key, record);
    return record;
  }

  listBudgets(userId) {
    return [...this.budgets.values()].filter((b) => b.userId === userId);
  }
}

module.exports = new MemoryStore();
module.exports.MemoryStore = MemoryStore;
