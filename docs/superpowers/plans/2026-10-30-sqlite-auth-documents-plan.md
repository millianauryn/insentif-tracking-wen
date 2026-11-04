# SQLite Auth and Incentive Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SQLite the source of truth for authentication, master data, document formats, criteria, incentive documents, flexible Golongan rows, and immutable per-document criteria snapshots.

**Architecture:** Keep Express as API boundary and React as client. Use `better-sqlite3` with a small database module, parameterized SQL, explicit role/status middleware, and HttpOnly database-backed sessions. Copy active criteria into document-specific rows at creation; never recalculate old documents from current criteria definitions.

**Tech Stack:** Node.js CommonJS, Express 5, better-sqlite3, Node `crypto.scrypt`, SQLite, React 19, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-sqlite-auth-documents-design.md`

## Global Constraints

- Use `better-sqlite3`; no ORM.
- Store database at `server/data/incentive.sqlite`; ignore database files and journals.
- Use Node `crypto.scrypt`; never store plaintext passwords or session tokens.
- Use HttpOnly, SameSite session cookies; never store auth tokens in localStorage.
- Validate all API request bodies server-side.
- Use parameterized SQL and SQLite foreign keys.
- Restrict CORS to configured frontend origins.
- Rate-limit login and privileged mutation routes.
- Enforce role, ownership, and document status on server.
- `Draft`: Officer owner and Super Admin may edit.
- `Final`: only Super Admin may edit; Officer owner may finalize Draft.
- Observer is read-only.
- Kriteria changes affect new documents only.
- Golongan rows remain flexible.
- Preserve `>= 100%` as `Tercapai` and `< 100%` as `Gugur`.
- No PDF export, external identity provider, or SQLite triggers in first version.

## Review Focus

- Failed login never reveals whether username exists and cannot bypass rate limits.
- Officer cannot read or edit another Officer's document.
- Officer cannot edit or finalize a `Final` document.
- Super Admin can edit `Final` documents and creates an audit log.
- Existing document criteria remain unchanged after master criteria edits.
- A document with flexible Golongan groups/products keeps row order and parent relationships.
- Database startup is idempotent and does not recreate or erase existing data.
- CORS rejects unconfigured origins and auth cookies are not readable by JavaScript.

---

### Task 1: Add SQLite database foundation

**Files:**
- Modify: `server/package.json`, `server/package-lock.json`
- Create: `server/db.js`
- Create: `server/schema.sql`
- Modify: `.gitignore`
- Test: `server/db.test.js`

**Interfaces:**
- `openDatabase(filename?) -> Database`
- `migrateDatabase(db) -> void`
- `seedDatabase(db) -> void`
- Schema exposes tables `users`, `sessions`, `divisions`, `principals`, `brands`, `document_formats`, `criteria_definitions`, `incentive_documents`, `golongan_rows`, `document_criteria_rows`, and `audit_logs`.

- [ ] **Step 1: Write failing tests** for idempotent migration, foreign keys, required tables, and seed data.
- [ ] **Step 2: Run `npm test -- --run db.test.js` in `server/` and confirm failure because database module does not exist.**
- [ ] **Step 3: Install `better-sqlite3` in `server/` and implement `openDatabase`, `migrateDatabase`, and `seedDatabase` using parameterized statements and transactions.**
- [ ] **Step 4: Add `.sqlite`, `-wal`, `-shm`, and `server/data/` ignores without ignoring schema or migrations.**
- [ ] **Step 5: Run focused database tests and confirm pass.**
- [ ] **Step 6: Commit `feat: add sqlite database foundation`.**

### Task 2: Add secure sessions and role authorization

**Files:**
- Create: `server/auth.js`
- Create: `server/auth.test.js`
- Create: `server/middleware.js`
- Modify: `server/index.js`
- Modify: `server/package.json`, `server/package-lock.json`
- Create: `.env.example`
- Modify: `README.md`

**Interfaces:**
- `hashPassword(password) -> Promise<string>`
- `verifyPassword(password, encodedHash) -> Promise<boolean>`
- `createSession(db, userId) -> { token, expiresAt }`
- `requireAuth(request, response, next)` attaches `request.user` without password fields.
- `requireRole(...roles)` rejects unauthorized roles with `{ error: { code, message } }`.
- `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me` use cookie sessions.

- [ ] **Step 1: Write failing tests** for login validation, invalid credential response, session cookie flags, `/me`, logout, role denial, and password hash non-reversibility.
- [ ] **Step 2: Run focused auth tests and confirm failure.**
- [ ] **Step 3: Implement scrypt password hashing, constant-time verification, random session tokens stored only as hashes, and expiry cleanup.**
- [ ] **Step 4: Add auth routes, generic login errors, HttpOnly SameSite cookies, CORS allowlist, Helmet, and environment validation for `SESSION_SECRET`/cookie settings.**
- [ ] **Step 5: Add rate limiting to login and return `429 AUTH_RATE_LIMITED` after configured threshold.**
- [ ] **Step 6: Run focused auth tests and confirm pass.**
- [ ] **Step 7: Commit `feat: add secure role sessions`.**

### Task 3: Add Super Admin user management and master data APIs

**Files:**
- Create: `server/routes/users.js`
- Create: `server/routes/master-data.js`
- Create: `server/routes/users.test.js`
- Create: `server/routes/master-data.test.js`
- Modify: `server/index.js`

**Interfaces:**
- `GET /api/users`: Super Admin only; never returns password hashes.
- `POST /api/users`: Super Admin only; validates username, password, and role.
- `PATCH /api/users/:id`: Super Admin only; supports active flag, username, role, and password change.
- `GET /api/master-data`: authenticated read access.
- `POST/PATCH/DELETE /api/divisions`, `/api/principals`, `/api/brands`: Super Admin only.
- Unique names and parent foreign keys return `409 CONFLICT`.

- [ ] **Step 1: Write failing API tests** for Super Admin creation, duplicate usernames, invalid roles, non-admin denial, master-data reads, and master-data mutation denial.
- [ ] **Step 2: Run focused route tests and confirm failure.**
- [ ] **Step 3: Implement validation and CRUD with prepared statements and transactions.**
- [ ] **Step 4: Add rate limiting to user and master-data mutations.**
- [ ] **Step 5: Run focused route tests and confirm pass.**
- [ ] **Step 6: Commit `feat: add user and master data management`.**

### Task 4: Add formats and criteria snapshots

**Files:**
- Create: `server/routes/criteria.js`
- Create: `server/routes/criteria.test.js`
- Modify: `server/index.js`
- Modify: `server/db.js` or `server/schema.sql`

**Interfaces:**
- `GET /api/document-formats`: authenticated list of active formats.
- `GET /api/criteria-definitions`: authenticated list of active master criteria.
- `POST/PATCH/DELETE /api/criteria-definitions`: Super Admin only.
- Each criterion has stable ID, label, target unit, formula/config, sort order, and active flag.

- [ ] **Step 1: Write failing tests** proving Super Admin can mutate criteria, Officer/Observer cannot, and old snapshots remain unchanged after master edits.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement criteria and format routes with validation and audit logging for Super Admin changes.**
- [ ] **Step 4: Run focused tests and confirm pass.**
- [ ] **Step 5: Commit `feat: add criteria and document formats`.**

### Task 5: Add document creation, flexible Golongan rows, finalization, and correction audit

**Files:**
- Create: `server/routes/documents.js`
- Create: `server/routes/documents.test.js`
- Create: `server/calculations.js`
- Create: `server/calculations.test.js`
- Modify: `server/index.js`

**Interfaces:**
- `GET /api/documents`: role-filtered list with pagination.
- `POST /api/documents`: creates Draft, copies active criteria snapshot, and stores flexible Golongan rows in one transaction.
- `GET /api/documents/:id`: enforces read access and returns document, Golongan rows, criteria snapshot, and receipt data.
- `PATCH /api/documents/:id`: allows Officer owner only while Draft; allows Super Admin for Draft/Final; rejects other edits with `403` or `409 DOCUMENT_LOCKED`.
- `POST /api/documents/:id/finalize`: Officer owner or Super Admin; validates required data, changes Draft to Final.
- `calculateRow` and `calculateTotals` preserve `>= 100%` as `Tercapai`.
- Final-document Super Admin edits create `audit_logs` entries.

- [ ] **Step 1: Write failing tests** for document creation, criteria snapshot, flexible parent rows, ownership filtering, Draft edit, Final lock, Super Admin Final edit, finalization validation, and audit record.
- [ ] **Step 2: Run focused document tests and confirm failure.**
- [ ] **Step 3: Implement transaction-based document creation and updates with prepared statements.**
- [ ] **Step 4: Implement role/ownership/status policy and finalization endpoint.**
- [ ] **Step 5: Implement calculations, derived status, and receipt totals without duplicating source values.**
- [ ] **Step 6: Run focused document tests and confirm pass.**
- [ ] **Step 7: Commit `feat: add sqlite incentive documents`.**

### Task 6: Replace client localStorage with authenticated API flow

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/incentive.js`
- Create: `client/src/api.js`
- Create: `client/src/auth.test.js`
- Modify: `client/src/App.css`, `client/src/index.css`

