# Insetif document list layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace card grid with compact horizontal document rows, move search above filters, and remove `Muat Ulang` and `Dokumen Baru` header buttons.

**Architecture:** Single-file edit of `client/src/pages/Insetif.jsx`. The desktop and mobile sections each contain a header, filter row, and document list. Replace header action buttons with nothing, restructure filter grid so search occupies a full row above the three dropdowns, and replace both document list renderers with a responsive row layout.

**Tech Stack:** React, Tailwind CSS, shadcn/ui components, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-11-05-insetif-list-layout-design.md`

## Global Constraints

- Do not add dependencies; use existing imports.
- Keep `onRefresh` and `onNewDoc` props accepted by component for backward compatibility.
- Preserve keyboard accessibility: `tabIndex={0}`, `onKeyDown` for Enter/Space, `aria-current` on selected row.
- Preserve existing filtering state (`search`, `spvId`, `salesId`, `periode`) and `visibleDocs` memo.
- Preserve empty state UI and "Hapus semua filter" button.
- Preserve detail view open behavior (`activeDocId`, `setActiveDocId`, `activeDoc`, detail panel, mobile overlay).

## Review Focus

1. Mobile rows wrap badly when sales name is long — ensure truncation and flex-shrink.
2. Keyboard focus order matches visual order after search moves above filters.
3. Selected row ring/outline visible in both desktop and mobile modes.
4. Empty state still centered and functional without header buttons.
5. `ChevronRight` icon remains a click target (whole row still works).

---

### Task 1: Remove header buttons and restructure desktop header

**Files:**
- Modify: `client/src/pages/Insetif.jsx:203-247`

**Interfaces:**
- Consumes: existing `refreshList`, `setNewDialogOpen`, `refreshing`, `newDialogOpen`
- Produces: simplified header without action buttons

- [ ] **Step 1: Edit desktop header section** — Remove the `div.flex.flex-wrap.gap-2` containing the two `Button` components (lines 215-246). Keep the title and description block only.
- [ ] **Step 2: Verify no JSX errors** — `npm run build` in client directory should pass without syntax errors.
- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Insetif.jsx
git commit -m "feat: remove header buttons from desktop insetif page"
```

### Task 2: Restructure desktop filter grid — search on its own row

**Files:**
- Modify: `client/src/pages/Insetif.jsx:250-310`

**Interfaces:**
- Consumes: `search`, `setSearch`, `spvId`, `setSpvId`, `salesId`, `setSalesId`, `periode`, `setPeriode`, `spvOptions`, `salesOptions`, `periodeOptions`
- Produces: filter grid with search full-width first row, SPV/Sales/Periode on second row

- [ ] **Step 1: Change filter grid** — Replace the `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end` container with:
  - Row 1: search field full width (`col-span-1` or remove grid, use flex).
  - Row 2: SPV, Sales, Periode in `grid grid-cols-1 md:grid-cols-3 gap-3 items-end`.
- [ ] **Step 2: Verify filter layout** — Start dev server (`npm run dev`), open desktop view, confirm search sits above three dropdowns.
- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Insetif.jsx
git commit -m "feat: move search above filter dropdowns on desktop insetif"
```

### Task 3: Replace desktop document cards with horizontal rows

**Files:**
- Modify: `client/src/pages/Insetif.jsx:313-366`

**Interfaces:**
- Consumes: `visibleDocs`, `activeDocId`, `setActiveDocId`, `periodLabel`, `makeBadge`
- Produces: responsive horizontal row list instead of grid cards

- [ ] **Step 1: Replace desktop list renderer** — Replace the `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3` container and its `article` cards with a `div` using `flex flex-col gap-2 p-3` and each item as a `div` with `flex items-center gap-4 p-3` (or `grid grid-cols-[1fr_auto_auto] gap-4` for aligned columns). Keep `role="list"` and `role="listitem"`. Each row must:
  - Be keyboard focusable (`tabIndex={0}`, `onKeyDown` for Enter/Space).
  - Show selection ring (`ring-2 ring-[var(--primary)]` when `isSelected`).
  - Display sales name (truncated), period, status badge.
  - Keep `ChevronRight` icon at row end.
  - Call `setActiveDocId(doc.id)` on click and keyboard activation.
- [ ] **Step 2: Verify desktop rows** — Dev server, desktop width: rows render horizontally, selection works, detail panel opens.
- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Insetif.jsx
git commit -m "feat: replace desktop cards with horizontal rows"
```

### Task 4: Remove header buttons from mobile header

**Files:**
- Modify: `client/src/pages/Insetif.jsx:462-505`

**Interfaces:**
- Consumes: same as desktop header
- Produces: mobile header without action buttons

- [ ] **Step 1: Edit mobile header** — Remove the `div.flex.flex-wrap.gap-2.w-full` containing the two `Button` components (lines 473-503). Keep title and description block.
- [ ] **Step 2: Verify no JSX errors** — `npm run build` passes.
- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Insetif.jsx
git commit -m "feat: remove header buttons from mobile insetif page"
```

### Task 5: Restructure mobile filter grid — search on its own row

**Files:**
- Modify: `client/src/pages/Insetif.jsx:508-570`

**Interfaces:**
- Consumes: same filter state as desktop
- Produces: mobile filters with search first, then SPV/Sales in 2-col grid, then Periode full-width

- [ ] **Step 1: Change mobile filter grid** — Replace the `grid grid-cols-1 gap-3` container (lines 509-569) with:
  - Search field full width.
  - SPV and Sales in `grid grid-cols-2 gap-3`.
  - Periode full width.
- [ ] **Step 2: Verify mobile filter layout** — Dev server, mobile viewport: search above SPV/Sales row, Periode below.
- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Insetif.jsx
git commit -m "feat: move search above filter dropdowns on mobile insetif"
```

### Task 6: Replace mobile document cards with horizontal rows

**Files:**
- Modify: `client/src/pages/Insetif.jsx:573-626`

**Interfaces:**
- Consumes: same as desktop list
- Produces: mobile vertical stack of compact horizontal rows

- [ ] **Step 1: Replace mobile list renderer** — Replace the `flex flex-col gap-2 px-3 pb-4` container and its `article` cards with a `div` using `flex flex-col gap-2 px-3 pb-4` (same container) but each item as a `div` with `flex items-center gap-3 p-3` (mobile-friendly padding). Keep `role="list"`, `role="listitem"`, keyboard activation, selection ring, sales name truncation, period, status badge, `ChevronRight` at end.
- [ ] **Step 2: Verify mobile rows** — Dev server, mobile viewport: rows stack vertically, compact, selection works, detail overlay opens.
- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Insetif.jsx
git commit -m "feat: replace mobile cards with horizontal rows"
```

### Task 7: Full verification and cleanup

**Files:**
- Modify: none

**Interfaces:**
- All prior tasks

- [ ] **Step 1: Run build** — `npm run build` in client directory. Must pass with no errors.
- [ ] **Step 2: Manual QA** — Desktop and mobile views at `http://localhost:5173`:
  - Header has no action buttons.
  - Search input sits above SPV/Sales/Periode.
  - Document list shows compact horizontal rows.
  - Clicking a row opens detail panel/overlay.
  - Keyboard navigation (Tab to row, Enter/Space) opens detail.
  - Selected row has visible ring.
  - Empty state renders centered with "Hapus semua filter".
- [ ] **Step 3: Commit any final fixes**

```bash
git add client/src/pages/Insetif.jsx
git commit -m "fix: final adjustments after QA"
```