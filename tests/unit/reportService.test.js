const store = require('../../src/repositories/memoryStore');
const { monthlySummary, savingsRate, budgetStatus } = require('../../src/services/reportService');

describe('reportService', () => {
  beforeEach(() => store.reset());

  test('savingsRate handles zero income', () => {
    expect(savingsRate(0, 5000)).toBe(0);
  });

  test('savingsRate rounds to one decimal place', () => {
    expect(savingsRate(300000, 200000)).toBe(33.3);
  });

  test.each([
    [5000, 'ok'],
    [8500, 'warning'],
    [10000, 'exceeded'],
    [12000, 'exceeded'],
  ])('budgetStatus with %i cents spent of $100 is %s', (spent, expected) => {
    expect(budgetStatus({ category: 'groceries', monthlyLimit: 100 }, spent).status).toBe(expected);
  });

  test('remaining never goes negative', () => {
    expect(budgetStatus({ category: 'rent', monthlyLimit: 50 }, 9000).remaining).toBe(0);
  });

  test('monthlySummary only includes the requested month and user', () => {
    const base = { category: 'groceries', description: '' };
    store.createTransaction({ ...base, userId: 'u1', type: 'income', category: 'salary', amountCents: 500000, date: '2026-09-01' });
    store.createTransaction({ ...base, userId: 'u1', type: 'expense', amountCents: 12050, date: '2026-09-10' });
    store.createTransaction({ ...base, userId: 'u1', type: 'expense', amountCents: 9999, date: '2026-08-30' });
    store.createTransaction({ ...base, userId: 'u2', type: 'expense', amountCents: 7777, date: '2026-09-10' });
    store.upsertBudget('u1', 'groceries', 100);

    const s = monthlySummary('u1', '2026-09');
    expect(s.income).toBe(5000);
    expect(s.expenses).toBe(120.5);
    expect(s.net).toBe(4879.5);
    expect(s.transactionCount).toBe(2);
    expect(s.spendingByCategory).toEqual({ groceries: 120.5 });
    expect(s.budgets[0].status).toBe('exceeded');
  });
});
