const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const { validateUsername, validatePassword } = require('./auth.js');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
// File DB default. Set INCENTIVE_DB untuk mengarahkan server dev ke file terpisah.
const DEFAULT_DATABASE_PATH = process.env.INCENTIVE_DB || path.join(__dirname, 'data', 'incentive.sqlite');

function openDatabase(filename = DEFAULT_DATABASE_PATH) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  // Enable foreign keys for this connection
  db.pragma('foreign_keys = ON');
  // WAL + busy timeout agar officer bersamaan tidak SQLITE_BUSY.
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
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
  if (!userCols.includes('sales_code')) {
    db.exec('ALTER TABLE users ADD COLUMN sales_code TEXT');
  }
  if (!userCols.includes('position_id')) {
    db.exec('ALTER TABLE users ADD COLUMN position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL');
  }
  if (!userCols.includes('avatar_key')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_key TEXT');
  }
  if (!userCols.includes('avatar_color')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_color TEXT');
  }

  // Migrate incentive_documents: kwitansi JSON (per-document receipt fields) + wilayah (kota)
  const docCols = db.prepare('PRAGMA table_info(incentive_documents)').all().map((c) => c.name);
  if (!docCols.includes('kwitansi')) {
    db.exec('ALTER TABLE incentive_documents ADD COLUMN kwitansi TEXT');
  }
  if (!docCols.includes('wilayah')) {
    db.exec('ALTER TABLE incentive_documents ADD COLUMN wilayah TEXT');
  }
  if (!docCols.includes('insentif_total')) {
    db.exec('ALTER TABLE incentive_documents ADD COLUMN insentif_total REAL');
  }
  if (!docCols.includes('divisi')) {
    db.exec('ALTER TABLE incentive_documents ADD COLUMN divisi TEXT');
  }

  // Migrasi incentive_documents (SPV): rentang periode + jenis dokumen + relasi ke posisi SPV.
  const spvCols = db.prepare('PRAGMA table_info(incentive_documents)').all().map((c) => c.name);
  if (!spvCols.includes('period_end')) {
    db.exec('ALTER TABLE incentive_documents ADD COLUMN period_end TEXT');
  }
  if (!spvCols.includes('doc_kind')) {
    db.exec("ALTER TABLE incentive_documents ADD COLUMN doc_kind TEXT NOT NULL DEFAULT 'sales'");
  }
  if (!spvCols.includes('position_id')) {
    db.exec('ALTER TABLE incentive_documents ADD COLUMN position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL');
  }

  // Migrate branches: city (kota) for wilayah derivation
  const branchCols = db.prepare('PRAGMA table_info(branches)').all().map((c) => c.name);
  if (!branchCols.includes('city')) {
    db.exec('ALTER TABLE branches ADD COLUMN city TEXT');
  }

  // Migrate positions: add sales_code column
  const posCols = db.prepare('PRAGMA table_info(positions)').all().map((c) => c.name);
  if (!posCols.includes('sales_code')) db.exec('ALTER TABLE positions ADD COLUMN sales_code TEXT');

  // Backfill baris golongan lama (hanya label) -> brand_id + principal_id dari master brands.
  // Agregasi SPV mengelompokkan per brand, jadi baris lama juga butuh id.
  const legacyBrandRows = db.prepare(`
    SELECT id, label FROM golongan_rows
    WHERE brand_id IS NULL AND is_group = 0 AND label IS NOT NULL AND trim(label) <> ''
  `).all();
  if (legacyBrandRows.length) {
    const brandByName = new Map();
    for (const b of db.prepare('SELECT id, principal_id, name FROM brands').all()) {
      const key = (b.name || '').trim().toLowerCase();
      if (key && !brandByName.has(key)) brandByName.set(key, b); // nama sama di 2 principal: ambil yang pertama
    }
    const updateBrand = db.prepare('UPDATE golongan_rows SET brand_id = ?, principal_id = ? WHERE id = ?');
    for (const row of legacyBrandRows) {
      const b = brandByName.get((row.label || '').trim().toLowerCase());
      if (b) updateBrand.run(b.id, b.principal_id, row.id);
    }
  }

  // Unik sales: satu sales satu insentif per periode — hanya dokumen kind='sales'.
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_doc_sales_period_kind'").get()) {
    // Unique parsial hanya bila tidak ada duplikat historis (data lama mungkin dobel).
    const dups = db.prepare(`
      SELECT lower(trim(salesman)) AS n, period FROM incentive_documents
      WHERE doc_kind = 'sales' AND salesman IS NOT NULL AND trim(salesman) <> '' AND period IS NOT NULL
      GROUP BY lower(trim(salesman)), period HAVING COUNT(*) > 1 LIMIT 1
    `).get();
    if (!dups) {
      db.exec(`CREATE UNIQUE INDEX idx_doc_sales_period_kind ON incentive_documents(lower(trim(salesman)), period) WHERE doc_kind = 'sales' AND salesman IS NOT NULL AND trim(salesman) <> ''`);
    }
  }
  db.exec('DROP INDEX IF EXISTS idx_doc_sales_period');

  // Unik SPV: satu SPV satu rentang periode.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_spv_period ON incentive_documents(position_id, period, period_end) WHERE doc_kind = 'spv' AND position_id IS NOT NULL`);

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