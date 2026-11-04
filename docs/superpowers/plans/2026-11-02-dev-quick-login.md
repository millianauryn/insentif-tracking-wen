# Dev Quick-Login Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three dev-only quick-login buttons (`super`, `officer`, `direksi`) that enter the app with one click and never work in production.

**Architecture:** Server gains `POST /api/auth/dev-login?user=<name>` behind a production guard; it upserts the mapped account with `active = 1`, issues the same session cookie as normal login, and skips the rate limiter. Client shows three buttons only when `import.meta.env.DEV` and feeds the returned user into the existing login success path.

**Tech Stack:** Express 5 + better-sqlite3 (CommonJS) with vitest + supertest; React 19 + Vite with vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-dev-quick-login-design.md`

## Global Constraints

- Dev endpoint must respond only when `process.env.NODE_ENV` is explicitly `development` or `test`, checked inside the handler at request time; anything else (including unset) returns 404. `server/package.json` `dev` script sets `NODE_ENV=development`.
- Allowed names and roles are fixed: `super → superadmin`, `officer → officer`, `direksi → observer`. Any other `user` query value → 404, never touches SQL.
- Dev path must never be wrapped in `authLimiter`.
- Session cookie options must match `/api/auth/login` exactly: `httpOnly`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `maxAge: 24 * 60 * 60 * 1000`.
- No password or password hash appears in any client file.
- Existing rows `superadmin`, `tes`, `ter` must not be deleted, renamed, or modified by any task.
- UI copy is Indonesian, matching the login page (`Masuk sebagai super`, etc.).
- Buttons render only when `import.meta.env.DEV` is true.

## Review Focus

- Production guard depends on `NODE_ENV` read at request time, not module load — a module-load check would pass tests and fail on deploys. Pinned in Task 1, test "production guard returns 404".
- Unrelated deactivated accounts (`tes`, `superadmin`, `ter`) must stay deactivated after a dev-login. Pinned in Task 1, test "does not touch unrelated accounts".
- The `user` query value must never reach SQL as an identifier — map lookup only. Pinned in Task 1, test "rejects usernames that are not in the map".
- The session cookie must survive the Vite proxy (`localhost:5173` → `3001`) so the button actually logs in in the browser. Pinned in Task 4, browser verification step.
- Rate limiter exhaustion (10 / 15 min) must not block the new path. Pinned in Task 1, test "is not blocked after more than ten attempts".

---

### Task 1: Server dev-login route with tests

**Files:**
- Create: `server/routes/dev-auth.js`
- Test: `server/routes/dev-auth.test.js`

**Interfaces:**
- Consumes: `createSession(db, userId)` from `server/auth.js` (returns `{ token, expiresAt }`), `requireAuth` + `configureAuthDatabase` from `server/middleware.js`.
- Produces: `createDevAuthRouter(db) -> express.Router` handling `POST /dev-login` (mounted at `/api/auth` in Task 2, full path `POST /api/auth/dev-login?user=<name>`, response body `{ user: { id, username, role } }` with `Set-Cookie: session_token`).

- [ ] **Step 1: Write the failing test file**

Create `server/routes/dev-auth.test.js` following the harness pattern of `server/routes/criteria.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { openDatabase, migrateDatabase } from '../db.js';
import { configureAuthDatabase, requireAuth } from '../middleware.js';
import createDevAuthRouter from './dev-auth.js';

function createTestApp(db) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', createDevAuthRouter(db));
  app.get('/api/auth/me', requireAuth);
  return supertest(app);
}

