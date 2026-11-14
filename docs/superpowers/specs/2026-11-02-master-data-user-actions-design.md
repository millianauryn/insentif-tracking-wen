# Master Data Rename + User Row Actions — Design

Date: 2026-11-02
Status: awaiting approval
Size: small change

## Intent

The super-admin page keeps a dead "Nonaktifkan" action that created the
lockout bug (deactivated accounts with no way back), and the page name no
longer matches how the user thinks of it. Replace the deactivate action with
delete and edit, and rename the page to Master Data.

## Goals

- Sidebar entry `Administrasi` → `Master Data`; page header follows
  (`ADMINISTRASI / SUPER ADMIN` → `MASTER DATA / SUPER ADMIN`,
  `Administrasi Sistem` → `Master Data`). Inner tabs unchanged
  (Pengguna / Kriteria Dokumen / Data Master).
- Each user row shows two icon buttons instead of `Nonaktifkan`:
  - Trash icon: `window.confirm`, then `DELETE /api/users/:id`, then
    refresh. Server's "cannot delete the only Super Admin" 403 surfaces
    through the existing `error` slot above the tabs.
  - Pencil icon: loads that user into the existing "Tambah Pengguna" form.
- The top form becomes one reusable form with two modes:
  - mode `create` (unchanged behavior, heading "Tambah Pengguna").
  - mode `edit` — heading "Edit Pengguna", prefilled username + role,
    password optional (empty = unchanged, PATCH omits it), submit calls
    `updateUser(id, payload)`, `Batal` cancels back to create.
- `deactivateUser` and the `Nonaktifkan` button are removed. Rows keep
  showing `Aktif` / `Nonaktif` labels; inactive rows can be edited or
  deleted (PATCH `active` stays available server-side for later).

## Non-goals / anti-goals

- No reactivate button (delete covers cleanup; server PATCH still supports
  `active` if a toggle returns later).
- No modal, no inline row form — one form instance, reused.
- No server changes: `DELETE /api/users/:id` and `PATCH /api/users/:id`
  already exist and validate.
- Tabs, criteria tab, and master-data tab untouched.

## Approaches considered

1. **Reuse top form with mode state (chosen)** — `editingUser` state on the
   existing form; one place to change future field logic.
2. **Inline per-row editor** — rejected: duplicated field markup per row,
   more code, two places to change on every future field edit.

## How it gets built (decided)

- `AdminView` (`client/src/App.jsx`):
  - state: `editingUser` (`null | { id, username, role }`).
  - `form` gains no new fields; submit handler branches on `editingUser`:
    create → `createUser(form)`, edit → `updateUser(editingUser.id, { username, role, password: form.password || undefined })`.
  - `submitEdit`-free design: one `onSubmit` branches (reuses `addUser`).
  - cancel resets `editingUser = null` and clears `form`.
  - row actions: pencil (set `editingUser` + prefill `form`, scroll/focus
    form heading), trash (confirm → `deleteUser` → `onRefresh`).
  - `removeUser` error path reuses existing `setError`.
- Sidebar + header copy renamed (string-only changes).
- Icons: inline SVG (trash, pencil) styled as `icon-button` — no new deps.

## Open items

- None. Build follows this document.
