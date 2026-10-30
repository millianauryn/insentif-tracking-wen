# Graph Report - insentif-tracking-wen  (2026-10-30)

## Corpus Check
- 16 files · ~8,001 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 2)

## Summary
- 184 nodes · 238 edges · 13 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `80a5cc29`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- PRD: Aplikasi Pemantauan Insentif Penjualan Web
- server/package.json
- client/package.json
- PRD: Aplikasi Pemantauan Insentif Penjualan Web — Requirements & Workflow
- PRD: Aplikasi Pemantauan Insentif Penjualan Web — Design & UI/UX
- Dashboard Home Design
- devDependencies
- Insentif Tracking Wen
- App
- .oxlintrc.json
- scripts
- React + Vite

## God Nodes (most connected - your core abstractions)
1. `Icon()` - 12 edges
2. `App()` - 12 edges
3. `PRD: Aplikasi Pemantauan Insentif Penjualan Web` - 10 edges
4. `Dashboard Home Design` - 10 edges
5. `Dashboard()` - 9 edges
6. `calculateRow()` - 9 edges
7. `PRD: Aplikasi Pemantauan Insentif Penjualan Web — Design & UI/UX` - 9 edges
8. `getDashboardMetrics()` - 8 edges
9. `PRD: Aplikasi Pemantauan Insentif Penjualan Web — Requirements & Workflow` - 8 edges
10. `calculateTotals()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Task 2: Add dashboard and navigation composition` --references--> `Dashboard()`  [INFERRED]
  docs/superpowers/plans/2026-10-30-dashboard-home-plan.md → client/src/App.jsx
- `Task 2: Add dashboard and navigation composition` --references--> `App()`  [INFERRED]
  docs/superpowers/plans/2026-10-30-dashboard-home-plan.md → client/src/App.jsx
- `Task 1: Add dashboard metric derivation` --references--> `calculateRow()`  [INFERRED]
  docs/superpowers/plans/2026-10-30-dashboard-home-plan.md → client/src/incentive.js
- `Task 1: Add dashboard metric derivation` --references--> `calculateTotals()`  [INFERRED]
  docs/superpowers/plans/2026-10-30-dashboard-home-plan.md → client/src/incentive.js
- `Task 2: Add dashboard and navigation composition` --references--> `getDashboardMetrics()`  [INFERRED]
  docs/superpowers/plans/2026-10-30-dashboard-home-plan.md → client/src/incentive.js

## Import Cycles
- None detected.

## Communities (13 total, 0 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.29
Nodes (16): AchievementForm(), AchievementTable(), Dashboard(), DocumentView(), EmptyState(), Icon(), initialSales, KpiCard() (+8 more)

### Community 1 - "PRD: Aplikasi Pemantauan Insentif Penjualan Web"
Cohesion: 0.08
Nodes (23): 1. Penggunaan Akun, 2. Pembuatan Dokumen, 3. Draft & Final, 4. Penggantian Nama Sales, Alur Produk (Alur Insentif), Aturan Bisnis, BM (Branch Manager), Definisi Role (+15 more)

### Community 2 - "server/package.json"
Cohesion: 0.09
Nodes (22): cors, express, helmet, app, cors, express, helmet, author (+14 more)

### Community 3 - "client/package.json"
Cohesion: 0.10
Nodes (18): dependencies, react, react-dom, name, private, type, version, autoprefixer (+10 more)

### Community 4 - "PRD: Aplikasi Pemantauan Insentif Penjualan Web — Requirements & Workflow"
Cohesion: 0.10
Nodes (20): 1. Penggunaan Akun, 2. Pembuatan Dokumen, 3. Draft & Final, 4. Penggantian Nama Sales, Alur Produk (Alur Insentif), Aturan Bisnis, Definisi Role, Dokumen Insentif (BM) (+12 more)

### Community 5 - "PRD: Aplikasi Pemantauan Insentif Penjualan Web — Design & UI/UX"
Cohesion: 0.18
Nodes (10): Color System (Status), Komponen UI, Layout SPV/BM (Sama struktur tabel), PDF Export Layout, PRD: Aplikasi Pemantauan Insentif Penjualan Web — Design & UI/UX, Responsive Breakpoints, Spacing Scale, Tree View (Agregasi) (+2 more)

### Community 6 - "Dashboard Home Design"
Cohesion: 0.18
Nodes (10): Anti-goals, Builder decisions left, Dashboard Home Design, Dashboard layout, Goals, Implementation boundaries, Intent, Non-goals (+2 more)

### Community 7 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, autoprefixer, oxlint, postcss, tailwindcss, @types/react, @types/react-dom, vite (+2 more)

### Community 8 - "Insentif Tracking Wen"
Cohesion: 0.25
Nodes (7): Catatan prototype, Insentif Tracking Wen, Menjalankan backend, Menjalankan frontend, Stack, Struktur, Verifikasi frontend

### Community 9 - "App"
Cohesion: 0.19
Nodes (17): App(), calculateRow(), calculateTotals(), createEmptyRow(), getDashboardMetrics(), isCompletedRow(), loadRows(), PRINCIPAL_OPTIONS (+9 more)

### Community 10 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 11 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 12 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

## Knowledge Gaps
- **6 isolated node(s):** `@types/react`, `@types/react-dom`, `autoprefixer`, `oxlint`, `postcss` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 118 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `client/package.json` to `App.jsx`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `@types/react`, `@types/react-dom`, `autoprefixer` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PRD: Aplikasi Pemantauan Insentif Penjualan Web` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `client/package.json`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `server/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09057971014492754 - nodes in this community are weakly interconnected._
- **Why does `scripts` connect `scripts` to `client/package.json`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `client/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09956709956709957 - nodes in this community are weakly interconnected._