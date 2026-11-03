import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import supertest from 'supertest';
import masterDataRouter from './master-data.js';
import { openDatabase, migrateDatabase } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

describe('Master Data API', () => {
  let db;
  let app;
  let request;

  beforeAll(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
    
    app = express();
    app.use(express.json());
    
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

    app.use('/api/master-data', masterDataRouter(db, { requireAuth, requireRole }));
    
    request = supertest(app);
  });

  afterAll(() => {
    db.close();
  });

  it('should return master data for super admin', async () => {
    const response = await request
      .get('/api/master-data')
      .set('Authorization', 'Bearer superadmin-token')
      .expect(200);
    
    expect(response.body).toHaveProperty('divisions');
    expect(response.body).toHaveProperty('principals');
    expect(response.body).toHaveProperty('brands');
  });

  it('should return master data for officer', async () => {
    const response = await request
      .get('/api/master-data')
      .set('Authorization', 'Bearer officer-token')
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

  it('should update a division', async () => {
    const createResponse = await request
      .post('/api/master-data/divisions')
      .set('Authorization', 'Bearer superadmin-token')
      .send({ name: 'Test Division To Update' })
      .expect(201);
    
    const divisionId = createResponse.body.division.id;
    
    const response = await request
      .patch(`/api/master-data/divisions/${divisionId}`)
      .set('Authorization', 'Bearer superadmin-token')
      .send({ name: 'Updated Division', is_active: 0 })
      .expect(200);
    
    expect(response.body.message).toBe('Division updated');
    const updated = db.prepare('SELECT name, is_active FROM divisions WHERE id = ?').get(divisionId);
    expect(updated).toEqual({ name: 'Updated Division', is_active: 0 });
  });

  it('should update principal and brand partially', async () => {
    const principalResponse = await request
      .post('/api/master-data/principals')
      .set('Authorization', 'Bearer superadmin-token')
      .send({ name: 'Principal To Update' })
      .expect(201);
    const principalId = principalResponse.body.principal.id;

    await request
      .patch(`/api/master-data/principals/${principalId}`)
      .set('Authorization', 'Bearer superadmin-token')
      .send({ name: 'Updated Principal' })
      .expect(200);
    expect(db.prepare('SELECT name FROM principals WHERE id = ?').get(principalId).name).toBe('Updated Principal');

    const brandResponse = await request
      .post('/api/master-data/brands')
      .set('Authorization', 'Bearer superadmin-token')
      .send({ principal_id: principalId, name: 'Brand To Update' })
      .expect(201);
    const brandId = brandResponse.body.brand.id;

    await request
      .patch(`/api/master-data/brands/${brandId}`)
      .set('Authorization', 'Bearer superadmin-token')
      .send({ name: 'Updated Brand' })
      .expect(200);
    expect(db.prepare('SELECT name, principal_id FROM brands WHERE id = ?').get(brandId)).toEqual({
      name: 'Updated Brand',
      principal_id: principalId,
    });
  });

  it('should delete a division', async () => {
    const createResponse = await request
      .post('/api/master-data/divisions')
      .set('Authorization', 'Bearer superadmin-token')
      .send({ name: 'Test Division To Delete' })
      .expect(201);
    
    const divisionId = createResponse.body.division.id;
    
    const response = await request
      .delete(`/api/master-data/divisions/${divisionId}`)
      .set('Authorization', 'Bearer superadmin-token')
      .expect(200);
    
    expect(response.body.message).toBe('Division deleted');
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

  it('should fail to create brand with duplicate name for same principal', async () => {
    const principalResponse = await request
      .post('/api/master-data/principals')
      .set('Authorization', 'Bearer superadmin-token')
      .send({ name: 'Test Principal For Brand 2' })
      .expect(201);
    
    const principalId = principalResponse.body.principal.id;
    
    await request
      .post('/api/master-data/brands')
      .set('Authorization', 'Bearer superadmin-token')
      .send({ principal_id: principalId, name: 'Test Brand 2' })
      .expect(201);
    
    await request
      .post('/api/master-data/brands')
      .set('Authorization', 'Bearer superadmin-token')
      .send({ principal_id: principalId, name: 'Test Brand 2' })
      .expect(409);
  });
});