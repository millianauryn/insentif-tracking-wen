# Architecture (current, as built 2026-11-07)

## Stack

- **Client** (`client/`): React 19 + Vite 8 + Tailwind 4 + shadcn/base-ui, `lucide-react` icons, `@tanstack/react-query` (thinned). Routes lazy-loaded, vendor split in `vite.config.js` (`vendor-react/vendor-router/vendor-base-ui/vendor-icons/vendor-query`).
- **Server** (`server/`): Express 5 + `better-sqlite3`, Helmet, CORS, `express-rate-limit`. Cookie sessions (`session_token`, httpOnly, 24h), `crypto.scrypt` passwords, `sha256(token)` in `sessions`.
- **DB**: SQLite file `server/data/incentive.sqlite`. `schema.sql` + idempotent `PRAGMA` migrations in `db.js`.
- **Ports**: API `3002`, dev front `5173`, prod preview `4173` (config proxies `/api` → `3002`).

> `docs/*.md` + `docs/superpowers/*` are historical. This file is the canonical functional record — no behavior changes here without an ADR.

## Roles & Flows

**Roles**: `superadmin` (manage + approve), `officer` (create/edit Draft), `observer` (Direksi — approve/read-only). `super`/`officer`/`direksi` are dev quick-login accounts (`/api/auth/dev-login`, only when not production).

**Login/logout**: `POST /api/auth/login` → session cookie; `GET /api/auth/me` restores user; `POST /api/auth/logout` deletes session. Rate limit 10/15 min/IP. `pbg_csrf` double-submit on non-GET. Username lowercased client-side; password ≥6.

**Documents (Dokumen Sales)** (`server/routes/documents.js`):
- Status `Draft` → `Final`. Officer creates/edits/deletes Draft (own docs). Observer + superadmin finalize; superadmin may correct Final (audited). Observer POST create is 403.
- Save = `POST /api/documents` (create) / `PATCH /:id` (update) with `format_id, salesman, product, period (YYYY-MM), wilayah, divisi, insentif_total, golongan_rows[], criteria_rows[], kwitansi{}`. `buildGolonganRows` persists Divisi rows as label prefix `DIVISI:<nama>` / `TOTALDIVISI:<nama>` (no schema migration).
- **One incentive per sales per period**: `findDuplicateDoc` (case-insensitive) blocks a second live doc for same salesman+period (409 `DUPLICATE_SALES_PERIOD`); empty salesman exempt.
- Golongan editing: brand/principal rows, total-divisi/total computed (`lib/golongan.js`: Principal auto = sum of brand rows above since last separator, manual overrides per field; `computeTotalFor` per Divisi section).
- Kriteria editing: target/achievement/%/insentif per criteria; `CALL COMPLIANCE` % is manually typed (number + `%` suffix, `percentage_value`); `GOL YG GUGUR <50%` insentif typed with a minus and subtracted in totals.
- Kwitansi (auto/display): `penerima` (officer = first linked branch name, superadmin = dropdown), `Jumlah Uang`/`Buat Pembayaran` default `Incentive penjualan bulan <periode>`, `Terbilang Rp.` = total insentif (editable override via `nominal`), signature = salesman name + `SALESMAN` (no sales code). Preview on list uses same totals.

**Dokumen Tersimpan (`Insetif`)**: search + BM/SPV/Sales/Periode filters, paginated (`ListPager` 10/25/50/100, horizontal `1 / N`). Detail panel opens full preview (golongan + kriteria + kwitansi tables) via `getDocument`. Draft ∩ Final both listed (badge case-insensitive). `Tandai Final` only visible to observer/superadmin and calls the API; `Edit`/`Hapus` only on Draft for officer-owner/superadmin (confirm dialog) — `DELETE /:id` is Draft-only (409 on Final).

**Jabatan positions** (`server/routes/positions.js`): BM→SPV→SALES hierarchy with `sales_code`, `branch_ids`, `criteria_ids`. Users (`server/routes/users.js`): officer requires ≥1 branch; position must be active `SALES` sharing a selected branch; `sales_code`/`position_id` editable.

**Master data** (`server/routes/master-data.js`, superadmin only): divisions, principals (linked to division), brands (linked to principal), regions, branches (code/address/city/region, branch↔division/region). Brand/Principal dropdowns filter per active Divisi section.

## Run

```powershell
cd server; npm install; npm start          # :3002
cd client; npm install; npm run dev        # :5173
cd client; npm run build; npm run preview  # prod :4173
cd client; npx vitest run                  # client 40 tests
```

## Build config

- `client/vite.config.js`: `server/preview.proxy /api → 3002`, vendor `manualChunks`.
- `client/package.json`: axios removed from imports (fetch in `lib/api.js`); keep `axios` dep until next `npm install` prunes it.
- `server/package.json` must list `better-sqlite3, cookie-parser, express-rate-limit` (used in code) — see audit #1 before clean install.

## Guardrails (do not change function)

1. One sales / one period enforced in `documents.js` — update UI copy, not the rule.
2. Finalize only observer+superadmin (`access.js:canFinalizeDocument` + `documents.js:/finalize`).
3. Draft-only Edit/Delete; Final only superadmin-correct with audit.
4. Officer sees only own docs; observer/superadmin see all (`GET /documents`).
