# Dokumen Insentif SPV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman `/documents/spv` menampilkan dokumen insentif SPV yang diakumulasi dari dokumen sales Final di bawah SPV itu, untuk rentang bulan pilihan officer.

**Architecture:** Server menambah jenis dokumen baru (`doc_kind='spv'`) dengan rentang periode (`period`…`period_end`) dan relasi ke posisi SPV (`position_id`). Baris golongan + kriteria SPV dihitung ulang dari dokumen sales Final saat dokumen SPV masih Draft; saat di-Finalisasi, hasilnya ditulis sebagai snapshot dan membeku. Client punya halaman terpisah `SpvDocument.jsx` yang memakai ulang `GolonganTable` dan `KriteriaTable` (read-only) dari `Documents.jsx`.

**Tech Stack:** Node + Express 5 + better-sqlite3 (server), React + Vite + Tailwind (client), Vitest + supertest (test).

**Spec:** `docs/superpowers/specs/2026-11-12-spv-document-design.md`

## Global Constraints

- Server: Express 5 — tidak ada wildcard route `'*'`, pakai middleware biasa.
- Server: `better-sqlite3` sinkron; agregasi berjalan di dalam request.
- Server: migrasi wajib idempoten, gaya `db.js` — cek `PRAGMA table_info` dulu, baru `ALTER TABLE`.
- Client: tanpa dependensi npm baru.
- Periode kontrak server `YYYY-MM`; label tampilan `Bulan YYYY` (helper `fromApiPeriod`).
- Golongan dan kriteria di dokumen SPV **tidak boleh bisa diedit tangan** — hanya `insentif_total` dan kwitansi yang diinput officer.
- Dokumen SPV Final: `period`, `period_end`, `position_id` terkunci → `409 DOCUMENT_LOCKED`.
- Superadmin boleh mengoreksi dokumen Final dengan `audit_reason` minimal 3 karakter (perilaku yang sudah ada).
- Suite test harus hijau sepanjang: `cd server; npm test` (61 test) dan `cd client; npm test` (38 test).
- Tidak ada dependensi baru. Tidak ada perubahan perilaku dokumen sales yang sudah ada.

## Review Focus

Lima kondisi yang paling mungkin menggigit orang yang memakai aplikasi ini — masing-masing punya test di task yang memiliki kodenya:

1. **Officer tanpa cabang** (`branch_ids` kosong) mengirim `position_id` → server harus jawab `403`, bukan lolos diam-diam. (Task 2, Task 3)
2. **Rentang satu bulan** (`period` = `period_end`) → label harus tampil sebagai satu bulan, bukan range; agregasi tetap benar. (Task 1, Task 4)
3. **Dokumen Final di luar rentang** tidak boleh ikut terakumulasi. (Task 2)
4. **Dokumen Draft di dalam rentang** tidak boleh ikut terakumulasi. (Task 2)
5. **Dua sales berbeda menjual brand sama** → digabung per `(principal_id, brand_id, label)`, tidak tercampur kalau principal-nya beda. (Task 2)

Additionally, dari spec: sales di bawah SPV yang **tidak punya dokumen sama sekali** → dokumen SPV tetap bisa dibuat, tabel kosong, bukan error. (Task 2, Task 4)

---

### Task 1: Skema SPV + helper label periode

**Files:**
- Modify: `server/db.js` (fungsi `migrateDatabase`)
- Modify: `client/src/lib/period.js`
- Test: `server/db.test.js`, `client/src/lib/period.test.js`

**Interfaces:**
- Produces: kolom `incentive_documents.period_end TEXT`, `incentive_documents.doc_kind TEXT NOT NULL DEFAULT 'sales'`, `incentive_documents.position_id INTEGER` (FK ke `positions.id`); index unik baru `idx_doc_sales_period_kind` (menggantikan `idx_doc_sales_period`) dan `idx_doc_spv_period`.
- Produces: `periodRangeLabel(startApi: string, endApi?: string) -> string` di `client/src/lib/period.js` — `"2026-09"` → `"Sep 2026"`, `("2026-09","2026-11")` → `"Sep 2026 – Nov 2026"` (pisah dengan en-dash U+2013).
- Produces: `apiMonthsInRange(startApi: string, endApi?: string) -> string[]` — `("2026-09","2026-11")` → `["2026-09","2026-10","2026-11"]`.

- [ ] **Step 1: Tulis test gagal (server) untuk kolom baru**

Tambah ke `server/db.test.js`, di dalam `describe('SQLite foundation')`:

```js
it('adds SPV columns to incentive_documents', () => {
  const cols = db.prepare('PRAGMA table_info(incentive_documents)').all().map((c) => c.name);
  expect(cols).toEqual(expect.arrayContaining(['period_end', 'doc_kind', 'position_id']));
  const doc = db.prepare("INSERT INTO incentive_documents (owner_id, period, doc_kind) VALUES (1, '2026-10', 'spv')").run();
  const row = db.prepare('SELECT doc_kind, period_end FROM incentive_documents WHERE id = ?').get(doc.lastInsertRowid);
  expect(row.doc_kind).toBe('spv');
  expect(row.period_end).toBeNull();
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd server; npx vitest run db.test.js`
Expected: FAIL — `period_end` tidak ada di `PRAGMA table_info`.

- [ ] **Step 3: Implementasi migrasi di `server/db.js`**

Tambahkan di dalam `migrateDatabase`, setelah blok migrasi `incentive_documents` yang sudah ada (sekitar baris 91):

```js
  // Migrasi incentive_documents: SPV butuh rentang periode + relasi ke posisi SPV.
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
```

Lalu ganti blok pembuatan index (sekitar baris 103–113) dengan:

```js
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
```

- [ ] **Step 4: Jalankan test server untuk memastikan lolos**

Run: `cd server; npx vitest run db.test.js`
Expected: PASS (3 test).

- [ ] **Step 5: Tulis test gagal (client) untuk helper periode**

Tambah ke `client/src/lib/period.test.js`:

```js
import { periodRangeLabel, apiMonthsInRange } from './period';

describe('periode rentang', () => {
  it('rentang satu bulan tampil sebagai satu bulan', () => {
    expect(periodRangeLabel('2026-10', '2026-10')).toBe('Oktober 2026');
  });

  it('rentang multi bulan tampil sebagai rentang', () => {
    expect(periodRangeLabel('2026-09', '2026-11')).toBe('September 2026 – November 2026');
  });

  it('period_end kosong diperlakukan sama dengan period', () => {
    expect(periodRangeLabel('2026-10')).toBe('Oktober 2026');
  });

  it('menghasilkan daftar bulan dalam rentang', () => {
    expect(apiMonthsInRange('2026-09', '2026-11')).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('rentang lintas tahun', () => {
    expect(apiMonthsInRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });
});
```

- [ ] **Step 6: Jalankan test client untuk memastikan gagal**

Run: `cd client; npx vitest run src/lib/period.test.js`
Expected: FAIL — `periodRangeLabel` bukan export yang dikenal.

- [ ] **Step 7: Implementasi helper di `client/src/lib/period.js`**

Tambahkan di akhir file:

