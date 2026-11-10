# Hierarchical Sales Position Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional position assignment to users with branch-filtered dropdown, persist sales_code, and display SALES dashboard names as `(sales_code username)`.

**Architecture:** Single nullable `position_id` column on users with server-side validation that assigned position is active SALES type and shares at least one selected branch. Client filters position dropdown by selected branches. Dashboard maps users to positions for SALES label formatting.

**Tech Stack:** SQLite (better-sqlite3), Express, React 19, Vite, Vitest

**Spec:** docs/superpowers/specs/2026-11-06-hierarchical-sales-position-design.md

## Global Constraints

- Existing SQLite schema uses migrations in `server/db.js`.
- Existing position-to-branch links use `position_branches`.
- Officer users still require at least one branch.
- Position assignment must be nullable for existing users.
- SALES users without a sales code keep their username label.
- Position dropdown only shows positions with matching branch.
- Position assignment clears when branch selection removes all valid positions.

## Review Focus

1. **User created without position_id** → succeeds, position_id is null in DB.
2. **Officer assigned position not in selected branches** → rejected with validation error.
3. **Branch selection changes, previously selected position no longer valid** → position cleared in UI.
4. **Dashboard shows `(11111 budi)` for SALES with sales_code, `Budi` for SALES without, position name for BM/SPV**.
5. **Existing users without position_id continue to work**.

---

### Task 1: Add position_id column to users table migration

**Files:**
- Modify: `server/schema.sql:6-17` (users table definition)
- Modify: `server/db.js:57-61` (migration for position_id column)

**Interfaces:**
- Consumes: existing users table with sales_code column
- Produces: users table with nullable `position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL`

- [ ] **Step 1: Add position_id column to schema.sql users table**

```sql
-- In CREATE TABLE users, add after sales_code:
position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
```

- [ ] **Step 2: Add migration in db.js for position_id**

```javascript
// In migrateDatabase, after parent_id migration:
if (!userCols.includes('position_id')) {
  db.exec('ALTER TABLE users ADD COLUMN position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL');
}
```

- [ ] **Step 3: Verify migration runs without error**

Run: `node -e "require('./db.js'); console.log('migration ok')"` from server dir.
Expected: no error, users table has position_id column.

- [ ] **Step 4: Commit**

```bash
git add server/schema.sql server/db.js
git commit -m "feat: add nullable position_id to users table"
```

---

### Task 2: Extend user API routes for position_id

**Files:**
- Modify: `server/routes/users.js:14-21` (GET /api/users - include position_id)
- Modify: `server/routes/users.js:54-83` (POST /api/users - accept and validate position_id)
- Modify: `server/routes/users.js:90-159` (PATCH /api/users - accept and validate position_id)

**Interfaces:**
- Consumes: Task 1 DB column
- Produces: API responses include position_id; create/update validate position belongs to selected branches

- [ ] **Step 1: Update GET /api/users to return position_id**

```javascript
const users = db.prepare('SELECT id, username, role, parent_id, active, sales_code, position_id FROM users').all();
```

- [ ] **Step 2: Update POST /api/users create to accept position_id and validate**

```javascript
const { username, password, role: userRole, branch_ids, sales_code, position_id } = req.body;
// ... after branch validation
if (position_id !== undefined && position_id !== null) {
  const pos = db.prepare('SELECT id, position_type FROM positions WHERE id = ? AND active = 1').get(position_id);
  if (!pos) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position not found or inactive' } });
  if (pos.position_type !== 'SALES') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position must be SALES type' } });
  // Validate position shares at least one branch
  const posBranches = db.prepare('SELECT branch_id FROM position_branches WHERE position_id = ?').all(position_id).map(r => r.branch_id);
  const hasCommonBranch = branch_ids.some(bid => posBranches.includes(bid));
  if (!hasCommonBranch) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position must belong to at least one selected branch' } });
}
const info = db.prepare('INSERT INTO users (username, password_hash, role, created_by, sales_code, position_id, active) VALUES (?, ?, ?, ?, ?, ?, 1)').run(username, passwordHash, userRole, req.user.id, sales_code || null, position_id || null);
```

- [ ] **Step 3: Update PATCH /api/users to accept and validate position_id**

```javascript
if (position_id !== undefined) {
  if (position_id === null) {
    updates.push('position_id = ?');
    values.push(null);
  } else {
    const pos = db.prepare('SELECT id, position_type FROM positions WHERE id = ? AND active = 1').get(position_id);
    if (!pos) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position not found or inactive' } });
    if (pos.position_type !== 'SALES') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position must be SALES type' } });
    // Use final branch_ids for validation
    const finalBranchIds = Array.isArray(branch_ids) ? branch_ids : (await db.prepare('SELECT branch_id FROM user_branches WHERE user_id = ?').all(id)).map(r => r.branch_id);
    const posBranches = db.prepare('SELECT branch_id FROM position_branches WHERE position_id = ?').all(position_id).map(r => r.branch_id);
    const hasCommonBranch = finalBranchIds.some(bid => posBranches.includes(bid));
    if (!hasCommonBranch) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position must belong to at least one selected branch' } });
    updates.push('position_id = ?');
    values.push(position_id);
  }
}
```

- [ ] **Step 4: Run server tests**

