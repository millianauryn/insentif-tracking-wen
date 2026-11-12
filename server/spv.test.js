import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, migrateDatabase } from './db.js';
import { spvScopeError, computeSpvRows } from './spv.js';

function seed(db) {
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('officer', 'h', 'officer')").run();
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', 'h', 'superadmin')").run();
  db.prepare("INSERT INTO branches (name, city) VALUES ('Cabang A', 'Banjarmasin')").run();
  db.prepare("INSERT INTO branches (name, city) VALUES ('Cabang B', 'Surabaya')").run();
  db.prepare("INSERT INTO positions (name, position_type, branch_id) VALUES ('BUDI', 'BM', 1)").run();
  db.prepare("INSERT INTO positions (name, position_type, parent_position_id, branch_id) VALUES ('BUDO', 'SPV', 1, 1)").run();
  db.prepare("INSERT INTO positions (name, position_type, parent_position_id, branch_id) VALUES ('SPV LAIN', 'SPV', 1, 2)").run();
  db.prepare("INSERT INTO positions (name, position_type, parent_position_id, branch_id) VALUES ('SARI', 'SALES', 2, 1)").run();
  db.prepare("INSERT INTO positions (name, position_type, parent_position_id, branch_id) VALUES ('RUDI', 'SALES', 2, 1)").run();
  db.prepare("INSERT INTO document_formats (name, version) VALUES ('Default', '1')").run();
  db.prepare("INSERT INTO criteria_definitions (label, target_unit, sort_order) VALUES ('Target', 'pcs', 1)").run();
  db.prepare("INSERT INTO criteria_definitions (label, target_unit, sort_order) VALUES ('Call', 'pcs', 2)").run();
  db.prepare("INSERT INTO principals (name) VALUES ('PT A')").run();
  db.prepare("INSERT INTO brands (principal_id, name) VALUES (1, 'Brand X')").run();
}

// Officer punya cabang 1; SPV BUDO (id 2) ada di cabang 1, SPV LAIN (id 3) di cabang 2.
function assignBranches(db) {
  db.prepare('INSERT INTO user_branches (user_id, branch_id) VALUES (1, 1)').run();
  db.prepare('INSERT INTO position_branches (position_id, branch_id) VALUES (2, 1)').run();
  db.prepare('INSERT INTO position_branches (position_id, branch_id) VALUES (3, 2)').run();
}

function makeSalesDoc(db, { salesman, period, status = 'Final', golongan = [], criteria = [] }) {
  const info = db.prepare(`
    INSERT INTO incentive_documents (owner_id, format_id, salesman, period, status, doc_kind)
    VALUES (1, 1, ?, ?, ?, 'sales')
  `).run(salesman, period, status);
  const id = info.lastInsertRowid;
  golongan.forEach((g, i) => {
    db.prepare(`
      INSERT INTO golongan_rows (document_id, label, principal_id, brand_id, target, achievement, sort_order, is_group)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, g.label ?? null, g.principal_id ?? null, g.brand_id ?? null, g.target ?? null, g.achievement ?? null, i, g.is_group ? 1 : 0);
  });
  criteria.forEach((c, i) => {
    db.prepare(`
      INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, target_value, achievement_value, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, c.criteria_id, c.label, 'pcs', null, c.target_value ?? null, c.achievement_value ?? null, i);
  });
  return id;
}

describe('Cakupan SPV', () => {
  let db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
    seed(db);
    assignBranches(db);
  });

  afterEach(() => db.close());

  it('menolak SPV di luar cabang officer', () => {
    const officer = { id: 1, role: 'officer', branch_ids: [1] };
    expect(spvScopeError(db, officer, 2)).toBeNull();
    expect(spvScopeError(db, officer, 3)).toMatch(/cabang/i);
  });

  it('officer tanpa cabang tidak bisa memilih SPV mana pun', () => {
    expect(spvScopeError(db, { id: 1, role: 'officer', branch_ids: [] }, 2)).toMatch(/cabang/i);
  });

  it('superadmin bebas memilih SPV mana pun', () => {
    expect(spvScopeError(db, { id: 2, role: 'superadmin', branch_ids: [] }, 3)).toBeNull();
  });

  it('menolak posisi yang bukan SPV', () => {
    expect(spvScopeError(db, { id: 2, role: 'superadmin', branch_ids: [] }, 4)).toMatch(/SPV/i);
  });

  it('menolak posisi yang tidak ada', () => {
    expect(spvScopeError(db, { id: 2, role: 'superadmin', branch_ids: [] }, 999)).toMatch(/tidak ditemukan/i);
  });
});

