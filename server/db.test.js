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