**Interfaces:**
- `apiRequest(path, options?) -> Promise<Response JSON>` sends `credentials: 'include'` and handles structured errors.
- Client loads current user from `/api/auth/me`.
- Login page posts to `/api/auth/login`; logout posts to `/api/auth/logout`.
- Dashboard and document view load data from `/api/documents`; no auth token enters localStorage.
- Existing localStorage rows are not silently deleted or imported.

- [ ] **Step 1: Write failing client tests** for login state, role-specific access, authenticated document load, and structured API errors.
- [ ] **Step 2: Run focused client tests and confirm failure.**
- [ ] **Step 3: Add API client and minimal login screen with client-side validation.**
- [ ] **Step 4: Render role-specific navigation and enforce read-only behavior in UI while relying on server enforcement.**
- [ ] **Step 5: Replace row persistence with document API calls and preserve empty/loading/error states.**
- [ ] **Step 6: Run client tests and build.**
- [ ] **Step 7: Commit `feat: connect client to sqlite api`.**

### Task 7: Add Super Admin UI and final verification

**Files:**
- Modify: `client/src/App.jsx`
- Create: `client/src/admin.test.js`
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Write failing tests** for Super Admin-only user/criteria management controls and hidden controls for Officer/Observer.
- [ ] **Step 2: Implement minimal user management and criteria management screens.**
- [ ] **Step 3: Add local setup instructions, first Super Admin environment variables, SQLite backup warning, and role matrix.**
- [ ] **Step 4: Run server tests, client tests, lint, build, and `npm audit` for both package-lock files.**
- [ ] **Step 5: Run API smoke tests for login, role denial, Draft edit, Finalization, and Super Admin correction.**
- [ ] **Step 6: Run `graphify update .`, inspect `git diff --check`, and verify database files are ignored.**
- [ ] **Step 7: Commit `feat: add role management and final verification`.**

## Rollback and migration notes

- Existing `localStorage` remains untouched during rollout.
- SQLite migration is additive and idempotent.
- Revert API/client commits to restore prior prototype behavior; remove ignored `server/data/incentive.sqlite` manually only when intentionally discarding local data.
- Do not commit seeded passwords, cookies, session tokens, or database files.