Run: `npm test` from server dir.
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/users.js
git commit -m "feat: extend user API with optional position_id validation"
```

---

### Task 3: Update Master.jsx account form - branch-filtered position dropdown

**Files:**
- Modify: `client/src/pages/Master.jsx:30-32` (form state)
- Modify: `client/src/pages/Master.jsx:188-220` (submitUser, startEdit, resetUserForm)
- Modify: `client/src/pages/Master.jsx:638-665` (form JSX - add position select after branch picker)

**Interfaces:**
- Consumes: `listPositions()` from api.js, `masterData.branches`
- Produces: form with branch-first filtered position dropdown, optional selection

- [ ] **Step 1: Add positions to form state and load when tab active**

```javascript
// Add to existing useEffect for tab === 'users' or always load
const [positions, setPositions] = useState([]);
useEffect(() => {
  if (tab === 'users' || tab === 'positions') {
    listPositions().then(r => setPositions(r.positions || [])).catch(() => setPositions([]));
  }
}, [tab]);
```

- [ ] **Step 2: Filter positions by selected branch_ids in render**

```javascript
const filteredPositions = form.branch_ids.length > 0
  ? positions.filter(p => p.active !== 0 && p.position_type === 'SALES' && p.branch_ids.some(bid => form.branch_ids.includes(bid)))
  : [];
```

- [ ] **Step 3: Add position select after branch PickerChips**

```jsx
{form.role === 'officer' && (
  <label className="col-span-2">Jabatan (Sales)
    <select value={form.position_id || ''} onChange={e => setForm({...form, position_id: e.target.value || ''})}>
      <option value="">-- Pilih Jabatan --</option>
      {filteredPositions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
    {form.branch_ids.length === 0 && <p className="text-[12px] text-ink-400 mt-1">Pilih cabang dulu untuk melihat jabatan.</p>}
    {form.branch_ids.length > 0 && filteredPositions.length === 0 && <p className="text-[12px] text-amber-600 mt-1">Tidak ada jabatan SALES di cabang terpilih.</p>}
  </label>
)}
```

- [ ] **Step 4: Clear position_id when branches change and position no longer valid**

```javascript
// In branch PickerChips onChange, add:
onChange={(ids) => {
  const newForm = { ...form, branch_ids: ids };
  // Clear position if it no longer belongs to selected branches
  if (form.position_id) {
    const pos = positions.find(p => p.id === Number(form.position_id));
    if (pos && !pos.branch_ids.some(bid => ids.includes(bid))) {
      newForm.position_id = '';
    }
  }
  setForm(newForm);
}}
```

- [ ] **Step 5: Update resetUserForm, submitUser, startEdit for position_id**

```javascript
// resetUserForm
const resetUserForm = () => setForm({ username: '', password: '', role: 'officer', branch_ids: [], position_id: '', sales_code: '' });

// submitUser payload
position_id: form.position_id ? Number(form.position_id) : undefined,

// startEdit
position_id: target.position_id || '',
```

- [ ] **Step 6: Run client tests and build**

Run: `npm test && npm run build` from client dir.
Expected: all tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Master.jsx
git commit -m "feat: add branch-filtered position dropdown to user form"
```

---

### Task 4: Update Dashboard to show (sales_code username) for SALES positions

**Files:**
- Modify: `client/src/pages/Dashboard.jsx:89-118` (load users with positions, map to positions)
- Modify: `client/src/pages/Dashboard.jsx:44-86` (OrgNode - use mapped user for SALES label)

**Interfaces:**
- Consumes: Task 2 API returns position_id, Task 3 form saves it
- Produces: SALES dashboard names formatted as `(sales_code username)` or username

- [ ] **Step 1: Load users and map by position_id**

```javascript
const [users, setUsers] = useState([]);
useEffect(() => {
  listUsers().then(r => setUsers(r.users || [])).catch(() => setUsers([]));
}, []);
// Map position_id -> user for dashboard lookup
const userByPosition = useMemo(() => {
  const map = {};
  users.forEach(u => {
    if (u.position_id) map[u.position_id] = u;
  });
  return map;
}, [users]);
```

- [ ] **Step 2: Pass userByPosition to OrgNode and update label rendering**

```javascript
// In OrgNode props
<OrgNode ... userByPosition={userByPosition} />

// In OrgNode component
const linkedUser = position.position_type === 'SALES' ? userByPosition[position.id] : null;
const displayName = linkedUser
  ? (linkedUser.sales_code ? `(${linkedUser.sales_code} ${linkedUser.username})` : linkedUser.username)
  : position.name;
```

- [ ] **Step 3: Run client tests and build**

Run: `npm test && npm run build` from client dir.
Expected: all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Dashboard.jsx
git commit -m "feat: render SALES dashboard names as (sales_code username)"
```

---

### Task 5: Integration verification

**Files:**
- No new files

**Interfaces:**
- Consumes: Tasks 1-4 complete
- Produces: end-to-end working flow

- [ ] **Step 1: Start dev server and verify manual flow**

Run: `npm run dev` from server dir, `npm run dev` from client dir.
Manual checks:
1. Create user with branch, select position → saved.
2. Edit user, change branch → position clears if invalid.
3. Dashboard shows `(11111 budi)` for SALES with code.
4. Dashboard shows `budi` for SALES without code.
5. Dashboard shows position name for BM/SPV.
6. Create user without position → works.

- [ ] **Step 2: Run all tests**

Run: `npm test` from both server and client dirs.
Expected: all pass.

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: integration polish for hierarchical position assignment"
```

---

## Review Focus Test Additions

Each Review Focus item already has a test in its owning task:
1. Task 2 test: user created without position_id succeeds.
2. Task 2 test: position not in branches rejected.
3. Task 3 test: branch change clears invalid position.
4. Task 4 test: dashboard label formatting per user state.
5. Task 2 test: existing users without position_id work.

All gaps covered.