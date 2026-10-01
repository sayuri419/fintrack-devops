const store = require('../../src/repositories/memoryStore');
const service = require('../../src/services/transactionService');

describe('transactionService', () => {
  beforeEach(() => store.reset());

  const sample = { type: 'expense', amount: 19.99, category: 'transport', description: 'Myki top-up', date: '2026-09-15' };

  test('toCents avoids floating point drift', () => {
    expect(service.toCents(0.1 + 0.2)).toBe(30);
    expect(service.toCents(19.99)).toBe(1999);
  });

  test('create stores cents internally and returns dollars', () => {
    const tx = service.create('u1', sample);
    expect(tx.amount).toBe(19.99);
    expect(tx).not.toHaveProperty('amountCents');
    expect(tx).not.toHaveProperty('userId');
  });

  test('list filters by month, category and type and sorts newest first', () => {
    service.create('u1', sample);
    service.create('u1', { ...sample, date: '2026-09-20', category: 'groceries' });
    service.create('u1', { ...sample, date: '2026-10-01' });
    service.create('u1', { ...sample, type: 'income', category: 'salary', date: '2026-09-01' });

    const sept = service.list('u1', { month: '2026-09' });
    expect(sept).toHaveLength(3);
    expect(sept[0].date).toBe('2026-09-20');
    expect(service.list('u1', { category: 'transport' })).toHaveLength(2);
    expect(service.list('u1', { type: 'income' })).toHaveLength(1);
  });

  test('users cannot read or change each other\'s transactions', () => {
    const tx = service.create('u1', sample);
    expect(() => service.get('u2', tx.id)).toThrow('Transaction not found');
    expect(() => service.update('u2', tx.id, { amount: 1 })).toThrow('Transaction not found');
    expect(() => service.remove('u2', tx.id)).toThrow('Transaction not found');
  });

  test('update converts amount and date', () => {
    const tx = service.create('u1', sample);
    const updated = service.update('u1', tx.id, { amount: 25.5, date: '2026-09-16T10:00:00Z' });
    expect(updated.amount).toBe(25.5);
    expect(updated.date).toBe('2026-09-16');
  });

  test('remove deletes the record', () => {
    const tx = service.create('u1', sample);
    service.remove('u1', tx.id);
    expect(service.list('u1')).toHaveLength(0);
  });
});