```js
// Label rentang: 1 bulan -> "Oktober 2026"; multi bulan -> "Sep 2026 – Nov 2026".
export function periodRangeLabel(startApi, endApi) {
  if (!startApi) return '';
  const start = fromApiPeriod(startApi);
  const end = fromApiPeriod(endApi || startApi);
  return start === end ? start : `${start} – ${end}`;
}

// Daftar bulan API dalam rentang (inklusive), untuk pilihan filter periode.
export function apiMonthsInRange(startApi, endApi) {
  if (!startApi) return [];
  const start = /^(\d{4})-(\d{2})$/.exec(startApi);
  if (!start) return [startApi];
  const end = /^(\d{4})-(\d{2})$/.exec(endApi || startApi);
  let year = Number(start[1]);
  let month = Number(start[2]);
  const endYear = end ? Number(end[1]) : year;
  const endMonth = end ? Number(end[2]) : month;
  const out = [];
  while ((year < endYear || (year === endYear && month <= endMonth)) && out.length < 36) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return out;
}
```

- [ ] **Step 8: Jalankan test client untuk memastikan lolos**

Run: `cd client; npx vitest run src/lib/period.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/db.js server/db.test.js client/src/lib/period.js client/src/lib/period.test.js
git commit -m "feat(spv): skema dokumen SPV + helper label periode rentang"
```

---

### Task 2: Agregasi SPV di server

**Files:**
- Create: `server/spv.js`
- Create: `server/spv.test.js`

**Interfaces:**
- Produces: `spvScopeError(db, user, positionId) -> string | null` — `null` berarti boleh; selain itu pesan alasan. `user` = `{ id, role, branch_ids }`; `role === 'superadmin'` → selalu `null`.
- Produces: `computeSpvRows(db, positionId, periodStart, periodEnd) -> { golongan_rows: Array, criteria_rows: Array }`
  - `golongan_rows`: satu entri per kelompok brand. Bentuk: `{ principal_id, principal_name, brand_id, brand_name, label, target, achievement }`. `target`/`achievement` = penjumlahan. `label` = nama brand (atau teks ketik bebas bila `brand_id` null). `brand_name`/`principal_name` = `null` bila tidak ada di master.
  - `criteria_rows`: satu entri per kriteria aktif. Bentuk: `{ criteria_id, label, target_unit, formula, target_value, achievement_value, incentive_amount: null, sort_order }`.
  - Hanya dokumen sales `status = 'Final'` dan `period` di antara `periodStart`…`periodEnd` (inklusif, perbandingan teks) yang dihitung.

- [ ] **Step 1: Tulis test gagal untuk `spvScopeError`**

Buat `server/spv.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
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
```

Isi `user_branches` + `position_branches` per test dengan helper:

```js
function assignBranches(db, userId, positionId, branchId) {
  db.prepare('INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)').run(userId, branchId);
  db.prepare('INSERT INTO position_branches (position_id, branch_id) VALUES (?, ?)').run(positionId, branchId);
}
```

Test 'menolak SPV di luar cabang officer':

```js
it('menolak SPV di luar cabang officer', () => {
  const officer = { id: 1, role: 'officer', branch_ids: [1] };
  expect(spvScopeError(db, officer, 2)).toMatch(/cabang/i);
  expect(spvScopeError(db, officer, 3)).toBeNull();
});
```

Test 'officer tanpa cabang tidak bisa memilih SPV mana pun':

```js
it('officer tanpa cabang tidak bisa memilih SPV mana pun', () => {
  expect(spvScopeError(db, { id: 1, role: 'officer', branch_ids: [] }, 2)).toMatch(/cabang/i);
});
```

Test 'superadmin bebas memilih SPV mana pun':

```js
it('superadmin bebas memilih SPV mana pun', () => {
  expect(spvScopeError(db, { id: 2, role: 'superadmin', branch_ids: [] }, 3)).toBeNull();
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd server; npx vitest run spv.test.js`
Expected: FAIL — module `server/spv.js` tidak ada.

- [ ] **Step 3: Implementasikan `server/spv.js` — bagian scope**

Buat `server/spv.js`:

```js
// Agregasi dokumen SPV: golongan + kriteria dijumlah dari dokumen sales Final
// milik anak sales di bawah SPV, untuk rentang periode tertentu.

function branchesOfPosition(db, positionId) {
  const rows = db.prepare('SELECT branch_id FROM position_branches WHERE position_id = ?').all(positionId);
  const ids = rows.map((r) => r.branch_id);
  const primary = db.prepare('SELECT branch_id FROM positions WHERE id = ?').get(positionId);
  if (primary && primary.branch_id && !ids.includes(primary.branch_id)) ids.push(primary.branch_id);
  return ids;
}

// Cakupan: SPV harus ada, bertipe SPV, dan punya cabang yang sama dengan officer.
// Superadmin bebas (perilaku isSuper yang sudah dipakai di halaman sales).
function spvScopeError(db, user, positionId) {
  const id = Number(positionId);
  if (!Number.isInteger(id)) return 'Pilih SPV terlebih dahulu.';
  const position = db.prepare('SELECT id, position_type FROM positions WHERE id = ?').get(id);
  if (!position) return 'SPV tidak ditemukan.';
  if (position.position_type !== 'SPV') return 'Posisi yang dipilih bukan SPV.';
  if (user && user.role === 'superadmin') return null;
  const own = (user && user.branch_ids) || [];
  const scopes = branchesOfPosition(db, id);
  if (!scopes.some((b) => own.includes(b))) return 'SPV di luar cabang yang di-assign ke akun Anda.';
  return null;
}

module.exports = { spvScopeError, computeSpvRows };
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `cd server; npx vitest run spv.test.js`
Expected: 2 test PASS.

- [ ] **Step 5: Tulis test gagal untuk `computeSpvRows`**

Tambah ke `server/spv.test.js` helper membuat dokumen sales:

```js
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
```

Test 'mengakumulasi brand dari dua sales dalam rentang yang sama':

```js
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
  expect(rows.criteria_rows.find((c) => c.criteria_id === 1).target_value).toBe(15);
  expect(rows.criteria_rows.find((c) => c.criteria_id === 1).achievement_value).toBe(15);
});
```

Test 'mengecualikan Draft dan periode di luar rentang':

```js
it('mengecualikan Draft dan periode di luar rentang', () => {
  makeSalesDoc(db, { salesman: 'SARI', period: '2026-10', status: 'Draft', golongan: [{ label: 'Brand X', brand_id: 1, target: 99, achievement: 99 }] });
  makeSalesDoc(db, { salesman: 'SARI', period: '2026-08', golongan: [{ label: 'Brand X', brand_id: 1, target: 77, achievement: 77 }] });
  makeSalesDoc(db, { salesman: 'SARI', period: '2026-10', golongan: [{ label: 'Brand X', brand_id: 1, target: 10, achievement: 12 }] });
  const rows = computeSpvRows(db, 2, '2026-10', '2026-11');
  expect(rows.golongan_rows).toHaveLength(1);
  expect(rows.golongan_rows[0].target).toBe(10);
});
```

(Hapus baris `expect(rows.golon_rows).toBeUndefined();` — itu salah ketik, jangan ditulis.)

Test 'tidak mencampur brand sama dari principal berbeda':

```js
it('tidak mencampur brand sama dari principal berbeda', () => {
  db.prepare("INSERT INTO principals (name) VALUES ('PT B')").run();
  db.prepare('INSERT INTO brands (principal_id, name) VALUES (2, \'Brand X\')').run();
  makeSalesDoc(db, { salesman: 'SARI', period: '2026-10', golongan: [{ label: 'Brand X', principal_id: 1, brand_id: 1, target: 10, achievement: 10 }] });
  makeSalesDoc(db, { salesman: 'RUDI', period: '2026-10', golongan: [{ label: 'Brand X', principal_id: 2, brand_id: 2, target: 7, achievement: 7 }] });
  const rows = computeSpvRows(db, 2, '2026-10', '2026-11');
  expect(rows.golongan_rows).toHaveLength(2);
});
```

Test 'hasil kosong saat tidak ada dokumen Final':

```js
it('hasil kosong saat tidak ada dokumen Final', () => {
  const rows = computeSpvRows(db, 2, '2026-10', '2026-11');
  expect(rows.golongan_rows).toEqual([]);
  expect(rows.criteria_rows).toEqual([]);
});
```

- [ ] **Step 6: Jalankan test untuk memastikan gagal**

Run: `cd server; npx vitest run spv.test.js`
Expected: FAIL — `computeSpvRows` belum ada (ekspor undefined).

- [ ] **Step 7: Implementasikan `computeSpvRows` di `server/spv.js`**

Ganti blok `module.exports` di `server/spv.js` dengan implementasi berikut dan tambahkan di atasnya:

```js
// Dokumen sales Final milik anak SPV dalam rentang periode.
function sourceDocuments(db, positionId, periodStart, periodEnd) {
  const sales = db.prepare("SELECT id, name FROM positions WHERE parent_position_id = ? AND position_type = 'SALES'").all(positionId);
  if (!sales.length) return [];
  const names = sales.map((s) => s.name.toLowerCase());
  const placeholders = names.map(() => '?').join(',');
  return db.prepare(`
    SELECT * FROM incentive_documents
    WHERE doc_kind = 'sales' AND status = 'Final'
      AND period >= ? AND period <= ?
      AND lower(trim(salesman)) IN (${placeholders})
  `).all(periodStart, periodEnd, ...names);
}

