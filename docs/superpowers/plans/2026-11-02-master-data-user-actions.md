# Master Data Rename + User Row Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the super-admin page to Master Data and replace the dead `Nonaktifkan` action with delete and edit icons backed by one reusable top form.

**Architecture:** String-only rename in sidebar/header, plus `AdminView` gains `editingUser` state: the existing "Tambah Pengguna" form switches between create and edit modes; row icons drive `window.confirm` + `deleteUser` or prefill the form. No server changes, no new dependencies.

**Tech Stack:** React 19 (single-file `App.jsx`), inline SVG icons, oxlint + vitest (pure-function tests only), browser walkthrough for UI flows.

**Spec:** `docs/superpowers/specs/2026-11-02-master-data-user-actions-design.md`

## Global Constraints

- Sidebar label `Administrasi` → `Master Data`; header eyebrow `ADMINISTRASI / SUPER ADMIN` → `MASTER DATA / SUPER ADMIN`; `Administrasi Sistem` → `Master Data`. Inner tabs (Pengguna / Kriteria Dokumen / Data Master) unchanged.
- One form instance only: no inline row editors, no modal.
- Edit submit sends `password` only when the field is non-empty (`password: form.password || undefined`).
- Delete always goes through `window.confirm` first; server 403 (last superadmin) renders through the existing `error` slot (`AdminView` top, `role="alert"`).
- `deactivateUser` and the `Nonaktifkan` button are removed entirely; `Aktif`/`Nonaktif` labels stay.
- No new npm dependencies; icons are inline SVG using the existing `icon-button`/`text-button` classes.
- No server file changes.

## Review Focus

- Form must reset cleanly between modes — a stale edit payload hitting the create button would rename the wrong user. Pinned in Task 2, browser step "cancel returns form to create mode".
- Password left blank on edit must not PATCH an empty string (server would reject <6 chars or worse, overwrite with blank). Pinned in Task 2, browser step "edit without password keeps login working".
- Deleting the logged-in superadmin or the last superadmin must surface an error, not silently vanish. Pinned in Task 3, browser step "delete last superadmin shows error".

---

### Task 1: Rename page to Master Data

**Files:**
- Modify: `client/src/App.jsx` (Sidebar nav label line ~248, AdminView header lines ~717-719)

**Interfaces:**
- Consumes: none.
- Produces: none (copy change).

- [ ] **Step 1: Apply the three string renames**

Sidebar button text `Administrasi` → `Master Data` (the `{canManageAdmin(user) && ...}` button, its `view === 'admin'` key stays `admin`). Header: eyebrow `ADMINISTRASI / SUPER ADMIN` → `MASTER DATA / SUPER ADMIN`; `<h1>Administrasi Sistem</h1>` → `<h1>Master Data</h1>`.

- [ ] **Step 2: Verify no stale copy**

Run: `grep -n "Administrasi" client/src/App.jsx`
Expected: only `aria-label="Tab administrasi"` remains (a11y label, allowed) — no visible `Administrasi` strings.

- [ ] **Step 3: Lint**

Run: `cd client && npm run lint`
Expected: clean.

---

### Task 2: Reusable create/edit form + pencil icon

**Files:**
- Modify: `client/src/App.jsx` — `AdminView` state (`activeTab`, `form` line ~274-276), `addUser` (line ~278), user row render (line ~754), users-tab form heading (line ~733-744)

**Interfaces:**
- Consumes: `updateUser(id, input)` from `./api` (already imported).
- Produces: `editingUser: null | { id, username, role }` state; single submit handler branching create/edit; pencil action `startEdit(user)`.

- [ ] **Step 1: Add `editingUser` state and branch the submit**

Next to `const [form, setForm] = ...` add `const [editingUser, setEditingUser] = useState(null)`. Rework `addUser` into one handler `submitUser` used by the form's `onSubmit`:

- if `editingUser` is `null`: current `createUser(form)` flow (unchanged).
- else: `await updateUser(editingUser.id, { username: form.username.trim(), role: form.role, password: form.password || undefined })`.
- success in edit mode → `setEditingUser(null)`, reset `form` to `{ username: '', password: '', role: 'officer' }`, `onRefresh()`.
- failure → `setError(requestError.message)` (unchanged pattern).

Add `cancelEdit` → `setEditingUser(null)` + reset `form`.

- [ ] **Step 2: Mode-aware heading and button labels**

Heading: `editingUser ? 'Edit Pengguna' : 'Tambah Pengguna'`, subtitle: `editingUser ? `Mengubah ${editingUser.username}.` : 'Berikan akses sesuai peran kerja.'`. Submit button: `editingUser ? 'Simpan Perubahan' : 'Tambah Pengguna'`. Add a `type="button"` `Batal` button rendered only when `editingUser` (class `text-button`), calling `cancelEdit`.

- [ ] **Step 3: Pencil icon in the row**

Replace nothing yet — add before the (now removed in Task 3) action slot: a `type="button"` `icon-button` with `aria-label={`Edit ${user.username}`}` and an inline pencil SVG (`path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"`). `onClick` → `startEdit(user)`: `setEditingUser({ id: user.id, username: user.username, role: user.role })`, `setForm({ username: user.username, password: '', role: user.role })`, `setError('')`.

- [ ] **Step 4: Lint + suite**

Run: `cd client && npm run lint && npm test`
Expected: clean, 10/10 pass.

- [ ] **Step 5: Browser verification of edit flow (also covers Review Focus 1+2)**

With a logged-in superadmin on the Administrasi/Master Data page:
1. Click pencil on user `officer` → form heading `Edit Pengguna`, username prefilled `officer`.
2. Change role to `Observer`, leave password blank → `Simpan Perubahan` → row shows `observer`.
3. Log out, log in as that account with its old password → succeeds (blank password untouched).
4. Click `Batal` → heading returns to `Tambah Pengguna`, fields cleared (cancel returns form to create mode).

---

### Task 3: Delete icon replacing Nonaktifkan

**Files:**
- Modify: `client/src/App.jsx` — `deactivateUser` (line ~290), user row action slot (line ~759-763)

**Interfaces:**
- Consumes: `deleteUser(id)` from `./api` (already imported), `error` slot at AdminView top.
- Produces: `removeUser(id)` with confirm + delete + refresh.

- [ ] **Step 1: Replace `deactivateUser` with `removeUser`**

```js
const removeUser = async (id) => {
  const target = data.users.find((u) => u.id === id)
  if (!window.confirm(`Hapus pengguna ${target?.username}?`)) return
  try {
    await deleteUser(id)
    await onRefresh()
  } catch (requestError) {
    setError(requestError.message)
  }
}
```

Delete the old `deactivateUser` function.

- [ ] **Step 2: Row action slot**

Remove the `user.active ? <button ...>Nonaktifkan</button> : <span />` conditional. Row actions become: pencil icon (Task 2) + trash icon — `type="button"` `icon-button`, `aria-label={`Hapus ${user.username}`}`, inline trash SVG (`path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"`), `onClick={() => removeUser(user.id)}`.

- [ ] **Step 3: Lint + suite**

Run: `cd client && npm run lint && npm test`
Expected: clean, 10/10 pass.

- [ ] **Step 4: Browser verification (covers Review Focus 3)**

1. Create throwaway user `officer` → row appears.
2. Click trash on `officer` → confirm dialog → accept → row gone.
3. Click trash on `super` (last superadmin) → confirm → `form-error` alert shows server's `Cannot delete the only Super Admin`.
4. Row for inactive user (if any, e.g. `ter`) still shows `Nonaktif` label and both icons work.
