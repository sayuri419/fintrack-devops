const { schemas } = require('../../src/utils/validators');

describe('validators', () => {
  test('rejects weak passwords', () => {
    const { error } = schemas.register.validate({ email: 'a@b.com', password: 'password', name: 'A' });
    expect(error).toBeDefined();
  });

  test('accepts a valid transaction', () => {
    const { error } = schemas.transaction.validate({ type: 'expense', amount: 12.5, category: 'groceries', date: '2026-09-01' });
    expect(error).toBeUndefined();
  });

  test.each([
    [{ type: 'expense', amount: -5, category: 'groceries', date: '2026-09-01' }],
    [{ type: 'gift', amount: 5, category: 'groceries', date: '2026-09-01' }],
    [{ type: 'expense', amount: 5, category: 'crypto', date: '2026-09-01' }],
    [{ type: 'expense', amount: 5, category: 'groceries', date: 'yesterday' }],
  ])('rejects invalid transaction %#', (tx) => {
    expect(schemas.transaction.validate(tx).error).toBeDefined();
  });

  test('month must be YYYY-MM', () => {
    expect(schemas.month.validate('2026-13').error).toBeDefined();
    expect(schemas.month.validate('2026-09').error).toBeUndefined();
  });

  test('empty update is rejected', () => {
    expect(schemas.transactionUpdate.validate({}).error).toBeDefined();
  });
});