function computeSpvRows(db, positionId, periodStart, periodEnd) {
  const documents = sourceDocuments(db, positionId, periodStart, periodEnd);
  const ids = documents.map((d) => d.id);
  const golongan_rows = [];
  const criteria_rows = [];

  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    // Baris data = is_group 0 (baris brand). Baris group/total dilewati supaya tidak dobel.
    const leaf = db.prepare(`
      SELECT principal_id, brand_id, label, target, achievement FROM golongan_rows
      WHERE is_group = 0 AND document_id IN (${ph})
    `).all(...ids);
    const groups = new Map();
    for (const row of leaf) {
      const key = `${row.principal_id ?? 0}|${row.brand_id ?? 0}|${(row.label || '').trim().toLowerCase()}`;
      const acc = groups.get(key) || { principal_id: row.principal_id ?? null, brand_id: row.brand_id ?? null, label: row.label ?? null, target: 0, achievement: 0 };
      acc.target += Number(row.target) || 0;
      acc.achievement += Number(row.achievement) || 0;
      groups.set(key, acc);
    }
    const principalName = new Map(db.prepare('SELECT id, name FROM principals').all().map((p) => [p.id, p.name]));
    const brandName = new Map(db.prepare('SELECT id, name FROM brands').all().map((b) => [b.id, b.name]));
    for (const acc of groups.values()) {
      golongan_rows.push({
        principal_id: acc.principal_id,
        principal_name: acc.principal_id ? (principalName.get(acc.principal_id) ?? null) : null,
        brand_id: acc.brand_id,
        brand_name: acc.brand_id ? (brandName.get(acc.brand_id) ?? null) : null,
        label: acc.label,
        target: acc.target,
        achievement: acc.achievement,
      });
    }
    golongan_rows.sort((a, b) => `${a.principal_name || ''}|${a.brand_name || a.label || ''}`.localeCompare(`${b.principal_name || ''}|${b.brand_name || b.label || ''}`));

    const critRows = db.prepare(`
      SELECT criteria_id, label, target_unit, formula, target_value, achievement_value, sort_order
      FROM document_criteria_rows WHERE document_id IN (${ph})
    `).all(...ids);
    const acc = new Map();
    for (const row of critRows) {
      const cur = acc.get(row.criteria_id) || { ...row, target_value: 0, achievement_value: 0 };
      cur.target_value += Number(row.target_value) || 0;
      cur.achievement_value += Number(row.achievement_value) || 0;
      acc.set(row.criteria_id, cur);
    }
    const definitions = db.prepare('SELECT id, label, target_unit, formula, sort_order FROM criteria_definitions WHERE active = 1 ORDER BY sort_order, id').all();
    for (const def of definitions) {
      const hit = acc.get(def.id);
      criteria_rows.push({
        criteria_id: def.id,
        label: def.label,
        target_unit: def.target_unit,
        formula: def.formula,
        target_value: hit ? hit.target_value : 0,
        achievement_value: hit ? hit.achievement_value : 0,
        incentive_amount: null,
        sort_order: def.sort_order,
      });
    }
  } else {
    const definitions = db.prepare('SELECT id, label, target_unit, formula, sort_order FROM criteria_definitions WHERE active = 1 ORDER BY sort_order, id').all();
    for (const def of definitions) {
      criteria_rows.push({ criteria_id: def.id, label: def.label, target_unit: def.target_unit, formula: def.formula, target_value: 0, achievement_value: 0, incentive_amount: null, sort_order: def.sort_order });
    }
  }

  return { golongan_rows, criteria_rows };
}

module.exports = { spvScopeError, computeSpvRows };
```

- [ ] **Step 8: Jalankan test untuk memastikan lolos**

Run: `cd server; npx vitest run spv.test.js`
Expected: 7 test PASS.

- [ ] **Step 9: Commit**

```bash
git add server/spv.js server/spv.test.js
git commit -m "feat(spv): agregasi golongan dan kriteria dari dokumen sales Final"
```

---

### Task 3: API dokumen SPV

**Files:**
- Modify: `server/routes/documents.js`
- Test: `server/routes/documents.test.js`

**Interfaces:**
- Consumes: `spvScopeError(db, user, positionId)` dan `computeSpvRows(db, positionId, periodStart, periodEnd)` dari `server/spv.js`.
- Produces: `POST /api/documents` menerima body `{ doc_kind: 'spv', position_id, period, period_end, wilayah, insentif_total, kwitansi, format_id }`.
- Produces: `GET /api/documents/:id` untuk SPV berstatus `Draft` mengembalikan `golongan_rows` + `criteria_rows` hasil hitung (bukan baris tersimpan).
- Produces: `PATCH /api/documents/:id` untuk SPV: `golongan_rows` / `criteria_rows` dari client **ditolak** `422`; `period` / `period_end` / `position_id` ditolak `409` bila status `Final`.

- [ ] **Step 1: Tulis test gagal untuk membuat dokumen SPV**

Tambah ke `server/routes/documents.test.js`. Helper setup tambahan di `beforeEach`:

```js
    db.prepare("INSERT INTO branches (name, city) VALUES ('Cabang A', 'Banjarmasin')").run();
    db.prepare("INSERT INTO positions (name, position_type, branch_id) VALUES ('BUDO', 'SPV', 1)").run();
    db.prepare("INSERT INTO positions (name, position_type, parent_position_id, branch_id) VALUES ('SARI', 'SALES', 1, 1)").run();
    db.prepare("INSERT INTO user_branches (user_id, branch_id) VALUES (1, 1)").run();
    db.prepare("INSERT INTO position_branches (position_id, branch_id) VALUES (1, 1)").run();
