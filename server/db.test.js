import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, migrateDatabase, seedDatabase } from './db.js';

describe('SQLite foundation', () => {
  let db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
  });

  afterEach(() => db.close());

  it('creates required tables and enables foreign keys', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name);
    expect(tables).toEqual(expect.arrayContaining([
      'users', 'sessions', 'divisions', 'principals', 'brands', 'document_formats',
      'criteria_definitions', 'incentive_documents', 'golongan_rows', 'document_criteria_rows', 'audit_logs',
    ]));
  });

  it('backfill brand_id dan principal_id untuk baris golongan lama', () => {
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', 'hash', 'superadmin')").run();
    const ownerId = db.prepare("SELECT id FROM users WHERE username = 'admin'").get().id;
    db.prepare("INSERT INTO principals (name) VALUES ('PT A')").run();
    db.prepare("INSERT INTO brands (principal_id, name) VALUES (1, 'Brand X')").run();
    db.prepare("INSERT INTO incentive_documents (owner_id, period) VALUES (?, '2026-10')").run(ownerId);
    const docId = db.prepare('SELECT id FROM incentive_documents LIMIT 1').get().id;
    db.prepare("INSERT INTO golongan_rows (document_id, label, target, achievement) VALUES (?, 'Brand X', 10, 12)").run(docId);

    migrateDatabase(db); // backfill dijalankan di migrasi

    const row = db.prepare('SELECT brand_id, principal_id FROM golongan_rows').get();
    expect(row.brand_id).toBe(1);
    expect(row.principal_id).toBe(1);
  });

  it('migration is idempotent', () => {
    expect(() => migrateDatabase(db)).not.toThrow();
  });

  it('adds SPV columns to incentive_documents', () => {
    const cols = db.prepare('PRAGMA table_info(incentive_documents)').all().map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['period_end', 'doc_kind', 'position_id']));
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', 'hash', 'superadmin')").run();
    const ownerId = db.prepare("SELECT id FROM users WHERE username = 'admin'").get().id;
    const doc = db.prepare("INSERT INTO incentive_documents (owner_id, period, doc_kind) VALUES (?, '2026-10', 'spv')").run(ownerId);
    const row = db.prepare('SELECT doc_kind, period_end FROM incentive_documents WHERE id = ?').get(doc.lastInsertRowid);
    expect(row.doc_kind).toBe('spv');
    expect(row.period_end).toBeNull();
  });

  it('seeds one Super Admin and the default document format', async () => {
    const previousPassword = process.env.SUPERADMIN_PASSWORD;
    process.env.SUPERADMIN_PASSWORD = 'test-password';
    await seedDatabase(db);
    await seedDatabase(db);
    expect(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'superadmin'").get().count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM document_formats WHERE name = 'Default'").get().count).toBe(1);
    if (previousPassword === undefined) delete process.env.SUPERADMIN_PASSWORD;
    else process.env.SUPERADMIN_PASSWORD = previousPassword;
  });
});