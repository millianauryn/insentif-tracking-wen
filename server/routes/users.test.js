import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import supertest from 'supertest';
import usersRouter from './users.js';
import masterDataRouter from './master-data.js';
import { openDatabase, migrateDatabase } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

describe('Users and Master Data API', () => {
  let db;
  let app;
  let request;
  let sessionCookie;

  beforeAll(async () => {
    // Use in-memory database for testing
    db = openDatabase(':memory:');
    migrateDatabase(db);
    
    // Create a super admin user for testing
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16);
    const passwordHash = await new Promise((resolve, reject) => {
      crypto.scrypt('test-password', salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
      });
    });
    
    db.prepare(`
      INSERT INTO users (username, password_hash, role, created_by, active)
      VALUES (?, ?, 'superadmin', NULL, 1)
    `).run('superadmin', passwordHash);
    
    // Create a regular officer user
    const officerPasswordHash = await new Promise((resolve, reject) => {
      crypto.scrypt('officer-password', crypto.randomBytes(16), 64, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
      });
    });
    
    db.prepare(`
      INSERT INTO users (username, password_hash, role, created_by, active)
      VALUES (?, ?, 'officer', 1, 1)
    `).run('officer1', officerPasswordHash);

    // Create a branch for officer branch assignment tests
    db.prepare(`
      INSERT INTO regions (name, is_active) VALUES ('Test Region', 1)
    `).run();
    db.prepare(`
      INSERT INTO branches (name, region_id, is_active) VALUES ('Test Branch', 1, 1)
    `).run();
    
    // Create a mock app with authentication
    app = express();
    app.use(express.json());
    app.use(require('cookie-parser')());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      if (req.headers.authorization === 'Bearer superadmin-token') {
        req.user = { id: 1, username: 'superadmin', role: 'superadmin' };
      } else if (req.headers.authorization === 'Bearer officer-token') {
        req.user = { id: 2, username: 'officer1', role: 'officer' };
      }
      next();
    });
    
    const requireAuth = (req, res, next) => next();
    const requireRole = (...allowedRoles) => (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: 'Insufficient permissions' } });
      }
      next();
    };

    app.use('/api/users', usersRouter(db, { requireAuth, requireRole }));
    app.use('/api/master-data', masterDataRouter(db, { requireAuth, requireRole }));
    
    request = supertest(app);
  });

  afterAll(() => {
    db.close();
  });

  describe('Users API (Super Admin only)', () => {
    it('should return all users for super admin', async () => {
      const response = await request
        .get('/api/users')
        .set('Authorization', 'Bearer superadmin-token')
        .expect(200);
      
      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should deny access for officer', async () => {
      const response = await request
        .get('/api/users')
        .set('Authorization', 'Bearer officer-token')
        .expect(403);
      
      expect(response.body.error.code).toBe('AUTH_FORBIDDEN');
    });

    it('should create a new user', async () => {
      const response = await request
        .post('/api/users')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ username: 'newuser', password: 'password123', role: 'officer', branch_ids: [1] })
        .expect(201);
      
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('newuser');
      expect(response.body.user.role).toBe('officer');
      expect(response.body.user.branch_ids).toEqual([1]);
    });

    it('should fail to create officer without branch', async () => {
      await request
        .post('/api/users')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ username: 'nobranch', password: 'password123', role: 'officer' })
        .expect(400);
    });

    it('should fail to create user with duplicate username', async () => {
      await request
        .post('/api/users')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ username: 'officer1', password: 'password123', role: 'officer' })
        .expect(409);
    });

    it('should update a user', async () => {
      // First create a user to update
      const createResponse = await request
        .post('/api/users')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ username: 'toupdate', password: 'password123', role: 'officer', branch_ids: [1] })
        .expect(201);
      
      const userId = createResponse.body.user.id;
      
      const response = await request
        .patch(`/api/users/${userId}`)
        .set('Authorization', 'Bearer superadmin-token')
        .send({ username: 'updateduser', role: 'observer', branch_ids: [] })
        .expect(200);
      
      expect(response.body.message).toBe('User updated');
    });

    it('stores superadmin-picked avatar', async () => {
      const created = await request
        .post('/api/users')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ username: 'avataruser', password: 'password123', role: 'observer', avatar_key: '🦊', avatar_color: '#3B82F6' })
        .expect(201);
      expect(created.body.user.avatar_key).toBe('🦊');
      expect(created.body.user.avatar_color).toBe('#3B82F6');

      const list = await request.get('/api/users').set('Authorization', 'Bearer superadmin-token').expect(200);
      expect(list.body.users.find((u) => u.username === 'avataruser')).toMatchObject({ avatar_key: '🦊', avatar_color: '#3B82F6' });

      await request
        .patch(`/api/users/${created.body.user.id}`)
        .set('Authorization', 'Bearer superadmin-token')
        .send({ avatar_key: null, avatar_color: '#E11D48' })
        .expect(200);
      const after = await request.get('/api/users').set('Authorization', 'Bearer superadmin-token').expect(200);
      expect(after.body.users.find((u) => u.username === 'avataruser')).toMatchObject({ avatar_key: null, avatar_color: '#E11D48' });
    });

    it('should delete a user', async () => {
      // First create a user to delete
      const createResponse = await request
        .post('/api/users')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ username: 'todelete', password: 'password123', role: 'officer', branch_ids: [1] })
        .expect(201);
      
      const userId = createResponse.body.user.id;
      
      const response = await request
        .delete(`/api/users/${userId}`)
        .set('Authorization', 'Bearer superadmin-token')
        .expect(200);
      
      expect(response.body.message).toBe('User deleted');
    });

    it('does not half-commit when branch sync fails (single transaction)', async () => {
      const createResponse = await request
        .post('/api/users')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ username: 'halftest', password: 'password123', role: 'officer', branch_ids: [1] })
        .expect(201);
      const userId = createResponse.body.user.id;

      // branch 999 tidak ada -> gagal di tengah transaksi
      const res = await request
        .patch(`/api/users/${userId}`)
        .set('Authorization', 'Bearer superadmin-token')
        .send({ role: 'observer', branch_ids: [999] });
      expect(res.status).toBeGreaterThanOrEqual(400);

      // field user TIDAK boleh tersimpan (rollback penuh)
      const after = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
      expect(after.role).toBe('officer');
    });
  });

  describe('Master Data API (Super Admin only)', () => {
    it('should return master data for super admin', async () => {
      const response = await request
        .get('/api/master-data')
        .set('Authorization', 'Bearer superadmin-token')
        .expect(200);
      
      expect(response.body).toHaveProperty('divisions');
      expect(response.body).toHaveProperty('principals');
      expect(response.body).toHaveProperty('brands');
    });

    it('should create a division', async () => {
      const response = await request
        .post('/api/master-data/divisions')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ name: 'Test Division' })
        .expect(201);
      
      expect(response.body).toHaveProperty('division');
      expect(response.body.division.name).toBe('Test Division');
    });

    it('should fail to create division with duplicate name', async () => {
      await request
        .post('/api/master-data/divisions')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ name: 'Test Division' })
        .expect(409);
    });

    it('should create a principal', async () => {
      const response = await request
        .post('/api/master-data/principals')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ name: 'Test Principal' })
        .expect(201);
      
      expect(response.body).toHaveProperty('principal');
      expect(response.body.principal.name).toBe('Test Principal');
    });

    it('should create a brand', async () => {
      // First create a principal
      const principalResponse = await request
        .post('/api/master-data/principals')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ name: 'Test Principal For Brand' })
        .expect(201);
      
      const principalId = principalResponse.body.principal.id;
      
      const response = await request
        .post('/api/master-data/brands')
        .set('Authorization', 'Bearer superadmin-token')
        .send({ principal_id: principalId, name: 'Test Brand' })
        .expect(201);
      
      expect(response.body).toHaveProperty('brand');
      expect(response.body.brand.name).toBe('Test Brand');
    });
  });
});