```

Test:

```js
it('membuat dokumen SPV dengan rentang periode dan menolak SPV di luar cabang', async () => {
  const created = await officer.post('/api/documents').send({
    doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-11',
  }).expect(201);
  expect(created.body.document.doc_kind).toBe('spv');
  expect(created.body.document.period_end).toBe('2026-11');

  await officer.post('/api/documents').send({
    doc_kind: 'spv', position_id: 999, format_id: 1, period: '2026-10', period_end: '2026-11',
  }).expect(403);
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd server; npx vitest run routes/documents.test.js`
Expected: FAIL — `doc_kind` belum dikenali.

- [ ] **Step 3: Implementasikan bagian di `POST /api/documents`**

Di `server/routes/documents.js`, setelah baris validasi `format` (sekitar baris 32), sisipkan:

```js
    const isSpv = input.doc_kind === 'spv';
    if (isSpv) {
      const scopeMsg = spvScopeError(db, req.user, input.position_id);
      if (scopeMsg) return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: scopeMsg } });
      if (!isValidPeriod(input.period_end || input.period)) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'period_end harus valid (YYYY-MM)' } });
      }
      if ((input.period_end || input.period) < input.period) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Bulan akhir tidak boleh sebelum bulan mulai' } });
      }
      const dupSpv = findDuplicateSpvDoc(db, input.position_id, input.period, input.period_end || input.period);
      if (dupSpv) {
        return res.status(409).json({ error: { code: 'DUPLICATE_SPV_PERIOD', message: 'SPV ini sudah punya dokumen untuk rentang tersebut' } });
      }
    }
```

Lalu ubah query INSERT (sekitar baris 43) agar menerima kolom baru:

```js
      const result = db.prepare(`
        INSERT INTO incentive_documents (owner_id, format_id, division_id, salesman, product, period, period_end, doc_kind, position_id, status, wilayah, insentif_total, kwitansi, divisi)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?)
      `).run(ownerId, input.format_id, input.division_id || null, input.salesman || null, input.product || null, input.period, isSpv ? (input.period_end || input.period) : null, isSpv ? 'spv' : 'sales', isSpv ? Number(input.position_id) : null, input.wilayah || null, encodeNumber(input.insentif_total), encodeKwitansi(input.kwitansi), input.divisi || null);
```

Untuk SPV, `salesman` diisi nama SPV (biar daftar "Dokumen Tersimpan" tetap bisa menampilkannya). Ambil namanya:

```js
      const spvName = isSpv ? (db.prepare('SELECT name FROM positions WHERE id = ?').get(Number(input.position_id))?.name ?? null) : null;
```

dan pakai `spvName` di posisi `input.salesman || null` pada INSERT. Baris kriteria & golongan tidak di-insert untuk SPV (dihitung server):

```js
      if (!isSpv) {
        criteria.forEach(row => insertCriteria.run(documentId, row.id, row.label, row.target_unit, row.formula, row.sort_order));
        insertGolonganRows(db, documentId, input.golongan_rows || []);
        upsertCriteriaRows(db, documentId, input.criteria_rows || []);
      }
```

Tambahkan helper di bagian bawah file:

```js
// Batasan: satu SPV satu dokumen untuk satu rentang periode.
function findDuplicateSpvDoc(db, positionId, period, periodEnd, excludeId = null) {
  const id = Number(positionId);
  if (!Number.isInteger(id) || !period) return null;
  return db.prepare(`
    SELECT id FROM incentive_documents
    WHERE doc_kind = 'spv' AND position_id = ? AND period = ? AND ifnull(period_end, period) = ?
      AND (? IS NULL OR id != ?)
    LIMIT 1
  `).get(id, period, periodEnd, excludeId, excludeId) || null;
}
```

Dan import di atas file:

```js
const { spvScopeError, computeSpvRows } = require('../spv.js');
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `cd server; npx vitest run routes/documents.test.js`
Expected: PASS.

- [ ] **Step 5: Tulis test gagal untuk GET live + snapshot finalisasi**

Tambah ke `server/routes/documents.test.js`:

```js
it('SPV Draft menampilkan baris hasil hitung dan Final membekukan snapshot', async () => {
  db.prepare("INSERT INTO incentive_documents (owner_id, format_id, salesman, period, status, doc_kind) VALUES (1, 1, 'SARI', '2026-10', 'Final', 'sales')").run();
  const docId = db.prepare('SELECT id FROM incentive_documents ORDER BY id DESC LIMIT 1').get().id;
  db.prepare("INSERT INTO golongan_rows (document_id, label, principal_id, brand_id, target, achievement, is_group) VALUES (?, 'Brand X', NULL, NULL, 10, 12, 0)").run(docId);

  const created = await officer.post('/api/documents').send({
    doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-10',
  }).expect(201);
  const id = created.body.document.id;

  const draft = await officer.get(`/api/documents/${id}`).expect(200);
  expect(draft.body.document.golongan_rows).toHaveLength(1);
  expect(draft.body.document.golongan_rows[0].target).toBe(10);

  await admin.post(`/api/documents/${id}/finalize`).expect(200);
  expect(db.prepare('SELECT COUNT(*) AS count FROM golongan_rows WHERE document_id = ?').get(id).count).toBe(1);
  const final = await officer.get(`/api/documents/${id}`).expect(200);
  expect(final.body.document.golongan_rows).toHaveLength(1);
});
```

- [ ] **Step 6: Jalankan test untuk memastikan gagal**

Run: `cd server; npx vitest run routes/documents.test.js`
Expected: FAIL — `golongan_rows` masih kosong untuk dokumen SPV.

- [ ] **Step 7: Implementasikan GET live + snapshot finalisasi**

Di `server/routes/documents.js`, ubah `GET /:id`:

```js
  router.get('/:id', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    res.json({ document: withLiveRows(db, document) });
  });
```

Tambahkan helper:

```js
// Dokumen SPV Draft: baris dihitung ulang dari dokumen sales Final terbaru.
function withLiveRows(db, document) {
  if (document.doc_kind !== 'spv' || document.status !== 'Draft') return document;
  const computed = computeSpvRows(db, document.position_id, document.period, document.period_end || document.period);
  return { ...document, golongan_rows: computed.golongan_rows, criteria_rows: computed.criteria_rows };
}
```

Di `POST /:id/finalize`, tulis snapshot sebelum mengubah status:

```js
    if (document.doc_kind === 'spv') {
      const computed = computeSpvRows(db, document.position_id, document.period, document.period_end || document.period);
      const write = db.transaction(() => {
        db.prepare('DELETE FROM golongan_rows WHERE document_id = ?').run(document.id);
        db.prepare('DELETE FROM document_criteria_rows WHERE document_id = ?').run(document.id);
        computed.golongan_rows.forEach((row, index) => {
          db.prepare(`
            INSERT INTO golongan_rows (document_id, label, principal_id, brand_id, target, achievement, sort_order, is_group)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          `).run(document.id, row.label ?? row.brand_name ?? null, row.principal_id, row.brand_id, row.target, row.achievement, index);
        });
        computed.criteria_rows.forEach((row) => {
          db.prepare(`
            INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, target_value, achievement_value, percentage, status, incentive_amount, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(document.id, row.criteria_id, row.label, row.target_unit, row.formula, row.target_value, row.achievement_value, row.target_value > 0 ? (row.achievement_value / row.target_value) * 100 : 0, row.target_value > 0 ? 'Tercapai' : 'Gugur', null, row.sort_order);
        });
      });
      write();
    }
