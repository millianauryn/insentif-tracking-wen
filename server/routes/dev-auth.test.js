import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { openDatabase, migrateDatabase } from '../db.js';
import { configureAuthDatabase, requireAuth } from '../middleware.js';
import createDevAuthRouter from './dev-auth.js';

function createTestApp(db) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', createDevAuthRouter(db));
  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));
  return supertest(app);
}

describe('Dev quick-login API', () => {
  let db;
  let request;
  let previousNodeEnv;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
    configureAuthDatabase(db);
    request = createTestApp(db);
    previousNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('creates super as superadmin, sets session cookie, session works', async () => {
    const response = await request.post('/api/auth/dev-login?user=super').expect(200);
    expect(response.body.user).toEqual(expect.objectContaining({ username: 'super', role: 'superadmin' }));
    expect(response.headers['set-cookie'][0]).toMatch(/^session_token=/);

    const cookie = response.headers['set-cookie'][0].split(';')[0];
    const me = await request.get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.user).toEqual(expect.objectContaining({ username: 'super', role: 'superadmin' }));
  });

  it('reactivates a deactivated account and syncs its role', async () => {
    db.prepare("INSERT INTO users (username, password_hash, role, active) VALUES ('direksi', 'x:x', 'officer', 0)").run();

    const response = await request.post('/api/auth/dev-login?user=direksi').expect(200);
    expect(response.body.user).toEqual(expect.objectContaining({ username: 'direksi', role: 'observer' }));

    const row = db.prepare("SELECT active, role FROM users WHERE username = 'direksi'").get();
    expect(row).toEqual({ active: 1, role: 'observer' });
  });

  it('does not touch unrelated accounts', async () => {
    db.prepare("INSERT INTO users (username, password_hash, role, active) VALUES ('tes', 'x:x', 'officer', 0)").run();

    await request.post('/api/auth/dev-login?user=super').expect(200);

    const row = db.prepare("SELECT active FROM users WHERE username = 'tes'").get();
    expect(row.active).toBe(0);
  });

  it('rejects usernames that are not in the map', async () => {
    const before = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;

    await request.post('/api/auth/dev-login?user=root').expect(404);
    await request.post("/api/auth/dev-login?user=super'--").expect(404);

    const after = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    expect(after).toBe(before);
  });

  it('production guard returns 404', async () => {
    process.env.NODE_ENV = 'production';
    await request.post('/api/auth/dev-login?user=super').expect(404);
  });

  it('is not blocked after more than ten attempts', async () => {
    for (let i = 0; i < 12; i += 1) {
      await request.post('/api/auth/dev-login?user=super').expect(200);
    }
  });
});
