import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { openDatabase, migrateDatabase } from '../db.js';
import createCriteriaRouter from './criteria.js';

function createTestApp(db, user) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  const requireAuth = (_req, _res, next) => next();
  const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  };
  app.use('/api', createCriteriaRouter(db, { requireAuth, requireRole }));
  return supertest(app);
}

describe('Criteria API', () => {
  let db;
  let adminRequest;
  let officerRequest;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', 'hash', 'superadmin')").run();
    db.prepare("INSERT INTO document_formats (name, version) VALUES ('Default', '1')").run();
    adminRequest = createTestApp(db, { id: 1, role: 'superadmin' });
    officerRequest = createTestApp(db, { id: 1, role: 'officer' });
  });

  it('allows authenticated users to read formats and criteria', async () => {
    const response = await officerRequest.get('/api/document-formats').expect(200);
    expect(response.body.formats[0].name).toBe('Default');
  });

  it('allows only Super Admin to create criteria', async () => {
    await officerRequest.post('/api/criteria-definitions').send({ label: 'Target', target_unit: 'pcs' }).expect(403);
    const response = await adminRequest.post('/api/criteria-definitions')
      .send({ label: 'Target', target_unit: 'pcs', formula: 'achievement / target * 100', sort_order: 1 })
      .expect(201);
    expect(response.body.criteria.label).toBe('Target');
  });

  it('updates criteria without exposing password data and writes audit log', async () => {
    const created = await adminRequest.post('/api/criteria-definitions')
      .send({ label: 'Old label', sort_order: 1 })
      .expect(201);
    const response = await adminRequest.patch(`/api/criteria-definitions/${created.body.criteria.id}`)
      .send({ label: 'New label' })
      .expect(200);
    expect(response.body.criteria.label).toBe('New label');
    expect(db.prepare('SELECT COUNT(*) AS count FROM audit_logs').get().count).toBe(2);
  });

  it('blocks creating or renaming reserved special labels', async () => {
    // buat label terlarang -> 409
    await adminRequest.post('/api/criteria-definitions')
      .send({ label: 'CALL COMPLIANCE', sort_order: 6 })
      .expect(409);

    // baris reserved ada (seperti seed) -> rename diblokir, field lain tetap jalan
    db.prepare("INSERT INTO criteria_definitions (label, sort_order) VALUES ('GOL YG GUGUR KURANG DARI 50%', 6)").run();
    const row = db.prepare("SELECT id FROM criteria_definitions WHERE label = 'GOL YG GUGUR KURANG DARI 50%'").get();

    await adminRequest.patch(`/api/criteria-definitions/${row.id}`).send({ label: 'Gugur < 50%' }).expect(409);
    const ok = await adminRequest.patch(`/api/criteria-definitions/${row.id}`).send({ sort_order: 7 }).expect(200);
    expect(ok.body.criteria.label).toBe('GOL YG GUGUR KURANG DARI 50%');
  });
});