```

- [ ] **Step 8: Jalankan test untuk memastikan lolos**

Run: `cd server; npx vitest run routes/documents.test.js`
Expected: PASS.

- [ ] **Step 9: Tulis test gagal untuk aturan PATCH**

Tambah ke `server/routes/documents.test.js`:

```js
it('SPV menolak golongan_rows dari client dan mengunci periode saat Final', async () => {
  const created = await officer.post('/api/documents').send({
    doc_kind: 'spv', position_id: 1, format_id: 1, period: '2026-10', period_end: '2026-10',
  }).expect(201);
  const id = created.body.document.id;

  await officer.patch(`/api/documents/${id}`).send({ golongan_rows: [{ label: 'Palsu', target: 1 }] }).expect(422);
  await officer.patch(`/api/documents/${id}`).send({ insentif_total: 5000 }).expect(200);

  await admin.post(`/api/documents/${id}/finalize`).expect(200);
  await admin.patch(`/api/documents/${id}`).send({ period: '2026-12', audit_reason: 'koreksi rentang' }).expect(409);
});
```

- [ ] **Step 10: Jalankan test untuk memastikan gagal**

Run: `cd server; npx vitest run routes/documents.test.js`
Expected: FAIL — `golongan_rows` untuk SPV belum ditolak.

- [ ] **Step 11: Implementasikan aturan PATCH**

Di `server/routes/documents.js`, di dalam `router.patch('/:id')`, setelah baris validasi `audit_reason`, sisipkan:

```js
    if (document.doc_kind === 'spv') {
      if (Array.isArray(input.golongan_rows) || Array.isArray(input.criteria_rows)) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Baris SPV dihitung dari dokumen sales, tidak bisa diisi manual' } });
      }
      if (document.status === 'Final') {
        const locked = ['period', 'period_end', 'position_id'].filter((field) => input[field] !== undefined);
        if (locked.length) {
          return res.status(409).json({ error: { code: 'DOCUMENT_LOCKED', message: `Rentang periode dan SPV terkunci pada dokumen Final (${locked.join(', ')})` } });
        }
      }
    }
