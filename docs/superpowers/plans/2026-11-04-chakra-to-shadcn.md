# Chakra Removal + shadcn (21st.dev-style) Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete every trace of Chakra UI and run all screens on shadcn-style components (official shadcn registry, 21st.dev as visual reference), themed to the user's new palette, with the taste gate kept green.

**Architecture:** Chakra survives in only four places (Layout.jsx, main.jsx provider wrap, documents.smoke.test.jsx, components/ui snippets, theme.js). Those get translated to local shadcn components + Tailwind. shadcn components live in `client/src/components/ui/` (shadcn convention), themed with the user's WIP palette (teal #0f6b58 scale, canvas #f4f8f6) which must move into CSS variables before `theme.js` dies. Paper print CSS and its table preview styles are byte-untouched.

**Tech Stack:** React 19 + Vite + Tailwind v4, shadcn CLI (official registry, MIT, no key), radix-ui primitives, `ui-ux-pro-max` skill (design guidelines), `design-taste-frontend` (quality gate).

**Spec:** `docs/superpowers/specs/2026-11-04-chakra-to-shadcn-design.md`

## Global Constraints

- User's uncommitted WIP redesign (+1102 lines: Dashboard house-CSS rewrite, Login/auth redesign, palette retune in theme.js/index.css/App.css, Layout micro-tweaks) is user work — preserve every visual decision; commit it first as its own checkpoint, never revert.
- Paper format byte-identical: print CSS block in App.css and `.table-wrap`/`.golongan-header`/`.kriteria-header` screen-preview styles not restyled; kwitansi/golongan/kriteria markup untouched.
- Palette: brand teal `#0f6b58`/`#0c5848`/`#0a493c`, canvas `#f4f8f6`, fg `#16221e`/`#58665f`/`#6c7a73`, border `#e2e9e6` (from user's theme.js WIP) — these values must survive after theme.js is deleted.
- No violet/gradient/glass, greys >= 4.5:1 (taste rules).
- Gates after every task: `npm test` client (27+ tests), `npm run lint` (0 errors); full taste gate in Task 7.
- No 21st API key — shadcn official registry only (`npx shadcn@latest`).

## Review Focus

- **Print regression:** swapping Layout/buttons must not change what prints. Test: print-to-PDF pass of `/documents/sales` in Task 7; assert Cetak button still hidden (`button { display: none !important }` in print block) and paper table sizes unchanged.
- **WIP palette loss:** deleting theme.js drops the only copy of the new teal scale if CSS vars were never bridged. Test: Task 4 greps index.css for `#0f6b58` and `#f4f8f6` before deleting; inspect dashboard shows the same colors after.
- **ChakraProvider removal breaks smoke test:** documents.smoke.test.jsx wraps Layout in ChakraProvider (lines 54-66). Test: `npx vitest run src/pages/documents.smoke.test.jsx` passes after Task 6 without importing @chakra-ui.
- **shadcn init restyles index.css:** the CLI appends its own CSS variable block. Test: after Task 3, `git diff client/src/index.css` reviewed — only additive vars, house `@theme` tokens untouched; taste `lint.mjs --app` still 0/0.
- **Layout conversion regressions:** mobile drawer, hamburger, nav active states, sticky header. Test: `node scripts/ui-smoke.mjs http://localhost:5173/dashboard` 0 errors + inspect at 390px shows hamburger and drawer.

---

### Task 1: Checkpoint user WIP

**Files:**
- Modify: all currently-modified client files (commit only)

- [ ] **Step 1: Run client tests + lint on the WIP**

Run: `cd client && npm test && npm run lint`
Expected: tests pass (allow the known loaded-machine timeout, config already raised to 15s), lint 0 errors. If a test fails from the WIP itself, report to the user before committing.

- [ ] **Step 2: Commit the WIP as its own commit**

```bash
git add client/src client/index.html
git commit -m "wip: user redesign pass - dashboard house-CSS, login/auth refresh, palette retune"
```

Expected: commit created; `git status` clean for client files.

### Task 2: Install ui-ux-pro-max skill

**Files:**
- Create: `~/.config/opencode/skills/ui-ux-pro-max/` (via installer)

- [ ] **Step 1: Install the skill**

Run: `npx -y skills add nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max -g -y`
Expected: install succeeds; note the installed path.

- [ ] **Step 2: Verify registration**

Check: the skill appears in the available-skills list (or its SKILL.md exists at the install path).
Expected: SKILL.md present.

### Task 3: shadcn init + component set

**Files:**
- Create: `client/components.json`, `client/src/components/ui/{button,badge,breadcrumb,avatar,input,tabs,dialog,card,select}.jsx` (shadcn CLI output; JSX via `--typescript false` if offered, else TSX adapted to .jsx)
- Modify: `client/package.json` (radix/cva/clsx/tailwind-merge deps), `client/src/index.css` (additive shadcn CSS vars only)

- [ ] **Step 1: Init shadcn in client/**

Run: `cd client && npx shadcn@latest init -y` (answer defaults: new-york style, CSS entry `src/index.css`, React + Vite detected)
Expected: `components.json` created; diff of index.css is additive (shadcn `--background`, `--primary`... vars appended/merged), house `@theme` block untouched.

- [ ] **Step 2: Add the component set**

Run: `cd client && npx shadcn@latest add button badge breadcrumb avatar input tabs dialog card select -y`
Expected: files under `src/components/ui/`; `npm run build` passes.

- [ ] **Step 3: Theme the components to the WIP palette**

Edit: `src/index.css` shadcn vars — `--primary: #0f6b58`, `--primary-foreground: #ffffff`, `--background: #f4f8f6`, `--foreground: #16221e`, `--muted-foreground: #58665f`, `--border: #e2e9e6`, `--radius: 9px` (match house radii).
Expected: `npx vitest run` 27/27, taste `lint.mjs --app client/src` still 0/0.

- [ ] **Step 4: Commit**

```bash
git add client/components.json client/package.json client/package-lock.json client/src/components/ui client/src/index.css
git commit -m "feat: shadcn component set (button, badge, breadcrumb, avatar, input, tabs, dialog, card, select) themed to brand"
```

### Task 4: Palette bridge (theme.js → CSS variables)

**Files:**
- Modify: `client/src/index.css` (ensure every theme.js value has a home), `client/src/theme.js` (delete in Task 6)

- [ ] **Step 1: Audit theme.js values against index.css**

Check: grep index.css for each theme.js token: `#e9f4f0 #d8ebe4 #b8ddd1 #17836c #0f6b58 #0c5848 #0a493c #083a30`, `#f4f8f6`, `#16221e #58665f #6c7a73`, `#e2e9e6`, paper colors `#fef9e7 #d5f5e3 #d6eaf8 #fcf3cf #f8fafc`, radii `7px 9px 11px`, fontSizes `11px 12px 13px`.
Expected: missing values (used by Layout Chakra props: brand scale, fg.*, border.default, radii, fontSizes) added to index.css `@theme` as `--color-brand-*`, `--color-fg-*`, etc. Paper colors already live in App.css — confirm, don't duplicate.

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "feat: bridge theme.js tokens into tailwind theme vars"
```

### Task 5: Layout.jsx off Chakra

**Files:**
- Modify: `client/src/components/Layout.jsx`

**Interfaces:**
- Consumes: shadcn `Button` (variants `default|outline|ghost`), `Avatar` from `src/components/ui/`; house classes `nav-item`, `nav-item-active` unchanged.
- Produces: Layout with zero `@chakra-ui` imports; same DOM semantics (aside/header/main/footer, `data-` free), same class names on nav links.

- [ ] **Step 1: Translate Chakra primitives to Tailwind/shadcn**

Replace: `Box/Flex/Span/Text` → `div/span/p` with equivalent Tailwind classes (keep every existing className, fontSize, color value from the WIP exactly); `IconButton` → shadcn `Button variant="ghost" size="icon"` with lucide child; `Avatar` (custom component, already house-made — keep it, it is not Chakra) stays; brand colors `bg="brand.600"` → `bg-[#0f6b58]` or `bg-brand-600` (Tailwind token from Task 4).
Expected: file has no `@chakra-ui` import; grep confirms.

- [ ] **Step 2: Verify render**

Run: `node scripts/ui-smoke.mjs http://localhost:5173/dashboard` and `node scripts/ui-smoke.mjs http://localhost:5173/documents/sales`
Expected: SMOKE OK, 0 errors both; body text still shows sidebar nav + breadcrumb.

- [ ] **Step 3: Fix the smoke test wrapper**

Edit `client/src/pages/documents.smoke.test.jsx`: remove ChakraProvider import/wrap (lines ~54-66), render Layout directly.
Run: `npx vitest run src/pages/documents.smoke.test.jsx` → 3/3 pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Layout.jsx client/src/pages/documents.smoke.test.jsx
git commit -m "refactor: Layout off Chakra onto tailwind + shadcn button"
```

### Task 6: Delete all remaining Chakra

**Files:**
- Delete: `client/src/components/ui/{provider,toaster,tooltip,color-mode}.jsx`, `client/src/theme.js`
- Modify: `client/src/main.jsx` (drop ChakraUiProvider import/wrap), `client/package.json` (remove `@chakra-ui/react`, `@emotion/react`), `client/src/pages/documents.smoke.test.jsx` (any leftover)

- [ ] **Step 1: Remove provider wrap + snippets + theme**

Edit main.jsx: delete line 8 import and the `<ChakraUiProvider>` wrapper (keep QueryClient/Auth/Toast/Confirm hierarchy identical).
Delete the four snippet files and theme.js.
Expected: `grep -r chakra client/src` → 0 hits; `grep -r "from '.*theme'" client/src` → 0 hits.

- [ ] **Step 2: Remove dependencies**

Run: `cd client && npm uninstall @chakra-ui/react @emotion/react`
Expected: package.json clean; `npm run build` passes.

- [ ] **Step 3: Full client verification**

Run: `cd client && npm test && npm run lint`
Expected: all tests pass, 0 lint errors.

- [ ] **Step 4: Commit**

```bash
git add -A client/src client/package.json client/package-lock.json
git commit -m "refactor: remove Chakra UI entirely (deps, provider, snippets, theme)"
```

### Task 7: shadcn controls across screens + full gate

**Files:**
- Modify: `client/src/pages/Master.jsx` (tabs → shadcn `Tabs`, status text → `Badge`, pager buttons → `Button`), `client/src/pages/Login.jsx` (inputs → `Input`, submit → `Button`), `client/src/pages/Documents.jsx` (toolbar buttons → `Button`, status → `Badge`; paper tables untouched), `client/src/pages/Dashboard.jsx` (action buttons → `Button`, status pill → `Badge`), `client/src/components/Modal.jsx` (→ shadcn `Dialog` only if diff stays small; otherwise keep and note)

**Interfaces:**
- Consumes: shadcn components from Task 3 with brand theme from Task 3 Step 3.
- Produces: screens with zero hand-rolled button/badge/tab markup where a shadcn component exists; house print classes preserved.

- [ ] **Step 1: Swap controls screen by screen (Dashboard → Login → Master → Documents)**

Rule: replace markup only where a shadcn component exists and the swap does not touch print CSS selectors (`.button` class in print-hidden `button { display: none !important }` covers both, so `<Button>` renders as `<button>` and stays hidden in print — safe). Keep all text, ordering, handlers, and house classes that print CSS targets (`.print-title`, `.doc-meta`, `.draft-badge`, `.result-badge`, table classes).
Expected after each screen: `npx vitest run` passes.

- [ ] **Step 2: Taste gate (dev)**

Run: `node .agents/skills/design-taste-frontend/scripts/lint.mjs --app client/src client/index.html` then inspect all four screens (dashboard, master, login with plain URL, documents) with `--app`, documents using `--allow micro-label,tiny-text`.
Expected: lint 0/0; inspect 0 FAIL everywhere (existing defensible WARNs allowed: hero-void, paper contrast).

- [ ] **Step 3: ui-smoke + prod gate**

Run: `node scripts/ui-smoke.mjs http://localhost:5173/dashboard` and `/documents/sales`; then `npm run build`, `npm run preview`, inspect `http://localhost:4173/dashboard?__seed=1 --app`.
Expected: SMOKE OK both; prod inspect 0 FAIL.

- [ ] **Step 4: Print check**

Print `/documents/sales` to PDF (or CDP `Page.printToPDF`), eyeball: PERHITUNGAN INSENTIF title, golongan/kriteria bands, kwitansi, Cetak button absent, table sizes unchanged.
Expected: paper format identical to pre-swap.

- [ ] **Step 5: Commit + final report**

```bash
git add client/src
git commit -m "feat: shadcn controls across screens, Chakra-free, gates green"
```
Report: what was swapped, what was left (paper, native selects in tables), gate results, and any taste WARNs with their defense.
