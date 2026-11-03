const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const { validateUsername, validatePassword } = require('./auth.js');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const DEFAULT_DATABASE_PATH = path.join(__dirname, 'data', 'incentive.sqlite');

function openDatabase(filename = DEFAULT_DATABASE_PATH) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  // Enable foreign keys for this connection
  db.pragma('foreign_keys = ON');
  return db;
}

function migrateDatabase(db) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  // Migrate divisions: add code column if missing
  const divCols = db.prepare('PRAGMA table_info(divisions)').all().map((c) => c.name);
  if (!divCols.includes('code')) {
    db.exec('ALTER TABLE divisions ADD COLUMN code TEXT');
    // Add unique index after column exists
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_divisions_code ON divisions(code)');
  }
  if (!divCols.includes('is_active')) {
    db.exec('ALTER TABLE divisions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    db.exec('UPDATE divisions SET is_active = active');
  }

  // Migrate principals: add code, address, division_id, is_active
  const prinCols = db.prepare('PRAGMA table_info(principals)').all().map((c) => c.name);
  if (!prinCols.includes('code')) db.exec('ALTER TABLE principals ADD COLUMN code TEXT');
  if (!prinCols.includes('address')) db.exec('ALTER TABLE principals ADD COLUMN address TEXT');
  if (!prinCols.includes('division_id')) db.exec('ALTER TABLE principals ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL');
  if (!prinCols.includes('is_active')) {
    db.exec('ALTER TABLE principals ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    db.exec('UPDATE principals SET is_active = active');
  }

  // Migrate brands: add is_active
  const brandCols = db.prepare('PRAGMA table_info(brands)').all().map((c) => c.name);
  if (!brandCols.includes('is_active')) {
    db.exec('ALTER TABLE brands ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    db.exec('UPDATE brands SET is_active = active');
  }

  // Ensure regions table exists (created by schema)
  // Ensure branches table exists (created by schema)

  const golCols = db.prepare('PRAGMA table_info(golongan_rows)').all().map((column) => column.name);
  if (!golCols.includes('label')) db.exec('ALTER TABLE golongan_rows ADD COLUMN label TEXT');

  // Migrate users: add parent_id for hierarchy (BM → SPV → Sales)
  const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!userCols.includes('parent_id')) {
    db.exec('ALTER TABLE users ADD COLUMN parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
  }

  // Migrate incentive_documents: kwitansi JSON (per-document receipt fields)
  const docCols = db.prepare('PRAGMA table_info(incentive_documents)').all().map((c) => c.name);
  if (!docCols.includes('kwitansi')) {
    db.exec('ALTER TABLE incentive_documents ADD COLUMN kwitansi TEXT');
  }

  // Ensure position_criteria table exists (each position has own kriteria set)
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='position_criteria'").get()) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS position_criteria (
        position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        criteria_id INTEGER NOT NULL REFERENCES criteria_definitions(id) ON DELETE CASCADE,
        PRIMARY KEY (position_id, criteria_id)
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_position_criteria_position ON position_criteria(position_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_position_criteria_criteria ON position_criteria(criteria_id)");
  }
}

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

async function verifyPassword(password, encodedHash) {
  return new Promise((resolve, reject) => {
    const [saltHex, keyHex] = encodedHash.split(':');
    if (!saltHex || !keyHex) return reject(new Error('Invalid hash format'));
    const salt = Buffer.from(saltHex, 'hex');
    const key = Buffer.from(keyHex, 'hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(crypto.timingSafeEqual(key, derivedKey));
    });
  });
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  const stmt = db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(tokenHash, userId, expiresAt);
  return { token, expiresAt };
}

function deleteSession(db, token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const stmt = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  stmt.run(tokenHash);
}

async function seedDatabase(db) {
  db.prepare("INSERT OR IGNORE INTO document_formats (name, version, active) VALUES ('Default', '1', 1)").run();
  db.prepare("INSERT OR IGNORE INTO document_formats (name, version, active) VALUES ('Sales', '1', 1)").run();
  db.prepare("INSERT OR IGNORE INTO document_formats (name, version, active) VALUES ('SPV', '1', 1)").run();
  db.prepare("INSERT OR IGNORE INTO document_formats (name, version, active) VALUES ('BM', '1', 1)").run();

  const critCount = db.prepare('SELECT COUNT(*) as count FROM criteria_definitions').get().count;
  if (critCount === 0) {
    const insertCrit = db.prepare('INSERT INTO criteria_definitions (label, target_unit, sort_order) VALUES (?, ?, ?)');
    insertCrit.run('EFFECTIVE CALLS', 'calls', 1);
    insertCrit.run('ITEM / FAKTOR', 'items', 2);
    insertCrit.run('LANGGANAN TRANSAKSI', 'transactions', 3);
    insertCrit.run('TOTAL OMZET', 'Rp', 4);
    insertCrit.run('GOLONGAN PRODUK', 'products', 5);
    insertCrit.run('GOL YG GUGUR KURANG DARI 50%', 'count', 6);
    insertCrit.run('CALL COMPLIANCE', '%', 7);
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    return;
  }

  // Create Super Admin from environment variables
  const username = process.env.SUPERADMIN_USERNAME || 'superadmin';
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password) {
    throw new Error('SUPERADMIN_PASSWORD environment variable is required for initial seeding');
  }
  if (!validateUsername(username) || !validatePassword(password)) {
    throw new Error('SUPERADMIN_USERNAME must be lowercase and SUPERADMIN_PASSWORD must contain at least 6 characters');
  }

  const passwordHash = await hashPassword(password);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, role, created_by, active)
    VALUES (?, ?, 'superadmin', NULL, 1)
  `);
  const info = insertUser.run(username, passwordHash);
  console.log(`Seeded Super Admin user: ${username} (id: ${info.lastInsertRowid})`);

}

module.exports = {
  openDatabase,
  migrateDatabase,
  seedDatabase,
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
};