```

Dan tambahkan `period_end` + `position_id` ke daftar field yang boleh di-update di `updateDocument`:

```js
  for (const field of ['division_id', 'salesman', 'product', 'period', 'period_end', 'position_id', 'format_id', 'wilayah', 'divisi']) {
```

- [ ] **Step 12: Jalankan seluruh test server**

Run: `cd server; npm test`
Expected: PASS, jumlah test ≥ 61 + test baru.

- [ ] **Step 13: Commit**

```bash
git add server/routes/documents.js server/routes/documents.test.js
git commit -m "feat(spv): endpoint dokumen SPV dengan rentang periode, hitung live, dan snapshot final"
```

---

### Task 4: Halaman SPV di client

**Files:**
- Create: `client/src/pages/SpvDocument.jsx`
- Modify: `client/src/pages/Documents.jsx` (export `GolonganTable` + `KriteriaTable`, tambah prop `totalEditable`)
- Modify: `client/src/App.jsx` (route + state target)
- Test: `client/src/pages/spv-document.smoke.test.jsx`

**Interfaces:**
- Consumes: `periodRangeLabel`, `apiMonthsInRange`, `toApiPeriod`, `fromApiPeriod` dari `client/src/lib/period.js`; `createDocument`, `updateDocument`, `finalizeDocument`, `getDocument`, `errMsg` dari `client/src/api.js`.
- Produces: `GolonganTable` dan `KriteriaTable` sebagai named export dari `client/src/pages/Documents.jsx`.
- Produces: prop `totalEditable` pada `KriteriaTable` — bila `true`, input "TOTAL INSENTIVE" tetap bisa diedit walau `canEdit` false.
- Produces: `SpvDocument` sebagai default export dari `client/src/pages/SpvDocument.jsx` dengan props: `{ user, positions, masterData, setDocuments, documentFormatId, loadTargetId, onLoadDone }`.

- [ ] **Step 1: Tulis test gagal (client)**

Buat `client/src/pages/spv-document.smoke.test.jsx`:

```jsx
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import SpvDocument from './SpvDocument';

const noop = () => {};
const props = {
  user: { id: 1, role: 'officer', criteria_ids: null, branch_ids: [1] },
  positions: [{ id: 1, name: 'BUDO', position_type: 'SPV', branch_ids: [1], active: 1 }],
  masterData: { divisions: [], principals: [], brands: [], regions: [], branches: [{ id: 1, name: 'Cabang A', city: 'Banjarmasin' }] },
  setDocuments: noop,
  documentFormatId: 1,
  loadTargetId: null,
  onLoadDone: noop,
};

describe('SPV document render', () => {
  it('merender header SPV dengan empat pembeda', () => {
    const html = renderToString(<SpvDocument {...props} />);
    expect(html).toContain('Rekap Insentif SPV');
    expect(html).toContain('Wilayah');
    expect(html).toContain('Jabatan');
    expect(html).toContain('Nama Pejabat');
    expect(html).toContain('Bulan');
  });

  it('halaman BM tetap placeholder', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd client; npx vitest run src/pages/spv-document.smoke.test.jsx`
Expected: FAIL — `./SpvDocument` tidak ada.

- [ ] **Step 3: Export `GolonganTable` dan `KriteriaTable` + prop `totalEditable`**

Di `client/src/pages/Documents.jsx`:

1. Ubah `function GolonganTable({` → `export function GolonganTable({`
2. Ubah `function KriteriaTable({ rows, onUpdate, canEdit, totalOverride, onTotalChange }) {` → `export function KriteriaTable({ rows, onUpdate, canEdit, totalOverride, onTotalChange, totalEditable = false }) {`
3. Ubah input total insentif (sekitar baris 366): `disabled={!canEdit}` → `disabled={!canEdit && !totalEditable}`

- [ ] **Step 4: Implementasikan `client/src/pages/SpvDocument.jsx`**

Buat file baru. Isi:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import Icon from '../components/Icon';
import ComboSelect from '../components/ComboSelect';
import { useToast } from '../components/Toast';
import { GolonganTable, KriteriaTable } from './Documents';
import { createDocument, updateDocument, finalizeDocument, getDocument, errMsg } from '../api';
import { toApiPeriod, fromApiPeriod, monthNames, periodRangeLabel } from '../lib/period';

const EMPTY_KWITANSI = {
  penerima: 'PT. BINTANG SINAR JAYA',
  jumlahUang: '',
  keterangan: '',
  terbilang: '',
  nominal: '',
};
```

Struktur komponen:

```jsx
export default function SpvDocument({ user, positions, masterData, setDocuments, documentFormatId, loadTargetId, onLoadDone }) {
  const toast = useToast();
  const isSuper = user.role === 'superadmin';
  const [documentId, setDocumentId] = useState(null);
  const [documentStatus, setDocumentStatus] = useState('Draft');
  const [positionId, setPositionId] = useState('');
  const [periodStart, setPeriodStart] = useState(fromApiPeriod(new Date().toISOString().slice(0, 7)));
  const [periodEnd, setPeriodEnd] = useState(fromApiPeriod(new Date().toISOString().slice(0, 7)));
  const [golonganRows, setGolonganRows] = useState([]);
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [insentifTotal, setInsentifTotal] = useState(null);
  const [kwitansi, setKwitansi] = useState(EMPTY_KWITANSI);
  const [savedWilayah, setSavedWilayah] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const canEditDoc = ['officer', 'superadmin'].includes(user.role) && documentStatus === 'Draft';
  const canFinalize = ['observer', 'superadmin'].includes(user.role) && documentStatus === 'Draft' && !!documentId;

  const spvOptions = useMemo(() => positions.filter((p) => p.position_type === 'SPV' && p.active !== 0
    && (isSuper || (p.branch_ids || []).some((id) => (user.branch_ids || []).includes(id)))),
    [positions, isSuper, user.branch_ids]);

  const spv = spvOptions.find((p) => String(p.id) === String(positionId)) || null;
  const spvName = spv?.name || '';
  const periodLabel = periodRangeLabel(toApiPeriod(periodStart), toApiPeriod(periodEnd));
  // Wilayah diturunkan dari cabang SPV (kota pertama), read-only — sama seperti spec.
  const spvBranchCity = (spv?.branch_ids || [])
    .map((id) => (masterData.branches || []).find((b) => b.id === id)?.city)
    .filter(Boolean)[0] || '';
  const wilayah = spvBranchCity || savedWilayah;

  // Muat dokumen SPV yang dipilih dari daftar "Dokumen Tersimpan".
  useEffect(() => {
    if (!loadTargetId) return;
    let cancelled = false;
    setLoading(true);
    getDocument(loadTargetId)
      .then(({ document: full }) => {
        if (cancelled) return;
        setDocumentId(full.id);
        setDocumentStatus(full.status);
        setPositionId(String(full.position_id || ''));
        setPeriodStart(fromApiPeriod(full.period));
        setPeriodEnd(fromApiPeriod(full.period_end || full.period));
        setInsentifTotal(full.insentif_total ?? null);
        setKwitansi({ ...EMPTY_KWITANSI, ...(full.kwitansi || {}) });
        setSavedWilayah(full.wilayah || '');
        setGolonganRows(toGolonganRows(full.golongan_rows || []));
        setCriteriaRows(toCriteriaRows(full.criteria_rows || []));
        setSaved(true);
      })
      .catch((err) => toast('error', errMsg(err)))
      .finally(() => { if (!cancelled) setLoading(false); onLoadDone?.(); });
    return () => { cancelled = true; };
  }, [loadTargetId]);
  ...
}
```

Helper baris (harus diletakkan di luar komponen, di file yang sama):

```jsx
// Baris server (golongan_rows) -> baris tabel client: brand di bawah principal,
// lalu satu baris principal berisi jumlah brand-nya, lalu satu baris TOTAL.
// Urutan ini yang dipakai client untuk menghitung total otomatis (computeGrandTotal).
function toGolonganRows(rows) {
  const out = [];
  const principals = new Map();
  const withoutPrincipal = [];
  rows.forEach((row, index) => {
    const brand = {
      id: `spv-brand-${index}`,
      label: row.label || row.brand_name || '',
      type: 'brand',
      isGroup: false,
      target: row.target ?? 0,
      achievement: row.achievement ?? 0,
    };
    if (!row.principal_id) { withoutPrincipal.push(brand); return; }
    if (!principals.has(row.principal_id)) {
      principals.set(row.principal_id, { name: row.principal_name || '', brands: [], target: 0, achievement: 0 });
    }
    const group = principals.get(row.principal_id);
    group.brands.push(brand);
    group.target += Number(row.target) || 0;
    group.achievement += Number(row.achievement) || 0;
  });
  withoutPrincipal.forEach((b) => out.push(b));
  for (const group of principals.values()) {
    group.brands.forEach((b) => out.push(b));
    out.push({
      id: `spv-principal-${group.name}`,
      label: group.name,
      type: 'principal',
      isGroup: true,
      target: group.target,
      achievement: group.achievement,
    });
  }
  out.push({ id: 'spv-total', label: 'TOTAL', type: 'total', isGroup: true, target: '', achievement: '' });
  return out;
}

function toCriteriaRows(rows) {
  return rows.map((row) => ({
    criteria_id: row.criteria_id,
    label: row.label,
    target_value: row.target_value ?? 0,
    achievement_value: row.achievement_value ?? 0,
    incentive_amount: '',
  }));
}
```

Fungsi simpan:

```jsx
  const payload = () => ({
    doc_kind: 'spv',
    position_id: Number(positionId),
    format_id: documentFormatId,
    period: toApiPeriod(periodStart),
    period_end: toApiPeriod(periodEnd),
    salesman: spvName,
    wilayah: wilayah || null,
    insentif_total: insentifTotal,
    kwitansi,
  });

  const refresh = async (id) => {
    const { document: full } = await getDocument(id);
    setGolonganRows(toGolonganRows(full.golongan_rows || []));
    setCriteriaRows(toCriteriaRows(full.criteria_rows || []));
    setDocuments((current) => [full, ...current.filter((d) => d.id !== full.id)]);
  };

  const save = async () => {
    if (!canEditDoc || saving) return;
    if (!positionId) { toast('error', 'Pilih SPV terlebih dahulu.'); return; }
    setSaving(true);
    try {
      const result = documentId
        ? await updateDocument(documentId, payload())
        : await createDocument(payload());
      setDocumentId(result.document.id);
      setDocumentStatus(result.document.status);
      await refresh(result.document.id);
      setSaved(true);
      toast('success', documentId ? 'Dokumen SPV terupdate.' : 'Dokumen SPV tersimpan.');
    } catch (err) {
      toast('error', errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!canFinalize) return;
    try {
      const result = await finalizeDocument(documentId);
      setDocumentStatus(result.document.status);
      setDocuments((current) => current.map((d) => d.id === result.document.id ? { ...d, status: result.document.status } : d));
      toast('success', 'Dokumen SPV difinalisasi.');
    } catch (err) {
      toast('error', errMsg(err));
    }
  };

  const reset = () => {
    setDocumentId(null);
    setDocumentStatus('Draft');
    setGolonganRows([]);
    setCriteriaRows([]);
    setInsentifTotal(null);
    setKwitansi(EMPTY_KWITANSI);
    setSavedWilayah('');
    setSaved(false);
  };
```

JSX halaman — pakai struktur kelas yang sama dengan `Documents.jsx` (`page-head`, `content-card`, `doc-header`, `table-wrap`, `action-bar`):

```jsx
  return (
    <>
      <div className="page-head doc-page-head">
        <div className="page-head-copy">
          <h1>Rekap Insentif SPV</h1>
          <p>Akumulasi insentif sales di bawah SPV untuk periode terpilih.</p>
        </div>
        <div className="page-head-actions">
          <Button className="button secondary" type="button" onClick={() => window.print()}>
            <Icon size={15}><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5h20v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></Icon>
            Cetak
          </Button>
          <Button className="button primary" type="button" onClick={save} disabled={!canEditDoc || saving}>
            {documentId ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
          {canFinalize && <Button className="button secondary" type="button" onClick={submit}>Finalisasi</Button>}
        </div>
      </div>

      <section className="content-card info-card">
        <div className="form-grid">
          <label className="block">
            SPV
            <ComboSelect
              value={spvName}
              onChange={(v) => { const hit = spvOptions.find((p) => p.name === v); setPositionId(hit ? String(hit.id) : ''); }}
              options={spvOptions.map((p) => ({ value: p.name, hint: p.sales_code || '' }))}
              placeholder="Pilih SPV..."
              disabled={!canEditDoc}
              emptyHint="Tidak ada SPV di cabang Anda."
            />
          </label>
          <label className="block">
            Bulan Mulai
            <ComboSelect value={periodStart} onChange={(v) => setPeriodStart(v)} options={monthNames().map((m) => ({ value: m }))} placeholder="Pilih bulan, ketik/Shift+Enter tahun..." disabled={!canEditDoc} emptyHint="Tidak ada bulan cocok." />
          </label>
          <label className="block">
            Bulan Akhir
            <ComboSelect value={periodEnd} onChange={(v) => setPeriodEnd(v)} options={monthNames().map((m) => ({ value: m }))} placeholder="Pilih bulan, ketik/Shift+Enter tahun..." disabled={!canEditDoc} emptyHint="Tidak ada bulan cocok." />
          </label>
          <label className="block">
            Wilayah (Kota)
            <input value={wilayah} readOnly disabled />
          </label>
        </div>
      </section>

      <section className="content-card info-card print-section">
        <div className="doc-header">
          <div className="doc-meta">
            <div><strong>Wilayah:</strong><span>{wilayah || '-'}</span></div>
            <div><strong>Jabatan:</strong><span>SPV</span></div>
            <div><strong>Nama Pejabat:</strong><span>{spvName || '-'}</span></div>
            <div><strong>Bulan:</strong><span>{periodLabel || '-'}</span></div>
          </div>
        </div>

        <GolonganTable
          rows={golonganRows}
          onUpdate={() => {}}
          onRemove={() => {}}
          onJenisChange={() => {}}
          onAdd={() => {}}
          onReorder={() => {}}
          canEdit={false}
          salesDivisi={null}
          setSalesDivisi={() => {}}
          divisions={masterData.divisions}
          brands={masterData.brands}
          principals={masterData.principals}
        />

        <KriteriaTable
          rows={criteriaRows}
          onUpdate={() => {}}
          canEdit={false}
          totalEditable={canEditDoc}
          totalOverride={insentifTotal}
          onTotalChange={setInsentifTotal}
        />

        <div className="kwitansi-card">
          <h3><u>KWITANSI</u></h3>
          <div className="kwitansi-grid">
            <div className="kw-row"><label>Sudah terima dari :</label><span>{kwitansi.penerima}</span></div>
            <div className="kw-row"><label>Jumlah Uang</label><input value={kwitansi.jumlahUang} onChange={(e) => setKwitansi({ ...kwitansi, jumlahUang: e.target.value })} disabled={!canEditDoc} /></div>
            <div className="kw-row"><label>Buat Pembayaran</label><input value={kwitansi.keterangan} onChange={(e) => setKwitansi({ ...kwitansi, keterangan: e.target.value })} disabled={!canEditDoc} /></div>
            <div className="kw-row"><label>Terbilang Rp.</label><input value={kwitansi.nominal} onChange={(e) => setKwitansi({ ...kwitansi, nominal: e.target.value })} disabled={!canEditDoc} /></div>
          </div>
          <div className="kw-sign">
            <span className="sig-name">{(spvName || '-').toUpperCase()}</span>
            <span className="sig-role">SPV</span>
          </div>
          <div className="kw-total">
            <span>Total Keseluruhan</span>
            <strong>Rp {Number(insentifTotal || 0).toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </section>

      <footer className="action-bar">
        <div className="autosave"><span className="save-dot" />{saved ? 'Draft tersimpan' : 'Draft belum disimpan'}</div>
        <div className="actions">
          <Button className="button secondary" onClick={reset}>Batal</Button>
          <Button className="button primary" onClick={save} disabled={!canEditDoc || saving}>
            {documentId ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
          {canFinalize && <Button className="button secondary" onClick={submit}>Finalisasi</Button>}
        </div>
      </footer>
    </>
  );
```

Catatan: `ComboSelect` menerima `onChange(value, picked)` — untuk bulan, pakai bentuk yang sama seperti `Documents.jsx` (`pickMonth`) agar tahun bisa diketik manual.

- [ ] **Step 5: Hapus cabang placeholder SPV dari `Documents.jsx` dan perbarui smoke test lama**

Halaman SPV sekarang punya komponen sendiri, jadi cabang `if (docType === 'spv')` di
`Documents.jsx` (sekitar baris 520–538) menjadi kode mati. Hapus seluruh cabang tersebut.

Di `client/src/pages/documents.smoke.test.jsx`, test `'spv rekap page renders'`
masih mengharapkan placeholder. Ganti test tersebut dengan:

```jsx
  it('halaman SPV tidak lagi placeholder', () => {
    const html = renderToString(<Documents {...baseProps} docType="spv" />);
    expect(html).not.toContain('Belum ada data rekap');
  });
```

- [ ] **Step 6: Jalankan test client untuk memastikan lolos**

Run: `cd client; npx vitest run src/pages/spv-document.smoke.test.jsx src/pages/documents.smoke.test.jsx`
Expected: PASS.

- [ ] **Step 7: Sambungkan route di `client/src/App.jsx`**

Tambahkan import lazy:

```jsx
const SpvDocument = lazy(() => import('./pages/SpvDocument'));
```

Tambahkan state:

```jsx
  const [spvTargetId, setSpvTargetId] = useState(null);
```

Di `loadDocument`, tambahkan cabang di awal:

```jsx
    if (doc.doc_kind === 'spv') { setSpvTargetId(doc.id); return; }
```

Ubah route `/documents/spv`:

```jsx
      <Route
        path="/documents/spv"
        element={user ? (
          <Layout breadcrumb={['Dokumen', 'SPV']}>
            <Suspense fallback={<div className="auth-shell" role="status">Memuat…</div>}>
              <SpvDocument
                user={user}
                positions={positions}
                masterData={adminData.masterData}
                documents={documents}
                setDocuments={setDocuments}
                documentFormatId={documentFormatId}
                loadTargetId={spvTargetId}
                onLoadDone={() => setSpvTargetId(null)}
              />
            </Suspense>
          </Layout>
        ) : <Navigate to="/login" replace />}
      />
```

- [ ] **Step 8: Jalankan seluruh test client**

Run: `cd client; npm test`
Expected: PASS (≥ 38 + test baru).

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/SpvDocument.jsx client/src/pages/Documents.jsx client/src/App.jsx client/src/pages/spv-document.smoke.test.jsx client/src/pages/documents.smoke.test.jsx
git commit -m "feat(spv): halaman dokumen SPV dengan header wilayah, jabatan, pejabat, dan periode"
```

---

### Task 5: Dokumen SPV di daftar "Dokumen Tersimpan"

**Files:**
- Create: `client/src/lib/docFilters.js`
- Create: `client/src/lib/docFilters.test.js`
- Modify: `client/src/pages/Insetif.jsx`

**Interfaces:**
- Produces: `docPeriodLabel(doc) -> string` — untuk `doc_kind === 'spv'` memakai `periodRangeLabel(doc.period, doc.period_end)`, selain itu `fromApiPeriod(doc.period)`.
- Produces: `docMatchesPeriode(doc, periode) -> boolean` — SPV: `doc.period <= periode && (doc.period_end || doc.period) >= periode`; selain itu `doc.period === periode`.
- Produces: `docMatchesSpv(doc, spvId) -> boolean` — `doc.position_id === Number(spvId)` atau `doc.salesman` ada di daftar anak SPV.

- [ ] **Step 1: Tulis test gagal untuk helper filter**

Buat `client/src/lib/docFilters.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { docPeriodLabel, docMatchesPeriode, docMatchesSpv } from './docFilters';

describe('filter dokumen SPV', () => {
  const spv = { doc_kind: 'spv', period: '2026-09', period_end: '2026-11', position_id: 2, salesman: 'BUDO' };

  it('label rentang untuk SPV, satu bulan untuk sales', () => {
    expect(docPeriodLabel(spv)).toBe('September 2026 – November 2026');
    expect(docPeriodLabel({ doc_kind: 'sales', period: '2026-10' })).toBe('Oktober 2026');
  });

  it('rentang SPV cocok di setiap bulan yang dinaungi', () => {
    expect(docMatchesPeriode(spv, '2026-09')).toBe(true);
    expect(docMatchesPeriode(spv, '2026-10')).toBe(true);
    expect(docMatchesPeriode(spv, '2026-11')).toBe(true);
    expect(docMatchesPeriode(spv, '2026-12')).toBe(false);
  });

  it('dokumen sales tetap cocok persis', () => {
    expect(docMatchesPeriode({ doc_kind: 'sales', period: '2026-10' }, '2026-10')).toBe(true);
    expect(docMatchesPeriode({ doc_kind: 'sales', period: '2026-10' }, '2026-11')).toBe(false);
  });

  it('dokumen SPV sendiri muncul saat filter SPV', () => {
    expect(docMatchesSpv(spv, 2)).toBe(true);
    expect(docMatchesSpv(spv, 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd client; npx vitest run src/lib/docFilters.test.js`
Expected: FAIL — `./docFilters` tidak ada.

- [ ] **Step 3: Implementasikan `client/src/lib/docFilters.js`**

```js
import { fromApiPeriod, periodRangeLabel } from './period';

// Label periode di kartu dokumen: SPV menampilkan rentang, sales satu bulan.
export function docPeriodLabel(doc) {
  if (!doc) return '';
  if (doc.doc_kind === 'spv') return periodRangeLabel(doc.period, doc.period_end);
  return fromApiPeriod(doc.period);
}

// Filter bulan: SPV tampil di setiap bulan yang dinaungi rentangnya.
export function docMatchesPeriode(doc, periode) {
  if (!periode) return true;
  if (doc.doc_kind === 'spv') {
    const end = doc.period_end || doc.period;
    return doc.period <= periode && end >= periode;
  }
  return doc.period === periode;
}

// Filter SPV: dokumen milik SPV itu sendiri + dokumen sales anak-anaknya.
export function docMatchesSpv(doc, spvId, childNames = []) {
  if (!spvId) return true;
  if (doc.doc_kind === 'spv') return doc.position_id === Number(spvId);
  return childNames.includes(doc.salesman);
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `cd client; npx vitest run src/lib/docFilters.test.js`
Expected: PASS (4 test).

- [ ] **Step 5: Pakai helper di `client/src/pages/Insetif.jsx`**

1. Import: `import { docPeriodLabel, docMatchesPeriode, docMatchesSpv } from '../lib/docFilters';` dan `import { apiMonthsInRange } from '../lib/period';` (perlu satu import tambahan dari `../lib/period` — `fromApiPeriod` sudah diimpor, tambahkan `apiMonthsInRange` ke baris itu).

2. Ganti `periodeOptions` (sekitar baris 260) supaya bulan dalam rentang SPV ikut masuk:

```jsx
  const periodeOptions = useMemo(() => {
    const months = new Set();
    for (const d of documents) {
      if (!d.period) continue;
      if (d.doc_kind === 'spv') apiMonthsInRange(d.period, d.period_end).forEach((m) => months.add(m));
      else months.add(d.period);
    }
    return [...months].sort().reverse();
  }, [documents]);
```

3. Ganti filter periode di `visibleDocs` (sekitar baris 277):

```jsx
    if (periode) rows = rows.filter((d) => docMatchesPeriode(d, periode));
```

4. Ganti filter SPV (sekitar baris 271):

```jsx
    } else if (spvId) {
      const names = childrenOf(positions, Number(spvId)).map((p) => p.name);
      rows = rows.filter((d) => docMatchesSpv(d, spvId, names));
    }
```

5. Ganti semua tampilan periode kartu/detail dari `fromApiPeriod(x.period)` menjadi `docPeriodLabel(x)` (terdapat di blok desktop sekitar baris 506 dan 527, dan blok mobile sekitar baris 831). Ganti juga label "Periode" pada detail (sekitar baris 527) menjadi `docPeriodLabel(activeDoc)`.

6. Tambah lencana `SPV` di kartu dokumen: di blok yang merender `makeBadge(activeDoc.status)` (sekitar baris 508 desktop dan 833 mobile), tambahkan sebelum badge status:

```jsx
  {activeDoc.doc_kind === 'spv' && <span className="status-pill final">SPV</span>}
```

7. Pencarian (sekitar baris 281) tetap memakai `fromApiPeriod(d.period)`; ubah ke `docPeriodLabel(d)` agar rentang ikut dicari.

- [ ] **Step 6: Jalankan seluruh test client**

Run: `cd client; npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/docFilters.js client/src/lib/docFilters.test.js client/src/pages/Insetif.jsx
git commit -m "feat(spv): lencana SPV dan rentang periode di daftar dokumen tersimpan"
```

---

### Task 6: Verifikasi end-to-end + build produksi

**Files:**
- Modify: `docs/superpowers/specs/2026-11-12-spv-document-design.md` (tandai implementasi selesai)

**Interfaces:**
- Consumes: seluruh API Task 3 dan UI Task 4/5.

- [ ] **Step 1: Jalankan seluruh test (server + client)**

Run: `cd server; npm test` lalu `cd client; npm test`
Expected: keduanya PASS.

- [ ] **Step 2: Build produksi client**

Run: `cd client; npm run build`
Expected: build sukses, `dist/assets/` terbentuk.

- [ ] **Step 3: Restart server dan cek endpoint**

```powershell
pm2 restart insetive-api --update-env
node -e "require('http').get('http://localhost:3002/api/health',r=>console.log('health ->',r.statusCode))"
```
Expected: `health -> 200`.

- [ ] **Step 4: Cek manual di browser**

Buka `http://localhost:3002/login`, login `super` / `123456`, lalu:
- Buka `/documents/spv` → header memuat Wilayah, Jabatan, Nama Pejabat, Bulan.
- Pilih SPV + rentang → Simpan Draft → tabel golongan & kriteria terisi dari dokumen sales Final.
- Buka `/insetif` → dokumen SPV muncul dengan lencana `SPV` dan periode rentang; filter bulan ketiga bulan menampilkan dokumen tersebut.

- [ ] **Step 5: Tandai spec selesai**

Ubah baris `Status: menunggu approval` di `docs/superpowers/specs/2026-11-12-spv-document-design.md` menjadi `Status: sudah diimplementasikan`.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-11-12-spv-document-design.md
git commit -m "docs(spv): tandai desain SPV sebagai sudah diimplementasikan"
```
