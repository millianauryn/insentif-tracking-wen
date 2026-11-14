import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { openDatabase, migrateDatabase } from '../db.js';
import createPositionsRouter from './positions.js';

function appFor(db, user) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; next(); });
  const requireAuth = (_req, _res, next) => next();
  const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  };
  app.use('/api/positions', createPositionsRouter(db, { requireAuth, requireRole }));
  return supertest(app);
}

describe('Positions API', () => {
  let db;
  let admin;
  let officer;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
    db.prepare("INSERT INTO branches (name, is_active) VALUES ('Cabang Utama', 1)").run();
    db.prepare("INSERT INTO criteria_definitions (label, sort_order) VALUES ('EFFECTIVE CALLS', 1)").run();
    admin = appFor(db, { id: 1, username: 'super', role: 'superadmin' });
    officer = appFor(db, { id: 2, username: 'of1', role: 'officer' });
  });

  it('enforces hierarchy: SPV needs a BM parent, SALES needs a SPV parent', async () => {
    const bm = await admin.post('/api/positions').send({ name: 'BUDI', position_type: 'BM' }).expect(201);
    const bmId = bm.body.position.id;

    await admin.post('/api/positions').send({ name: 'SPV-TANPA-ATASAN', position_type: 'SPV' }).expect(400);
    const spvRes = await admin.post('/api/positions').send({ name: 'BUDO', position_type: 'SPV', parent_position_id: bmId }).expect(201);
    const spvId = spvRes.body.position.id;

    await admin.post('/api/positions').send({ name: 'SALAH-ATASAN', position_type: 'SALES', parent_position_id: bmId }).expect(400);
    await admin.post('/api/positions').send({ name: 'BIDU', position_type: 'SALES', parent_position_id: spvId }).expect(201);
  });

  it('lists positions with branch_ids and criteria_ids without per-row queries', async () => {
    const created = await admin.post('/api/positions').send({
      name: 'BIDU',
      position_type: 'BM',
      branch_ids: [1],
      criteria_ids: [1],
      sales_code: '11111',
    }).expect(201);

    const res = await officer.get('/api/positions').expect(200);
    const found = res.body.positions.find((p) => p.id === created.body.position.id);
    expect(found.branch_ids).toEqual([1]);
    expect(found.criteria_ids).toEqual([1]);
    expect(found.sales_code).toBe('11111');
  });

  it('only superadmin may write', async () => {
    await officer.post('/api/positions').send({ name: 'X', position_type: 'BM' }).expect(403);
    await officer.delete('/api/positions/1').expect(403);
  });

  it('enforces the same hierarchy rules on update', async () => {
    const bm = await admin.post('/api/positions').send({ name: 'BUDI', position_type: 'BM' }).expect(201);
    const spv = await admin.post('/api/positions').send({ name: 'BUDO', position_type: 'SPV', parent_position_id: bm.body.position.id }).expect(201);
    const sales = await admin.post('/api/positions').send({ name: 'BIDU', position_type: 'SALES', parent_position_id: spv.body.position.id }).expect(201);
    const salesId = sales.body.position.id;

    // SALES dengan parent BM -> ditolak (create menolak, update juga harus)
    await admin.patch(`/api/positions/${salesId}`).send({ parent_position_id: bm.body.position.id }).expect(400);
    // ganti type ke SALES dengan parent diri sendiri (bukan SPV) -> ditolak
    await admin.patch(`/api/positions/${bm.body.position.id}`).send({ position_type: 'SALES', parent_position_id: bm.body.position.id }).expect(400);
    // perubahan tanpa sentuh hierarki tetap jalan
    await admin.patch(`/api/positions/${salesId}`).send({ name: 'BIDU BARU' }).expect(200);
  });
});