describe('Agregasi baris SPV', () => {
  let db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
    seed(db);
    assignBranches(db);
  });

  afterEach(() => db.close());

  it('mengakumulasi brand dari dua sales dalam rentang yang sama', () => {
    makeSalesDoc(db, {
      salesman: 'SARI', period: '2026-10',
      golongan: [{ label: 'Brand X', principal_id: 1, brand_id: 1, target: 10, achievement: 12 }],
      criteria: [{ criteria_id: 1, label: 'Target', target_value: 10, achievement_value: 12 }],
    });
    makeSalesDoc(db, {
      salesman: 'RUDI', period: '2026-10',
      golongan: [{ label: 'Brand X', principal_id: 1, brand_id: 1, target: 5, achievement: 3 }],
      criteria: [{ criteria_id: 1, label: 'Target', target_value: 5, achievement_value: 3 }],
    });

    const rows = computeSpvRows(db, 2, '2026-10', '2026-11');
    expect(rows.golongan_rows).toHaveLength(1);
    expect(rows.golongan_rows[0].target).toBe(15);
    expect(rows.golongan_rows[0].achievement).toBe(15);
    expect(rows.golongan_rows[0].principal_name).toBe('PT A');
    expect(rows.golongan_rows[0].brand_name).toBe('Brand X');
    const target = rows.criteria_rows.find((c) => c.criteria_id === 1);
    expect(target.target_value).toBe(15);
    expect(target.achievement_value).toBe(15);
  });

  it('mengecualikan Draft dan periode di luar rentang', () => {
    // Satu sales satu dokumen per periode (index unik), jadi Draft & Final diuji di periode berbeda.
    makeSalesDoc(db, { salesman: 'SARI', period: '2026-11', status: 'Draft', golongan: [{ label: 'Brand X', brand_id: 1, target: 99, achievement: 99 }] });
    makeSalesDoc(db, { salesman: 'SARI', period: '2026-08', golongan: [{ label: 'Brand X', brand_id: 1, target: 77, achievement: 77 }] });
    makeSalesDoc(db, { salesman: 'SARI', period: '2026-10', golongan: [{ label: 'Brand X', brand_id: 1, target: 10, achievement: 12 }] });

    const rows = computeSpvRows(db, 2, '2026-10', '2026-11');
    expect(rows.golongan_rows).toHaveLength(1);
    expect(rows.golongan_rows[0].target).toBe(10);
  });

  it('tidak mencampur brand sama dari principal berbeda', () => {
    db.prepare("INSERT INTO principals (name) VALUES ('PT B')").run();
    db.prepare("INSERT INTO brands (principal_id, name) VALUES (2, 'Brand X')").run();
    makeSalesDoc(db, { salesman: 'SARI', period: '2026-10', golongan: [{ label: 'Brand X', principal_id: 1, brand_id: 1, target: 10, achievement: 10 }] });
    makeSalesDoc(db, { salesman: 'RUDI', period: '2026-10', golongan: [{ label: 'Brand X', principal_id: 2, brand_id: 2, target: 7, achievement: 7 }] });

    const rows = computeSpvRows(db, 2, '2026-10', '2026-11');
    expect(rows.golongan_rows).toHaveLength(2);
  });

  it('tidak menghitung baris group (total/divisi) agar tidak dobel', () => {
    makeSalesDoc(db, {
      salesman: 'SARI', period: '2026-10',
      golongan: [
        { label: 'TOTAL DIVISI', is_group: true, target: 10, achievement: 12 },
        { label: 'Brand X', brand_id: 1, target: 10, achievement: 12 },
      ],
    });
    const rows = computeSpvRows(db, 2, '2026-10', '2026-11');
    expect(rows.golongan_rows).toHaveLength(1);
    expect(rows.golongan_rows[0].target).toBe(10);
  });

  it('hasil kosong saat tidak ada dokumen Final', () => {
    const rows = computeSpvRows(db, 2, '2026-10', '2026-11');
    expect(rows.golongan_rows).toEqual([]);
    // Kriteria tetap menampilkan semua kriteria aktif (nilai 0), sama seperti dokumen sales.
    expect(rows.criteria_rows).toHaveLength(2);
    expect(rows.criteria_rows.every((c) => c.target_value === 0 && c.achievement_value === 0)).toBe(true);
  });

  it('SPV tanpa anak sales menghasilkan tabel kosong', () => {
    const rows = computeSpvRows(db, 3, '2026-10', '2026-11');
    expect(rows.golongan_rows).toEqual([]);
    expect(rows.criteria_rows).toHaveLength(2);
  });
});
