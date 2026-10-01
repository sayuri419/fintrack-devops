'use strict';

const store = require('../repositories/memoryStore');

// Monthly summary: totals, savings rate, per-category spend and budget status.
function monthlySummary(userId, month) {
  const txs = store.listTransactions(userId).filter((t) => t.date.startsWith(month));

  let incomeCents = 0;
  let expenseCents = 0;
  const byCategory = {};

  for (const t of txs) {
    if (t.type === 'income') {
      incomeCents += t.amountCents;
    } else {
      expenseCents += t.amountCents;
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amountCents;
    }
  }

  const budgets = store.listBudgets(userId).map((b) => budgetStatus(b, byCategory[b.category] || 0));

  return {
    month,
    income: incomeCents / 100,
    expenses: expenseCents / 100,
    net: (incomeCents - expenseCents) / 100,
    savingsRate: savingsRate(incomeCents, expenseCents),
    spendingByCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v / 100])),
    budgets,
    transactionCount: txs.length,
  };
}

function savingsRate(incomeCents, expenseCents) {
  if (incomeCents === 0) return 0;
  return Math.round(((incomeCents - expenseCents) / incomeCents) * 1000) / 10;
}

function budgetStatus(budget, spentCents) {
  const limitCents = Math.round(budget.monthlyLimit * 100);
  const usedPct = Math.round((spentCents / limitCents) * 1000) / 10;
  let status = 'ok';
  if (usedPct >= 100) status = 'exceeded';
  else if (usedPct >= 80) status = 'warning';
  return {
    category: budget.category,
    limit: budget.monthlyLimit,
    spent: spentCents / 100,
    remaining: Math.max(0, limitCents - spentCents) / 100,
    usedPct,
    status,
  };
}

module.exports = { monthlySummary, savingsRate, budgetStatus };
