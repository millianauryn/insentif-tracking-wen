import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { openDatabase, migrateDatabase } from '../db.js';
import createDocumentsRouter from './documents.js';

function appFor(db, user) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/api/documents', createDocumentsRouter(db, { requireAuth: (_req, _res, next) => next() }));
  return supertest(app);
}

describe('Documents API', () => {
  let db;
  let officer;
  let admin;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('officer', 'hash', 'officer')").run();
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', 'hash', 'superadmin')").run();
    db.prepare("INSERT INTO document_formats (name, version) VALUES ('Default', '1')").run();
    db.prepare("INSERT INTO criteria_definitions (label, target_unit, sort_order) VALUES ('Target', 'pcs', 1)").run();
    db.prepare("INSERT INTO branches (name, city) VALUES ('Cabang A', 'Banjarmasin')").run();
    db.prepare("INSERT INTO positions (name, position_type, branch_id) VALUES ('BUDO', 'SPV', 1)").run();
    db.prepare("INSERT INTO positions (name, position_type, parent_position_id, branch_id) VALUES ('SARI', 'SALES', 1, 1)").run();
    db.prepare("INSERT INTO user_branches (user_id, branch_id) VALUES (1, 1)").run();
    db.prepare("INSERT INTO position_branches (position_id, branch_id) VALUES (1, 1)").run();
    officer = appFor(db, { id: 1, username: 'officer', role: 'officer', branch_ids: [1] });
    admin = appFor(db, { id: 2, username: 'admin', role: 'superadmin', branch_ids: [] });
  });

  it('creates Draft and snapshots active criteria and flexible Golongan rows', async () => {
    const response = await officer.post('/api/documents').send({
      format_id: 1,
      division_id: null,
      salesman: 'Sari',
      product: 'Paseo',
      period: '2026-10',
      golongan_rows: [
        { label: 'GROUP PASEO', is_group: true, sort_order: 1 },
        { label: 'Paseo 250s', parent_index: 0, target: 10, achievement: 12, sort_order: 2 }
      ]
    }).expect(201);

    expect(response.body.document.status).toBe('Draft');
    expect(db.prepare('SELECT COUNT(*) AS count FROM document_criteria_rows').get().count).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS count FROM golongan_rows').get().count).toBe(2);
    expect(db.prepare('SELECT label FROM golongan_rows WHERE is_group = 1').get().label).toBe('GROUP PASEO');
  });

  it('membuat dokumen SPV dengan rentang periode dan menolak SPV di luar cabang', async () => {
    const created = await officer.post('/api/documents').send({
      doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-11',
    }).expect(201);
    expect(created.body.document.doc_kind).toBe('spv');
    expect(created.body.document.period_end).toBe('2026-11');
    expect(created.body.document.position_id).toBe(1);
    expect(created.body.document.salesman).toBe('BUDO');

    await officer.post('/api/documents').send({
      doc_kind: 'spv', position_id: 999, format_id: 1, period: '2026-10', period_end: '2026-11',
    }).expect(403);
  });

  it('menolak rentang yang terbalik dan duplikat rentang per SPV', async () => {
    await officer.post('/api/documents').send({
      doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-11', period_end: '2026-10',
    }).expect(422);

    await officer.post('/api/documents').send({
      doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-11',
    }).expect(201);
    await officer.post('/api/documents').send({
      doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-11',
    }).expect(409);
  });

  it('dokumen sales tetap boleh dibuat untuk nama yang sama dengan SPV', async () => {
    await officer.post('/api/documents').send({
      doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-11',
    }).expect(201);
    await officer.post('/api/documents').send({
      format_id: 1, salesman: 'BUDO', period: '2026-10', golongan_rows: [],
    }).expect(201);
  });

  it('SPV Draft menampilkan baris hasil hitung dan Final membekukan snapshot', async () => {
    db.prepare("INSERT INTO incentive_documents (owner_id, format_id, salesman, period, status, doc_kind) VALUES (1, 1, 'SARI', '2026-10', 'Final', 'sales')").run();
    const salesId = db.prepare('SELECT id FROM incentive_documents ORDER BY id DESC LIMIT 1').get().id;
    db.prepare("INSERT INTO golongan_rows (document_id, label, target, achievement, is_group) VALUES (?, 'Brand X', 10, 12, 0)").run(salesId);
    db.prepare("INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, target_value, achievement_value) VALUES (?, 1, 'Target', 'pcs', 10, 12)").run(salesId);

    const created = await officer.post('/api/documents').send({
      doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-10',
    }).expect(201);
    const id = created.body.document.id;

    const draft = await officer.get(`/api/documents/${id}`).expect(200);
    expect(draft.body.document.golongan_rows).toHaveLength(1);
    expect(draft.body.document.golongan_rows[0].target).toBe(10);
    expect(draft.body.document.criteria_rows.find((c) => c.criteria_id === 1).target_value).toBe(10);

    await admin.post(`/api/documents/${id}/finalize`).expect(200);
    expect(db.prepare('SELECT COUNT(*) AS count FROM golongan_rows WHERE document_id = ?').get(id).count).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS count FROM document_criteria_rows WHERE document_id = ?').get(id).count).toBe(1);

    // Setelah Final, baris beku: dokumen sales baru tidak mengubahnya.
    db.prepare("INSERT INTO incentive_documents (owner_id, format_id, salesman, period, status, doc_kind) VALUES (1, 1, 'SARI', '2026-12', 'Final', 'sales')").run();
    const other = db.prepare('SELECT id FROM incentive_documents ORDER BY id DESC LIMIT 1').get().id;
    db.prepare("INSERT INTO golongan_rows (document_id, label, target, achievement, is_group) VALUES (?, 'Brand Y', 99, 99, 0)").run(other);

    const final = await officer.get(`/api/documents/${id}`).expect(200);
    expect(final.body.document.golongan_rows).toHaveLength(1);
    expect(final.body.document.golongan_rows[0].target).toBe(10);
  });

  it('SPV menolak golongan_rows dari client dan mengunci periode saat Final', async () => {
    const created = await officer.post('/api/documents').send({
      doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-10',
    }).expect(201);
    const id = created.body.document.id;

    await officer.patch(`/api/documents/${id}`).send({ golongan_rows: [{ label: 'Palsu', target: 1 }] }).expect(422);
    await officer.patch(`/api/documents/${id}`).send({ criteria_rows: [{ criteria_id: 1, target_value: 5 }] }).expect(422);
    await officer.patch(`/api/documents/${id}`).send({ insentif_total: 5000 }).expect(200);
    await officer.patch(`/api/documents/${id}`).send({ period: '2026-11', period_end: '2026-11' }).expect(200);
    // Nama SPV berasal dari posisi, tidak boleh diganti dari payload client.
    await officer.patch(`/api/documents/${id}`).send({ salesman: 'NAMA PALSU' }).expect(200);
    expect(db.prepare('SELECT salesman FROM incentive_documents WHERE id = ?').get(id).salesman).toBe('BUDO');

    await admin.post(`/api/documents/${id}/finalize`).expect(200);
    await admin.patch(`/api/documents/${id}`).send({ period: '2026-12', audit_reason: 'koreksi rentang' }).expect(409);
    await admin.patch(`/api/documents/${id}`).send({ period_end: '2026-12', audit_reason: 'koreksi rentang' }).expect(409);
    await admin.patch(`/api/documents/${id}`).send({ position_id: 2, audit_reason: 'koreksi spv' }).expect(409);
    // Koreksi yang tidak mengubah kunci dokumen tetap boleh.
    await admin.patch(`/api/documents/${id}`).send({ insentif_total: 7000, audit_reason: 'koreksi nominal' }).expect(200);
  });

  it('allows owner to edit Draft, blocks officer finalize, lets observer approve, and allows Super Admin correction', async () => {
    const created = await officer.post('/api/documents').send({ format_id: 1, period: '2026-10', golongan_rows: [] }).expect(201);
    const id = created.body.document.id;
    const observer = appFor(db, { id: 3, username: 'observer', role: 'observer' });

    await officer.patch(`/api/documents/${id}`).send({ period: '2026-11', golongan_rows: [] }).expect(200);
    await officer.post(`/api/documents/${id}/finalize`).expect(403);
    await observer.post(`/api/documents/${id}/finalize`).expect(200);
    await officer.patch(`/api/documents/${id}`).send({ period: '2026-12' }).expect(409);
    await admin.patch(`/api/documents/${id}`).send({ period: '2027-01' }).expect(422); // Final wajib audit_reason
    await admin.patch(`/api/documents/${id}`).send({ period: '2027-01', audit_reason: 'koreksi periode salah' }).expect(200);
    expect(db.prepare('SELECT COUNT(*) AS count FROM audit_logs WHERE entity_type = \'incentive_document\'').get().count).toBe(1);
  });

  it('does not show another officer documents but observer can read them', async () => {
    const created = await officer.post('/api/documents').send({ format_id: 1, period: '2026-10', golongan_rows: [] }).expect(201);
    const otherOfficer = appFor(db, { id: 99, username: 'other', role: 'officer' });
    const observer = appFor(db, { id: 3, username: 'observer', role: 'observer' });
    const officerResponse = await otherOfficer.get('/api/documents').expect(200);
    const observerResponse = await observer.get('/api/documents').expect(200);
    expect(officerResponse.body.documents.some((document) => document.id === created.body.document.id)).toBe(false);
    expect(observerResponse.body.documents.some((document) => document.id === created.body.document.id)).toBe(true);
  });

  it('blocks observer writes and rejects invalid Golongan parents', async () => {
    const observer = appFor(db, { id: 3, username: 'observer', role: 'observer' });
    await observer.post('/api/documents').send({ format_id: 1, period: '2026-10', golongan_rows: [] }).expect(403);
    await officer.post('/api/documents').send({
      format_id: 1,
      period: '2026-10',
      golongan_rows: [{ label: 'Child', parent_index: 4 }],
    }).expect(422);
  });

  it('stores criteria_rows values on create', async () => {
    const res = await officer.post('/api/documents').send({
      format_id: 1,
      period: '2026-09',
      golongan_rows: [{ label: 'PASEO', target: 182000000, achievement: 202812699 }],
      criteria_rows: [
        { criteria_id: 1, target_value: 22, achievement_value: 23.69, incentive_amount: 169615 },
      ],
    }).expect(201);

    const rows = db.prepare('SELECT * FROM document_criteria_rows WHERE document_id = ?').all(res.body.document.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].target_value).toBe(22);
    expect(rows[0].achievement_value).toBe(23.69);
    expect(rows[0].incentive_amount).toBe(169615);
    expect(rows[0].percentage).toBeCloseTo((23.69 / 22) * 100, 1);
    expect(rows[0].status).toBe('Tercapai');
  });

  it('persists kwitansi on create and update', async () => {
    const kwitansi = {
      penerima: 'PT. BINTANG SINAR JAYA',
      jumlahUang: '862.000',
      keterangan: 'Incentive penjualan bulan September 2026',
      terbilang: 'Delapan ratus enam puluh dua ribu rupiah',
      nominal: '862.000',
    };
    const res = await officer.post('/api/documents').send({
      format_id: 1,
      period: '2026-09',
      golongan_rows: [],
      kwitansi,
    }).expect(201);
    const id = res.body.document.id;

    const get1 = await officer.get(`/api/documents/${id}`).expect(200);
    expect(get1.body.document.kwitansi).toEqual(kwitansi);

    await officer.patch(`/api/documents/${id}`).send({ kwitansi: { ...kwitansi, nominal: '900.000' } }).expect(200);
    const get2 = await officer.get(`/api/documents/${id}`).expect(200);
    expect(get2.body.document.kwitansi.nominal).toBe('900.000');
    expect(get2.body.document.kwitansi.penerima).toBe('PT. BINTANG SINAR JAYA');
  });

  it('persists manual insentif_total override and resets to null', async () => {
    const res = await officer.post('/api/documents').send({
      format_id: 1,
      period: '2026-09',
      golongan_rows: [],
      insentif_total: 862000,
    }).expect(201);
    const id = res.body.document.id;

    const get1 = await officer.get(`/api/documents/${id}`).expect(200);
    expect(get1.body.document.insentif_total).toBe(862000);

    // null → back to auto (client falls back to summing the criteria rows)
    await officer.patch(`/api/documents/${id}`).send({ insentif_total: null }).expect(200);
    const get2 = await officer.get(`/api/documents/${id}`).expect(200);
    expect(get2.body.document.insentif_total).toBeNull();
  });

  it('updates criteria_rows values on patch', async () => {
    const created = await officer.post('/api/documents').send({
      format_id: 1,
      period: '2026-09',
      golongan_rows: [],
      criteria_rows: [{ criteria_id: 1, target_value: 22, achievement_value: 23.69, incentive_amount: 169615 }],
    }).expect(201);
    const docId = created.body.document.id;

    await officer.patch(`/api/documents/${docId}`).send({
      criteria_rows: [{ criteria_id: 1, target_value: 30, achievement_value: 35, incentive_amount: 200000 }],
    }).expect(200);

    const row = db.prepare('SELECT * FROM document_criteria_rows WHERE document_id = ? AND criteria_id = 1').get(docId);
    expect(row.target_value).toBe(30);
    expect(row.achievement_value).toBe(35);
    expect(row.incentive_amount).toBe(200000);
    expect(row.percentage).toBeCloseTo((35 / 30) * 100, 1);
    expect(row.status).toBe('Tercapai');
  });

  it('blocks a second document for the same sales in the same period', async () => {
    await officer.post('/api/documents').send({ format_id: 1, salesman: 'BIDU', period: '2026-11', golongan_rows: [] }).expect(201);
    await officer.post('/api/documents').send({ format_id: 1, salesman: 'bidu', period: '2026-11', golongan_rows: [] }).expect(409);
    await officer.post('/api/documents').send({ format_id: 1, salesman: 'BIDU', period: '2026-12', golongan_rows: [] }).expect(201);
    await officer.post('/api/documents').send({ format_id: 1, salesman: 'DONI', period: '2026-11', golongan_rows: [] }).expect(201);
    await officer.post('/api/documents').send({ format_id: 1, salesman: '', period: '2026-11', golongan_rows: [] }).expect(201);
    await officer.post('/api/documents').send({ format_id: 1, salesman: '', period: '2026-11', golongan_rows: [] }).expect(201);
  });

  it('allows owner to delete Draft but blocks delete of Final', async () => {
    const created = await officer.post('/api/documents').send({ format_id: 1, period: '2026-10', golongan_rows: [] }).expect(201);
    const id = created.body.document.id;
    const observer = appFor(db, { id: 3, username: 'observer', role: 'observer' });
    await observer.delete(`/api/documents/${id}`).expect(403);
    await officer.delete(`/api/documents/${id}`).expect(200);
    await officer.get(`/api/documents/${id}`).expect(404);

    const created2 = await officer.post('/api/documents').send({ format_id: 1, period: '2026-10', golongan_rows: [] }).expect(201);
    const id2 = created2.body.document.id;
    await appFor(db, { id: 2, username: 'admin', role: 'superadmin' }).post(`/api/documents/${id2}/finalize`).expect(200);
    await officer.delete(`/api/documents/${id2}`).expect(409);
  });

  it('persists divisi selection on create, update and clear', async () => {
    const created = await officer.post('/api/documents').send({ format_id: 1, period: '2026-11', divisi: 'Pulau Baru', golongan_rows: [] }).expect(201);
    const id = created.body.document.id;
    expect((await officer.get(`/api/documents/${id}`)).body.document.divisi).toBe('Pulau Baru');

    await officer.patch(`/api/documents/${id}`).send({ divisi: 'Laut Indah' }).expect(200);
    expect((await officer.get(`/api/documents/${id}`)).body.document.divisi).toBe('Laut Indah');

    await officer.patch(`/api/documents/${id}`).send({ divisi: null }).expect(200);
    expect((await officer.get(`/api/documents/${id}`)).body.document.divisi).toBeNull();
  });

  it('supports limit/offset pagination and reports total', async () => {
    for (const period of ['2026-07', '2026-08', '2026-09']) {
      await officer.post('/api/documents').send({ format_id: 1, period, golongan_rows: [] }).expect(201);
    }
    const page1 = await officer.get('/api/documents?limit=2').expect(200);
    expect(page1.body.total).toBe(3);
    expect(page1.body.documents).toHaveLength(2);

    const page2 = await officer.get('/api/documents?limit=2&offset=2').expect(200);
    expect(page2.body.total).toBe(3);
    expect(page2.body.documents).toHaveLength(1);

    // tanpa param -> semua (kompatibel lama)
    const all = await officer.get('/api/documents').expect(200);
    expect(all.body.total).toBe(3);
    expect(all.body.documents).toHaveLength(3);
  });
});