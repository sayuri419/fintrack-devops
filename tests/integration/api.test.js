const request = require('supertest');
const { createApp } = require('../../src/app');
const store = require('../../src/repositories/memoryStore');
const { resetChaos } = require('../../src/routes/chaos');

const app = createApp();

async function registerAndLogin(email = 'user@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'Secur3Pass', name: 'Test User' })
    .expect(201);
  return res.body.token;
}

describe('FinTrack API (integration)', () => {
  beforeEach(() => {
    store.reset();
    resetChaos();
  });

  describe('platform endpoints', () => {
    test('GET /health reports version and status', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBeDefined();
    });

    test('GET /ready', async () => {
      await request(app).get('/ready').expect(200, { ready: true });
    });

    test('GET /metrics exposes Prometheus metrics', async () => {
      await request(app).get('/health');
      const res = await request(app).get('/metrics').expect(200);
      expect(res.text).toContain('fintrack_http_requests_total');
      expect(res.text).toContain('fintrack_build_info');
    });

    test('security headers are set and x-powered-by is hidden', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('unknown routes return 404 JSON', async () => {
      await request(app).get('/nope').expect(404, { error: 'Route not found' });
    });
  });

  describe('auth', () => {
    test('register then login', async () => {
      await registerAndLogin();
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'Secur3Pass' })
        .expect(200);
      expect(res.body.token).toBeTruthy();
    });

    test('validation errors return 400 with details', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'bad' }).expect(400);
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    test('duplicate registration returns 409', async () => {
      await registerAndLogin();
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'user@example.com', password: 'Secur3Pass', name: 'Again' })
        .expect(409);
    });

    test('protected routes require a valid token', async () => {
      await request(app).get('/api/v1/transactions').expect(401);
      await request(app).get('/api/v1/transactions').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });
  });

  describe('transactions CRUD', () => {
    test('full lifecycle: create, list, get, update, delete', async () => {
      const token = await registerAndLogin();
      const auth = { Authorization: `Bearer ${token}` };

      const created = await request(app)
        .post('/api/v1/transactions')
        .set(auth)
        .send({ type: 'expense', amount: 42.1, category: 'groceries', description: 'Coles', date: '2026-09-12' })
        .expect(201);
      const id = created.body.id;

      const list = await request(app).get('/api/v1/transactions?month=2026-09').set(auth).expect(200);
      expect(list.body.items).toHaveLength(1);

      await request(app).get(`/api/v1/transactions/${id}`).set(auth).expect(200);

      const patched = await request(app).patch(`/api/v1/transactions/${id}`).set(auth).send({ amount: 50 }).expect(200);
      expect(patched.body.amount).toBe(50);

      await request(app).delete(`/api/v1/transactions/${id}`).set(auth).expect(204);
      await request(app).get(`/api/v1/transactions/${id}`).set(auth).expect(404);
    });

    test('another user cannot access my transaction', async () => {
      const mine = await registerAndLogin('me@example.com');
      const theirs = await registerAndLogin('them@example.com');
      const tx = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${mine}`)
        .send({ type: 'income', amount: 1000, category: 'salary', date: '2026-09-01' })
        .expect(201);
      await request(app).get(`/api/v1/transactions/${tx.body.id}`).set('Authorization', `Bearer ${theirs}`).expect(404);
    });
  });

  describe('reports and budgets', () => {
    test('monthly summary reflects budgets and spending', async () => {
      const token = await registerAndLogin();
      const auth = { Authorization: `Bearer ${token}` };

      await request(app).put('/api/v1/reports/budgets').set(auth).send({ category: 'groceries', monthlyLimit: 100 }).expect(200);
      await request(app).post('/api/v1/transactions').set(auth)
        .send({ type: 'income', amount: 4000, category: 'salary', date: '2026-09-01' }).expect(201);
      await request(app).post('/api/v1/transactions').set(auth)
        .send({ type: 'expense', amount: 85, category: 'groceries', date: '2026-09-05' }).expect(201);

      const budgets = await request(app).get('/api/v1/reports/budgets').set(auth).expect(200);
      expect(budgets.body.items).toHaveLength(1);

      const res = await request(app).get('/api/v1/reports/summary?month=2026-09').set(auth).expect(200);
      expect(res.body.net).toBe(3915);
      expect(res.body.budgets[0]).toMatchObject({ category: 'groceries', status: 'warning', usedPct: 85 });
    });

    test('summary rejects a bad month', async () => {
      const token = await registerAndLogin();
      await request(app).get('/api/v1/reports/summary?month=Sept').set('Authorization', `Bearer ${token}`).expect(400);
    });
  });

  describe('chaos (incident simulation)', () => {
    test('requires the chaos token', async () => {
      await request(app).post('/chaos').send({ errorRate: 1 }).expect(401);
    });

    test('rejects invalid settings', async () => {
      await request(app).post('/chaos').set('X-Chaos-Token', 'test-chaos-token').send({ errorRate: 5 }).expect(400);
    });

    test('errorRate=1 makes API calls fail with 500, reset restores service', async () => {
      await request(app).post('/chaos').set('X-Chaos-Token', 'test-chaos-token').send({ errorRate: 1 }).expect(200);
      const state = await request(app).get('/chaos').set('X-Chaos-Token', 'test-chaos-token').expect(200);
      expect(state.body.errorRate).toBe(1);
      await request(app).post('/api/v1/auth/login').send({ email: 'x@y.com', password: 'p' }).expect(500);

      await request(app).post('/chaos').set('X-Chaos-Token', 'test-chaos-token').send({ errorRate: 0 }).expect(200);
      await request(app).post('/api/v1/auth/login').send({ email: 'x@y.com', password: 'p' }).expect(401);
    });

    test('health stays up during chaos so only the API is affected', async () => {
      await request(app).post('/chaos').set('X-Chaos-Token', 'test-chaos-token').send({ errorRate: 1 }).expect(200);
      await request(app).get('/health').expect(200);
    });
  });
});
