# Dashboard Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard the default local development view while preserving the Sales incentive input flow.

**Architecture:** Keep one React app with a lightweight view state (`dashboard` or `document`) instead of adding a router. Derive dashboard metrics from existing `rows` and reuse the current `localStorage` model. Build charts with semantic HTML and CSS, not a new chart dependency.

**Tech Stack:** React 19, Vite, CSS, Vitest, Oxlint, Express unchanged.

**Spec:** `docs/superpowers/specs/2026-10-30-dashboard-home-design.md`

## Global Constraints

- Keep development work on branch `develop`.
- Keep data in existing `localStorage` storage model.
- Do not add database, authentication, PDF export, router, or chart dependency.
- Use existing inline SVG icon pattern.
- Preserve calculation rules: `>= 100%` is `Tercapai`; `< 100%` is `Gugur`.
- Keep keyboard focus states and responsive layouts.
- Do not add fake rows to persisted data.

## Review Focus

- Empty localStorage: dashboard shows a clear empty state and zero-safe metrics.
- One or more filled rows: KPI values and status distribution match existing calculations.
- Navigation: Dashboard is default; Dokumen Insentif opens existing input view.
- Input preservation: returning from dashboard to document keeps current state and localStorage behavior.
- Responsive layout: no clipped dashboard content at mobile width.

---

### Task 1: Add dashboard metric derivation

**Files:**
- Modify: `client/src/incentive.js`
- Test: `client/src/incentive.test.js`

**Interfaces:**
- Produces `getDashboardMetrics(rows)` returning `{ totalTarget, totalAchievement, percentage, achievedCount, failedCount, documentCount, monthly }`.
- `monthly` is a fixed array of four objects `{ label, target, achievement }` derived from available rows without adding persisted rows.

- [ ] **Step 1: Write failing tests** for empty rows and filled rows. Assert zero-safe output, status counts, total percentage, and numeric monthly values.
- [ ] **Step 2: Run `npm test -- --run client/src/incentive.test.js` and confirm failure.**
- [ ] **Step 3: Implement `getDashboardMetrics(rows)` with existing `calculateTotals` and `calculateRow` rules.**
- [ ] **Step 4: Run focused tests and confirm pass.**
- [ ] **Step 5: Commit:** `test: cover dashboard metric derivation` and `feat: derive dashboard metrics` as separate commits if implementation warrants it.

### Task 2: Add dashboard and navigation composition

**Files:**
- Modify: `client/src/App.jsx`

**Interfaces:**
- `App` owns `view` state with default `'dashboard'`.
- Sidebar navigation calls `setView('dashboard')` or `setView('document')`.
- Dashboard receives `{ metrics, onCreateDocument }`.
- Existing document form remains available without changing its row update callbacks.

- [ ] **Step 1: Add dashboard view state and import `getDashboardMetrics`.**
- [ ] **Step 2: Add accessible sidebar navigation buttons or links with active state.**
- [ ] **Step 3: Render Dashboard by default and existing document form when `view === 'document'`.**
- [ ] **Step 4: Add `Dashboard` component with header, period selector, KPI cards, CSS chart data, status summary, recent document list, and empty state.**
- [ ] **Step 5: Add `Buat Dokumen` action that changes view to `document`.**
- [ ] **Step 6: Run `npm run lint` and `npm run build`.**
- [ ] **Step 7: Commit:** `feat: make dashboard the default view`.

### Task 3: Restyle dashboard for supplied visual direction

**Files:**
- Modify: `client/src/App.css`
- Modify: `client/src/index.css`

**Interfaces:**
- Keep existing class names needed by document view.
- Add dashboard styles for dark sidebar, light canvas, KPI grid, chart panel, status ring/bar, recent activity, and responsive breakpoints.

- [ ] **Step 1: Add design tokens for navy sidebar, lavender surfaces, blue primary, green success, amber warning, and neutral text.**
- [ ] **Step 2: Style dashboard layout to resemble supplied reference without copying its branding or exact layout.**
- [ ] **Step 3: Add mobile layout at `max-width: 720px` and preserve visible focus states.**
- [ ] **Step 4: Run `npm run lint` and `npm run build`.**
- [ ] **Step 5: Commit:** `style: align dashboard with financial analytics direction`.

### Task 4: Verify local runtime and branch

**Files:**
- Modify: `README.md` if local dashboard workflow needs documentation.

- [ ] **Step 1: Run `npm test` in `client/`.**
- [ ] **Step 2: Run `npm run lint` in `client/`.**
- [ ] **Step 3: Run `npm run build` in `client/`.**
- [ ] **Step 4: Run local Vite server and inspect dashboard at desktop and mobile viewport sizes.**
- [ ] **Step 5: Confirm browser console has no errors and navigation reaches document view.**
- [ ] **Step 6: Run `git status --short --branch` and ensure work is on `develop`.**
- [ ] **Step 7: Push verified commits to `origin/develop`.**
