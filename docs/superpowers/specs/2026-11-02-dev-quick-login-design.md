# Dev Quick-Login Buttons — Design

Date: 2026-11-02
Status: awaiting approval
Size: small change

## Intent

Development is blocked: every account in the local database is deactivated
(`active = 0`), so login always returns 401, and repeated retries exhausted the
auth rate limiter. The developer needs one-click access to the three roles
without typing passwords or fighting the limiter.

## Goals

- Three quick-login buttons on the login page, visible in development only.
- Accounts: `super` (superadmin), `officer` (officer), `direksi` (observer).
- Clicking a button creates a real session cookie and enters the app.
- Accounts are always usable: missing or deactivated rows are restored on click.
- Rate limiter never blocks dev quick-login.

## Non-goals / anti-goals

- No change to the normal username/password login flow.
- The dev path must never respond in production (`NODE_ENV === 'production'`).
- No password is exposed to the client bundle.

## Approaches considered

1. **Dev-only endpoint (chosen)** — `POST /api/auth/dev-login?user=<name>`
   creates or repairs the account and issues a session. Buttons appear only
   when `import.meta.env.DEV`. No password in the bundle, self-healing after a
   DB wipe, exempt from the rate limiter.
2. **Prefill + normal login** — buttons fill the form and POST to the existing
   endpoint. Rejected: password would ship in the client bundle, the 10-per-15-min
   rate limit still locks development, and a wiped DB fails silently.

## How it gets built (decided)

- **Server**: `POST /api/auth/dev-login` in `server/index.js`.
  - Guard first: allow the request only when `NODE_ENV` is explicitly
    `development` or `test` (anything else, including unset — fail closed —
    returns 404).
  - Allowed users map: `super → superadmin`, `officer → officer`,
    `direksi → observer`. Unknown name → 404.
  - Upsert: if the username is missing or `active = 0`, write it back with
    `active = 1` and the role from the map. Password hash is set to a random
    value only when the row is created (never used for this path).
  - Reuses `createSession` and the same `session_token` cookie options as
    `/api/auth/login`.
  - No `authLimiter` on this route.
- **Client**: `LoginPage` in `client/src/App.jsx` renders three buttons under
  the form when `import.meta.env.DEV`. Each calls a new `devLogin(name)` in
  `client/src/api.js` (POST to `/api/auth/dev-login`), then feeds the returned
  user into the existing login success handling.
- **Existing inactive rows**: `superadmin`, `tes`, `ter` stay as they are.
  New accounts are added alongside; nothing is deleted or renamed.

## Open items

- None. Build follows this document.
- Post-review change (2026-11-02): the production guard was tightened from
  `NODE_ENV === 'production'` to an explicit `development`/`test` allowlist
  after review flagged that an unset `NODE_ENV` would leave the endpoint
  live. `npm run dev` now sets `NODE_ENV=development`; `npm start` and any
  runtime without that env fail closed (404).
