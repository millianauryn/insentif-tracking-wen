import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { hashPassword, verifyPassword, createSession } from './auth.js';

describe('Auth utilities', () => {
  it('hashPassword should return a string with colon', async () => {
    const hash = await hashPassword('password123');
    expect(hash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
  });

  it('verifyPassword should return true for correct password', async () => {
    const hash = await hashPassword('secret');
    const valid = await verifyPassword('secret', hash);
    expect(valid).toBe(true);
  });

  it('verifyPassword should return false for incorrect password', async () => {
    const hash = await hashPassword('secret');
    const invalid = await verifyPassword('wrong', hash);
    expect(invalid).toBe(false);
  });

  it('createSession should return token and expiresAt', () => {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE sessions (token_hash TEXT, user_id INTEGER, expires_at TEXT)`);
    const session = createSession(db, 1);
    expect(session).toHaveProperty('token');
    expect(session).toHaveProperty('expiresAt');
    expect(typeof session.token).toBe('string');
    expect(typeof session.expiresAt).toBe('string');
  });
});