describe('Dev quick-login API', () => {
  let db;
  let request;
  let previousNodeEnv;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrateDatabase(db);
    configureAuthDatabase(db);
    request = createTestApp(db);
    previousNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('creates super as superadmin, sets session cookie, session works', async () => {
    const response = await request.post('/api/auth/dev-login?user=super').expect(200);
    // assertions:
    // expect(response.body.user).toEqual(expect.objectContaining({ username: 'super', role: 'superadmin' }))
    // expect(response.headers['set-cookie'][0]).toMatch(/^session_token=/)
    // follow-up: GET /api/auth/me with Cookie header -> 200 and same user
  });

  it('reactivates a deactivated account and syncs its role', async () => {
    db.prepare("INSERT INTO users (username, password_hash, role, active) VALUES ('direksi', 'x:x', 'officer', 0)").run();
    // POST /api/auth/dev-login?user=direksi -> 200, body role 'observer'
    // db read: active = 1, role = 'observer'
  });

  it('does not touch unrelated accounts', async () => {
    db.prepare("INSERT INTO users (username, password_hash, role, active) VALUES ('tes', 'x:x', 'officer', 0)").run();
    // POST user=super -> 200
    // db read: 'tes' still active 0
  });

  it('rejects usernames that are not in the map', async () => {
    // POST user=root -> 404
    // POST user=super'-- -> 404
    // users table row count unchanged
  });

  it('production guard returns 404', async () => {
    process.env.NODE_ENV = 'production';
    // POST user=super -> 404
  });

  it('is not blocked after more than ten attempts', async () => {
    // for-loop 12 POSTs user=super, every response status 200
  });
});
```

Write the six tests as real code with `.post('/api/auth/dev-login?user=...')`, the assertions spelled out (the comments above name each assertion). The `me` follow-up sends `Cookie: session_token=<value from set-cookie>`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run routes/dev-auth.test.js`
Expected: FAIL — `createDevAuthRouter` is not a function / module not found.

- [ ] **Step 3: Implement `createDevAuthRouter(db)` in `server/routes/dev-auth.js`**

CommonJS, same style as `routes/users.js`:

- `const DEV_USERS = { super: 'superadmin', officer: 'officer', direksi: 'observer' };`
- Handler flow for `router.post('/dev-login', async (req, res)`:
  1. Fail-closed guard: when `process.env.NODE_ENV` is neither `'development'` nor `'test'`, respond with the 404 JSON below (post-review change; the original plan said `=== 'production'`).
  2. `const name = req.query.user; const role = DEV_USERS[name];` — no role → same 404.
  3. `SELECT id, username, role, active FROM users WHERE username = ?` with `name` (parameterized).
  4. Missing row → `INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)` where the hash is `require('crypto').randomBytes(16).toString('hex') + ':dev'` (created only, never verified).
  5. Existing row → `UPDATE users SET active = 1, role = ?, updated_at = datetime('now') WHERE id = ?` with the mapped `role`.
  6. `const session = createSession(db, id);` then set cookie with the exact options from Global Constraints, then `res.json({ user: { id, username, role } })`.
