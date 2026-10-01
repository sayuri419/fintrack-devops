const jwt = require('jsonwebtoken');
const store = require('../../src/repositories/memoryStore');
const authService = require('../../src/services/authService');

describe('authService', () => {
  beforeEach(() => store.reset());
  const creds = { email: 'Sayuri@Example.com', password: 'Passw0rdX', name: 'Sayuri' };

  test('register hashes the password and never returns it', async () => {
    const { user, token } = await authService.register(creds);
    expect(user.email).toBe('sayuri@example.com');
    expect(user).not.toHaveProperty('passwordHash');
    expect(store.findUserByEmail('sayuri@example.com').passwordHash).not.toBe(creds.password);
    expect(jwt.verify(token, 'test-secret').sub).toBe(user.id);
  });

  test('duplicate email is rejected regardless of case', async () => {
    await authService.register(creds);
    await expect(authService.register({ ...creds, email: 'SAYURI@example.com' })).rejects.toMatchObject({ status: 409 });
  });

  test('login succeeds with correct password', async () => {
    await authService.register(creds);
    const { token } = await authService.login({ email: 'sayuri@example.com', password: creds.password });
    expect(token).toBeTruthy();
  });

  test('wrong password and unknown user give the same error', async () => {
    await authService.register(creds);
    await expect(authService.login({ email: 'sayuri@example.com', password: 'nope' })).rejects.toThrow('Invalid email or password');
    await expect(authService.login({ email: 'ghost@example.com', password: 'nope' })).rejects.toThrow('Invalid email or password');
  });
});
