# Architecture (current, as built 2026-11-09)

## Stack

- **Client** (`client/`): React 19 + Vite 8 + Tailwind 4 + shadcn/base-ui, `lucide-react` icons. Routes lazy-loaded, vendor split in `vite.config.js` (`vendor-react/vendor-router/vendor-base-ui/vendor-icons`). HTTP layer = satu file `client/src/api.js` (fetch core: CSRF, timeout 20dtk, redirect 401, `apiRequest` + `api` + `errMsg`).
- **Server** (`server/`): Express 5 + `better-sqlite3`, Helmet, CORS, `express-rate-limit`. Cookie sessions (`session_token`, httpOnly, 24h), `crypto.scrypt` passwords, `sha256(token)` in `sessions`.
- **DB**: SQLite file `server/data/incentive.sqlite` (WAL + `busy_timeout 5000`). `schema.sql` + idempotent `PRAGMA` migrations in `db.js`.
- **Ports**: production API `3002` (PM2), dev API `3003` (`server/dev.js`), dev front `5173` (proxy `/api` → `3003`), prod preview `4173` (proxy `/api` → `3002`). Server defaults `NODE_ENV=development` bila kosong (dev-login aktif hanya di development/test). Dev API dipisah dari production supaya `npm run dev` tidak merebut port PM2 (server keluar sendiri kalau port sudah dipakai).

> `docs/*.md` + `docs/superpowers/*` are historical. This file is the canonical functional record — no behavior changes here without an ADR.

## Roles & Flows

**Roles**: `superadmin` (manage + approve), `officer` (create/edit Draft), `observer` (Direksi — approve/read-only). `super`/`officer`/`direksi` are dev quick-login accounts (`/api/auth/dev-login`, only when not production).

**Login/logout**: `POST /api/auth/login` → session cookie; `GET /api/auth/me` restores user; `POST /api/auth/logout` deletes session. Rate limit 10/15 min/IP. Pengaman = cookie httpOnly + `SameSite=Lax` + aksi tulis selalu non-GET (tidak ada token CSRF). Username lowercased client-side; password ≥6.

**Documents (Dokumen Sales)** (`server/routes/documents.js`):
- Status `Draft` → `Final`. Officer creates/edits/deletes Draft (own docs). Observer + superadmin finalize; superadmin may correct Final (audited). Observer POST create is 403.
- Save = `POST /api/documents` (create) / `PATCH /:id` (update) with `format_id, salesman, product, period (YYYY-MM), wilayah, divisi, insentif_total, golongan_rows[], criteria_rows[], kwitansi{}`. `divisi` (nama) disimpan di kolom `incentive_documents.divisi` dan dibaca lagi saat load. Golongan rows: label prefix `DIVISI:<nama>` / `TOTALDIVISI:<nama>` (tanpa migrasi skema). Batas: ≤50 baris, label ≤80, target/achievement finit ≥0.
- **List pagination**: `GET /documents?limit&offset` (limit default tanpa param = semua; klien memakai `limit=500`) + `total` di respons.
- **One incentive per sales per period**: `findDuplicateDoc` (case-insensitive) blocks a second live doc for same salesman+period (409 `DUPLICATE_SALES_PERIOD`); empty salesman exempt. DB backstop: unique index `idx_doc_sales_period` (parsial, aktif sejak pembersihan duplikat 2026-11-09).
- Golongan editing: brand/principal rows, total-divisi/total computed (`lib/golongan.js`: Principal auto = sum of brand rows above since last separator, manual overrides per field; `computeTotalFor` per Divisi section).
- Kriteria editing: target/achievement/%/insentif per criteria; `CALL COMPLIANCE` % is manually typed (number + `%` suffix, `percentage_value`); `GOL YG GUGUR <50%` insentif typed with a minus and subtracted in totals. Dua label reserved (`CALL COMPLIANCE`, `GOL YG GUGUR KURANG DARI 50%`) tidak bisa dibuat/diubah via API (409 `RESERVED_LABEL`) — klien mengenali input minus/percent dari label ini.
- Kwitansi (auto/display): `penerima` (officer = first linked branch name, superadmin = dropdown), `Jumlah Uang`/`Buat Pembayaran` default `Incentive penjualan bulan <periode>`, `Terbilang Rp.` = total insentif (editable override via `nominal`), signature = salesman name + `SALESMAN` (no sales code). Preview on list uses same totals.

**Dokumen Tersimpan (`Insetif`)**: search + BM/SPV/Sales/Periode filters, paginated (`ListPager` 10/25/50/100, horizontal `1 / N`). Detail panel opens full preview (golongan + kriteria + kwitansi tables) via `getDocument`. Draft ∩ Final both listed (badge case-insensitive). `Tandai Final` only visible to observer/superadmin and calls the API; `Edit`/`Hapus` only on Draft for officer-owner/superadmin (confirm dialog) — `DELETE /:id` is Draft-only (409 on Final).

**Jabatan positions** (`server/routes/positions.js`): BM→SPV→SALES hierarchy with `sales_code`, `branch_ids`, `criteria_ids` — list diambil dengan 2 query bulk (bukan per baris); aturan hierarki divalidasi saat create (SPV wajib parent BM, SALES wajib parent SPV; test di `positions.test.js`). Users (`server/routes/users.js`): officer requires ≥1 branch; position must be active `SALES` sharing a selected branch; `sales_code`/`position_id` editable; validasi lengkap sebelum tulis.

**Ops (satu proses server)**: `criteria_ids` di-cache per user 30 detik (perubahan jabatan terlihat ≤30 dtk); sesi kedaluwarsa dibersihkan saat start + setiap 24 jam; aplikasi memuat master data + posisi sekali saat login (bukan tiap buka halaman).

**Master data** (`server/routes/master-data.js`, superadmin only): divisions, principals (linked to division), brands (linked to principal), regions, branches (code/address/city/region, branch↔division/region). Brand/Principal dropdowns filter per active Divisi section.

## Run

```powershell
cd server; npm install; npm start          # :3002
cd client; npm install; npm run dev        # :5173
cd client; npm run build; npm run preview  # prod :4173
cd client; npx vitest run                  # client 35 tests
cd server; npm test                        # server 58 tests
```

## Build config

- `client/vite.config.js`: `server/preview.proxy /api → 3002`, vendor `manualChunks`.
- `client/package.json`: tanpa `axios`, `react-icons`, `@tanstack/react-query` (semua sudah dihapus dari kode; lockfile sudah dipangkas).
- `server/package.json` declares `better-sqlite3, cookie-parser, express-rate-limit` + devDeps `vitest, supertest`.

## Guardrails (do not change function)

1. One sales / one period enforced in `documents.js` — update UI copy, not the rule.
2. Finalize only observer+superadmin (`access.js:canFinalizeDocument` + `documents.js:/finalize`).
3. Draft-only Edit/Delete; Final only superadmin-correct with audit.
4. Officer sees only own docs; observer/superadmin see all (`GET /documents`).
5. Two reserved criteria labels stay exactly as written (client keys off them); API rejects create/rename of them.
6. `divisi` field round-trips: client sends it, server stores `incentive_documents.divisi`, client reads it on load — keep all three in sync.