- Wrap in try/catch with the `console.error` + 500 pattern used by `routes/users.js`.
- No `authLimiter`, no auth middleware on this route.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run routes/dev-auth.test.js`
Expected: PASS, all six.

- [ ] **Step 5: Run the whole server suite**

Run: `cd server && npm test`
Expected: PASS, no regression in `auth.test.js`, `credentials.test.js`, `routes/*.test.js`.

- [ ] **Step 6: Commit**

```bash
git add server/routes/dev-auth.js server/routes/dev-auth.test.js
git commit -m "feat(server): dev-only quick-login route for super/officer/direksi"
```

---

### Task 2: Mount the router and verify against the live server

**Files:**
- Modify: `server/index.js` (after the existing `/api/auth/me` route, line ~91)

**Interfaces:**
- Consumes: `createDevAuthRouter(db)` from Task 1.
- Produces: live endpoint `POST http://localhost:3001/api/auth/dev-login?user=super`.

- [ ] **Step 1: Mount the router**

Add `const createDevAuthRouter = require('./routes/dev-auth.js');` to the require block and `app.use('/api/auth', createDevAuthRouter(db));` right after the `/api/auth/me` route. `node --watch` reloads the server on save.

- [ ] **Step 2: Verify live with curl**

Run:
```powershell
Invoke-WebRequest -Uri 'http://localhost:3001/api/auth/dev-login?user=super' -Method POST -SessionVariable s
Invoke-WebRequest -Uri 'http://localhost:3001/api/auth/me' -WebSession $s
```
Expected: first call 200 with `set-cookie: session_token=...` and body `{"user":{"username":"super","role":"superadmin"}}`; second call 200 with the same user. This also proves the rate limiter is not involved (the old `/api/auth/login` still returns 429 right now).

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat(server): mount dev quick-login router"
```

---

### Task 3: Client `devLogin()` API function with test

**Files:**
- Modify: `client/src/api.js` (next to `login`, line ~20)
- Test: `client/src/api.test.js`

**Interfaces:**
- Consumes: `apiRequest(path, options)`.
- Produces: `devLogin(name: string) -> Promise<{ user: { id, username, role } }>`; sends `POST /api/auth/dev-login?user=<name>`.

- [ ] **Step 1: Write the failing test**

Add to `client/src/api.test.js`, matching the existing fetch-mock style of the file's login tests:

```js
it('devLogin posts to the dev endpoint with the name in the query', async () => {
  fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ user: { id: 1, username: 'super', role: 'superadmin' } }) })
  await expect(devLogin('super')).resolves.toEqual({ user: { id: 1, username: 'super', role: 'superadmin' } })
  expect(fetch).toHaveBeenCalledWith('/api/auth/dev-login?user=super', expect.objectContaining({ method: 'POST', credentials: 'include' }))
})
```

(Adjust the mock helper to the exact mock shape the file already uses; import `devLogin`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/api.test.js`
Expected: FAIL — `devLogin` is not exported.

- [ ] **Step 3: Implement `devLogin` in `client/src/api.js`**

```js
export function devLogin(name) {
  return apiRequest(`/api/auth/dev-login?user=${encodeURIComponent(name)}`, { method: 'POST' })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/api.js client/src/api.test.js
git commit -m "feat(client): devLogin API helper"
```

---

### Task 4: Quick-login buttons on the login page

**Files:**
- Modify: `client/src/App.jsx` — `handleLogin` area (line ~167) and `LoginPage` (line ~199-229)

**Interfaces:**
- Consumes: `devLogin` from Task 3; existing `setUser` / `setAuthError`.
- Produces: `LoginPage` gains prop `onDevLogin(name: string) -> Promise<void>`.

- [ ] **Step 1: Add `handleDevLogin` next to `handleLogin` in `App`**

```js
const handleDevLogin = async (name) => {
  setAuthError('')
  try {
    const result = await devLogin(name)
    setUser(result.user)
  } catch (error) {
    setAuthError(error.message)
  }
}
```

Pass it: `if (!user) return <LoginPage onSubmit={handleLogin} onDevLogin={handleDevLogin} error={authError} />`.

- [ ] **Step 2: Render the buttons inside `LoginPage`**

After the submit button, still inside `.auth-card`, gated on `import.meta.env.DEV`:

```jsx
{import.meta.env.DEV && (
  <div className="dev-login">
    <p className="subtitle">Masuk cepat (pengembangan)</p>
    {['super', 'officer', 'direksi'].map((name) => (
      <button key={name} type="button" className="button" onClick={() => onDevLogin(name)}>Masuk sebagai {name}</button>
    ))}
  </div>
)}
```

Add `onDevLogin` to the `function LoginPage({ onSubmit, onDevLogin, error })` destructure. `type="button"` keeps them from submitting the form. Add `dev-login { display: grid; gap: 8px; margin-top: 14px; text-align: center; }` to `client/src/auth.css`.

- [ ] **Step 3: Lint and client tests**

Run: `cd client && npm run lint && npm test`
Expected: no new errors, all tests pass.

- [ ] **Step 4: Verify in the browser**

Open `http://localhost:5173`, confirm three buttons appear under the form, click `Masuk sebagai super` → dashboard loads with `super` / `superadmin` in the sidebar. Use the browser tool; take a screenshot as evidence.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx client/src/auth.css
git commit -m "feat(client): dev quick-login buttons on login page"
```
