# Hierarchical Sales Position Assignment

## Intent

Let superadmins assign a user to a position through a branch-first flow. Show only positions linked to selected branches. Store the assignment so edits and dashboard labels remain consistent.

## Goals

- Add nullable `position_id` assignment to users.
- Filter position choices by selected user branches.
- Keep `sales_code` in create and edit flows.
- Render SALES dashboard names as `(sales_code username)`.
- Keep BM and SPV dashboard names unchanged.

## Non-goals

- Change position hierarchy rules.
- Change branch or position master-data screens.
- Add new dependencies.
- Rename existing usernames or position names.

## Constraints

- Existing SQLite schema uses migrations in `server/db.js`.
- Existing position-to-branch links use `position_branches`.
- Officer users still require at least one branch.
- Position assignment must be nullable for existing users.
- SALES users without a sales code keep their username label.

## Approaches

1. Persist `position_id` on `users` (chosen). This supports reliable edit state and dashboard mapping with one nullable column and existing APIs.
2. Filter positions only in the browser. This cannot reliably restore assignments or map users on the dashboard, so it is rejected.

## Design

- Add `position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL` to the schema and migration.
- Extend user list, create, and update routes with `position_id`.
- Validate assigned position exists, is active, has type `SALES`, and shares at least one selected branch.
- Clear position assignment when no valid branch selection remains.
- Load positions when the account form opens or the positions data is available.
- Render branch selection first, then a position select filtered by selected branches.
- Clear selected position when branch changes and it no longer belongs to selected branches.
- Load users on dashboard and map `position_id` to users for SALES labels.

## Verification

Run server tests, client tests, and production build. Add focused tests for position persistence and branch filtering if existing test structure supports them.
