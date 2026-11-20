# Graph Report - insetive tracking  (2026-11-20)

## Corpus Check
- 267 files · ~993,795 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 60 file(s) not represented in the graph (top: .csv 39, .css 11, (none) 7)

## Summary
- 2006 nodes · 3715 edges · 142 communities (117 shown, 25 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 275 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3326608`
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
- Architecture (current, as built 2026-11-09)
- Dashboard.jsx
- .oxlintrc.json
- scripts
- React + Vite
- assets.mjs
- DesignSystemGenerator
- validate_data.py
- format_ascii_box
- draw.mjs
- Master.jsx
- Button
- search
- _domain_keywords
- persist_design_system
- search_stack
- test_catalog_summary_line_endings.py
- Insetif.jsx
- index.js
- 6. Recipes
- charts.js
- inspect.mjs
- db.js
- app-draw.mjs
- BM25
- test_design_system_mode.py
- dev.js
- TestThresholdGate
- Imagery
- components.json
- users.js
- documents.js
- cdp.mjs
- ref_node_fs
- ref_vitest
- The run
- UI/UX Pro Max - Design Intelligence
- positions.js
- The study
- test_core_data_quality.py
- lint.mjs
- detect_domain
- CatalogRefreshTest
- Incentive Document Format Design
- Layout
- Pre-Delivery Checklist (canonical — the only one)
- Quick Reference
- .generate
- Colour
- Scroll scenes
- scenes.mjs
- Deploy
- Documents.jsx
- App screens
- Tells — the dated registry
- Type
- dependencies
- Review Focus
- Review Focus
- Stage
- 7. Tables and lists
- Words
- Manual Deployment Steps (Major Updates)
- Review Focus
- Review Focus
- 2. The run for an app screen
- Critique — judging the render
- rules.mjs
- SQLite Auth and Incentive Documents Design
- Hierarchical Sales Position Assignment
- TestNativeDesktopStackFreshness
- Review Focus
- Dev Quick-Login Buttons — Design
- Dokumen Insentif SPV — Design Doc
- Design: Chakra removal + shadcn (21st.dev-style) component layer
- Insetif document list layout
- dev-auth.js
- routes/criteria.js
- core.py
- tasteskill v2 (`design-taste-frontend`)
- vite.config.js
- Master Data Rename + User Row Actions Implementation Plan
- seed-dummy-docs.js
- app.json
- 9. Type and colour
- parse_decision_rules
- test_skill_script_paths.py
- kinds
- 3. The shell
- 4. The canvas and the page title
- 6. Charts
- TestStackFlagWithDesignSystem
- RtlCliTest
- compilerOptions
- spv.js
- builder
- commerce
- community
- creator
- devtools
- finance
- markets
- report
- smb-admin
- support
- wallet
- workspace
- 8. Forms and settings
- _normalize
- TestStyleTaxonomy
- Keputusan
- terbilang
- ._apply_reasoning
- Task 1: Server — criteria_rows API + seed formats
- TestFixtureValidation
- TestTextLayoutRetrieval
- Master Data Rename + User Row Actions — Design
- _filter_anti_patterns_for_mode
- _row_identities
- read_rows
- TestTextLayoutDataContracts
- Review Focus
- split_values
- TestGeneratedCatalogContract
- TestLandingAndStackContract
- astryx-themes.js
- TestDiagnosticsContracts

## God Nodes (most connected - your core abstractions)
1. `search()` - 52 edges
2. `apiRequest()` - 39 edges
3. `DesignSystemGenerator` - 38 edges
4. `Master()` - 38 edges
5. `App()` - 37 edges
6. `search_stack()` - 36 edges
7. `getOne()` - 31 edges
8. `Button()` - 29 edges
9. `SpvDocument()` - 26 edges
10. `react` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Task 4: Quick-login buttons on the login page` --references--> `App()`  [INFERRED]
  docs/superpowers/plans/2026-11-02-dev-quick-login.md → client/src/App.jsx
- `How it gets built (decided)` --references--> `deleteUser()`  [INFERRED]
  docs/superpowers/specs/2026-11-02-master-data-user-actions-design.md → client/src/api.js
- `Task 3: Update Master.jsx account form - branch-filtered position dropdown` --references--> `listPositions()`  [INFERRED]
  docs/superpowers/plans/2026-11-06-hierarchical-sales-position.md → client/src/api.js
- `Interaction (App)` --references--> `Button()`  [INFERRED]
  .claude/skills/ui-ux-pro-max/references/pro-rules.md → client/src/components/ui/button.jsx
- `Task 1: Remove header buttons and restructure desktop header` --references--> `Button()`  [INFERRED]
  docs/superpowers/plans/2026-11-05-insetif-list-layout.md → client/src/components/ui/button.jsx

## Import Cycles
- None detected.

## Communities (142 total, 25 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.08
Nodes (49): canManageAdmin(), createDocument(), errMsg(), finalizeDocument(), getDocument(), listDocumentFormats(), listDocuments(), listMasterData() (+41 more)

### Community 1 - "PRD: Aplikasi Pemantauan Insentif Penjualan Web"
Cohesion: 0.08
Nodes (23): 1. Penggunaan Akun, 2. Pembuatan Dokumen, 3. Draft & Final, 4. Penggantian Nama Sales, Alur Produk (Alur Insentif), Aturan Bisnis, BM (Branch Manager), Definisi Role (+15 more)

### Community 2 - "server/package.json"
Cohesion: 0.07
Nodes (26): cookie-parser, cors, helmet, author, dependencies, better-sqlite3, cookie-parser, cors (+18 more)

### Community 3 - "client/package.json"
Cohesion: 0.10
Nodes (19): imports, vitest, name, private, type, version, @astryxdesign/cli, @astryxdesign/core (+11 more)

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
Cohesion: 0.18
Nodes (11): devDependencies, autoprefixer, oxlint, postcss, shadcn, tailwindcss, @types/react, @types/react-dom (+3 more)

### Community 8 - "Architecture (current, as built 2026-11-09)"
Cohesion: 0.20
Nodes (8): Architecture (current, as built 2026-11-09), Guardrails (do not change function), Run, Stack, Insentif Tracking, Jalankan, Login, Stack

### Community 9 - "Dashboard.jsx"
Cohesion: 0.13
Nodes (26): buttonVariants, SelectContent(), SelectItem(), SelectScrollDownButton(), SelectScrollUpButton(), SelectTrigger(), SelectValue(), branchRegionIds() (+18 more)

### Community 10 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 11 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 12 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 13 - "assets.mjs"
Cohesion: 0.07
Nodes (85): AIC_FIELDS, AIC_HEADERS, applyThumb(), ARCHIVE_LICENCE, args, argv, base(), clock() (+77 more)

### Community 15 - "validate_data.py"
Cohesion: 0.10
Nodes (32): _catalog_date(), _check_app_interface_contract(), _check_catalog_contract(), _check_catalog_summary(), _check_color_contract(), _check_core_data_contract(), _check_file(), _check_font_catalog() (+24 more)

### Community 16 - "format_ascii_box"
Cohesion: 0.10
Nodes (11): ansi_ljust(), format_ascii_box(), add_wrapped(), wrap_text(), format_markdown(), generate_design_system(), hex_to_ansi(), _mode_support_labels() (+3 more)

### Community 17 - "draw.mjs"
Cohesion: 0.10
Nodes (41): adjustments(), argv, assetQueries(), ASSETS_PATH, briefStop(), briefWords(), deal(), dealHero() (+33 more)

### Community 18 - "Master.jsx"
Cohesion: 0.11
Nodes (44): apiRequest(), buildUrl(), createBranch(), createBrand(), createDivision(), createPosition(), createPrincipal(), createRegion() (+36 more)

### Community 19 - "Button"
Cohesion: 0.06
Nodes (36): api, Avatar(), ConfirmCtx, ConfirmProvider(), DOC_CHILDREN, Layout(), LiveClock(), NAV (+28 more)

### Community 20 - "search"
Cohesion: 0.11
Nodes (6): _normalize_rtl_level(), _rtl_row_filter(), search(), _style_search_destination(), TestSearchDomains, RtlFilterTest

### Community 21 - "_domain_keywords"
Cohesion: 0.22
Nodes (6): _domain_keywords(), _file_signature(), _load_csv(), _load_csv_snapshot(), _load_product_keywords(), _load_rows_or_empty()

### Community 22 - "persist_design_system"
Cohesion: 0.15
Nodes (6): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides(), persist_design_system(), safe_slug(), _write_persisted_file()

### Community 23 - "search_stack"
Cohesion: 0.14
Nodes (6): _exact_stack_identifier(), _project_row(), search_stack(), _valid_max_results(), _rows(), TestWebStackFreshness

### Community 24 - "test_catalog_summary_line_endings.py"
Cohesion: 0.12
Nodes (3): CatalogSummaryLineEndingsTest, _load_generator(), TestMetricMath

### Community 25 - "Insetif.jsx"
Cohesion: 0.11
Nodes (31): ListPager(), Badge(), badgeVariants, docMatchesPeriode(), docMatchesSpv(), docMatchesYear(), docPeriodLabel(), docMatchesPeriodeRange() (+23 more)

### Community 26 - "index.js"
Cohesion: 0.07
Nodes (25): express-rate-limit, allowedOrigins, app, { authLimiter }, clientDist, { configureAuthDatabase, requireAuth, requireRole }, cookieParser, cors (+17 more)

### Community 27 - "6. Recipes"
Cohesion: 0.06
Nodes (31): 10. Rules for motion, 1. The budget, 2. What strong pages do with motion, 3. Four questions before any animation, 4. Tokens, 5. Scroll behaviours, ranked, 6. Recipes, 7. Signature moves (+23 more)

### Community 28 - "charts.js"
Cohesion: 0.21
Nodes (24): axes(), bars(), dayHeads(), diverging(), frame(), hits(), kindStyle(), lane() (+16 more)

### Community 29 - "inspect.mjs"
Cohesion: 0.09
Nodes (21): allow, appMode, args, asJson, dealtFonts, fails, film, HEIGHT (+13 more)

### Community 30 - "db.js"
Cohesion: 0.15
Nodes (10): crypto, Database, defaultDatabasePath(), fs, hashPassword(), path, SCHEMA_PATH, seedDatabase() (+2 more)

### Community 31 - "app-draw.mjs"
Cohesion: 0.12
Nodes (22): argv, deal(), dealScreen(), dealShell(), dealStyle(), fontLink(), HERE, kebab() (+14 more)

### Community 32 - "BM25"
Cohesion: 0.13
Nodes (5): BM25, _get_bm25(), _suggest_identities(), TestBm25CoreBehavior, TestTokenizer

### Community 33 - "test_design_system_mode.py"
Cohesion: 0.08
Nodes (13): _button_outline_text_color(), _contrast_ratio(), _derive_dark_palette(), format_master_md(), _palette_is_dark(), _query_wants_dark(), _relative_luminance(), _resolve_color_mode() (+5 more)

### Community 34 - "dev.js"
Cohesion: 0.09
Nodes (19): better-sqlite3, Database, dataDir, fs, path, prodDb, { start }, Database (+11 more)

### Community 36 - "Imagery"
Cohesion: 0.09
Nodes (22): 10. Markup and credits, 11. Video, 12. Where pictures and footage go, 1. What the study measured, 2. Decide what imagery exists, 3. Real pictures from the open collections, 4. The dealt photographs, 5. Cropping and placing (+14 more)

### Community 37 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 38 - "users.js"
Cohesion: 0.20
Nodes (14): createSession(), crypto, deleteSession(), hashPassword(), validatePassword(), validateUsername(), verifyPassword(), cleanAvatarColor() (+6 more)

### Community 39 - "documents.js"
Cohesion: 0.20
Nodes (20): resolveSalesmanPositionId(), createDocumentsRouter(), decodeKwitansi(), documentScalars(), express, findDuplicateDoc(), findDuplicateSpvDoc(), getDocument() (+12 more)

### Community 40 - "cdp.mjs"
Cohesion: 0.20
Nodes (6): alive(), Browser, findChrome(), Page, sleep(), sweepProfiles()

### Community 41 - "ref_node_fs"
Cohesion: 0.15
Nodes (9): COMPRESSIBLE, DIST, walk(), devLogin(), main(), sleep(), devLogin(), main() (+1 more)

### Community 42 - "ref_vitest"
Cohesion: 0.17
Nodes (14): Task 1: Add SQLite database foundation, Task 1: Server dev-login route with tests, express, supertest, migrateDatabase(), openDatabase(), configureAuthDatabase(), crypto (+6 more)

### Community 43 - "The run"
Cohesion: 0.11
Nodes (17): 10. Report, 1. Read the brief and the project, 2. Write the argument, 3. Draw the direction, 4. Find the idea, 5. Write the words, 6. Build it, still, 7. Gate (+9 more)

### Community 44 - "UI/UX Pro Max - Design Intelligence"
Cohesion: 0.11
Nodes (17): Before Delivering App UI, Example Workflow, If a search returns 0 results, Output Formats, Query Contract, Rule Categories by Priority, Running the search tool, Step 1: Analyze User Requirements (+9 more)

### Community 45 - "positions.js"
Cohesion: 0.38
Nodes (6): createPositionsRouter(), express, hierarchyError(), { requireAuth, requireRole }, appFor(), VALID_TYPES

### Community 46 - "The study"
Cohesion: 0.12
Nodes (15): 10. The 25 highest-scored sites and their ideas, 11. How the skill was tested, 12. The October 2026 study: 100 Sites of the Day, 13. The app-screen study, 1. Method and its limits, 2. Scores, 3. Where the idea comes from, 4. Headlines (+7 more)

### Community 47 - "test_core_data_quality.py"
Cohesion: 0.15
Nodes (11): read_rows(), TestAccessibilityGuidance, TestChartsTypographyAndIcons, TestCurrentReactGuidance, TestSemanticColors, _check_chart_contract(), _check_typography_contract(), _configured_font_names() (+3 more)

### Community 48 - "lint.mjs"
Cohesion: 0.13
Nodes (14): line(), APP_LEVEL, appMode, args, asJson, byId, EXT, files (+6 more)

### Community 51 - "Incentive Document Format Design"
Cohesion: 0.13
Nodes (14): API changes, Approaches considered, Calculations, Client changes, Constraints, Data flow, Decisions (from builder check), Design (+6 more)

### Community 52 - "Layout"
Cohesion: 0.15
Nodes (12): 10. How pages fail, 1. What strong pages do, 2. Margins and the grid, 3. Where text sits, 4. Empty space, 5. The frame: margins, balance and titles, 6. Sections: carry the idea, vary the arrangement, 7. Navigation (+4 more)

### Community 53 - "Pre-Delivery Checklist (canonical — the only one)"
Cohesion: 0.15
Nodes (12): Accessibility, Common Rules for Professional UI + Pre-Delivery Checklist, Icons & Visual Elements, Interaction, Interaction (App), Layout, Layout & Spacing, Light/Dark Mode (+4 more)

### Community 54 - "Quick Reference"
Cohesion: 0.15
Nodes (12): 10. Charts & Data (LOW), 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Style Selection (HIGH), 5. Layout & Responsive (HIGH), 6. Typography & Color (MEDIUM), 7. Animation (MEDIUM) (+4 more)

### Community 55 - ".generate"
Cohesion: 0.20
Nodes (3): _resolve_dial(), read_rows(), TestReasoningContract

### Community 56 - "Colour"
Cohesion: 0.17
Nodes (11): 1. What the study measured, 2. The roles, 3. Proportion, 4. Surfaces without lines or shadows, 5. Colour fields, 6. Dark pages, 7. Colour and photographs, 8. Contrast (+3 more)

### Community 57 - "Scroll scenes"
Cohesion: 0.17
Nodes (11): 1. What a scene is, 2. Putting a scene on a page, 3. Filling it, 4. Fitting it to the page, 5. The phone, reduced motion, no script, 6. Checking it, 7. Rules for scenes, 8. When no scene in the library fits (+3 more)

### Community 58 - "scenes.mjs"
Cohesion: 0.21
Nodes (9): args, go(), only, outDir, problems, rel(), run(), sheet() (+1 more)

### Community 59 - "Deploy"
Cohesion: 0.17
Nodes (11): 1. Clone + build, 2. User + environment, 3. Service API, 4. nginx + HTTPS, 5. Verifikasi, Catatan, Deploy, Docker (disarankan) (+3 more)

### Community 60 - "Documents.jsx"
Cohesion: 0.13
Nodes (24): deleteDocument(), getDocumentHistory(), ComboSelect(), Icon(), MultipleSelect(), buildGolonganRowsPayload(), computeGrandTotal(), computeTotalAutoFor() (+16 more)

### Community 61 - "App screens"
Cohesion: 0.18
Nodes (10): 10. Density, 11. Empty, zero, loading and error states, 12. The phone, 13. House rules for app screens, 14. Tells of generated dashboards, 1. When this applies, 5. KPIs, App screens (+2 more)

### Community 62 - "Tells — the dated registry"
Cohesion: 0.18
Nodes (10): 1. First wave (2023–2024), 2. Second wave (2025), 3. Third wave (2025–2026): the "fix" that became the look, 4. Gallery fashion, banned as house style, 5. Structural tells, 6. Copy tells, 7. Motion tells, 8. Why removal is not enough (+2 more)

### Community 63 - "Type"
Cohesion: 0.18
Nodes (10): 1. What the study measured, 2. The scale: few sizes, far apart, 3. Setting display type, 4. Setting text, 5. Loading the fonts properly, 6. One family or two, 7. Details that separate set type from typed text, 8. Mistakes the inspector cannot see (+2 more)

### Community 64 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @astryxdesign/cli, @astryxdesign/core, @astryxdesign/theme-neutral, @base-ui/react, class-variance-authority, cn, @fontsource/inter (+8 more)

### Community 65 - "Review Focus"
Cohesion: 0.18
Nodes (10): Global Constraints, Review Focus, Rollback and migration notes, SQLite Auth and Incentive Documents Implementation Plan, Task 2: Add secure sessions and role authorization, Task 3: Add Super Admin user management and master data APIs, Task 4: Add formats and criteria snapshots, Task 5: Add document creation, flexible Golongan rows, finalization, and correction audit (+2 more)

### Community 66 - "Review Focus"
Cohesion: 0.18
Nodes (10): Global Constraints, Insetif document list layout Implementation Plan, Review Focus, Task 1: Remove header buttons and restructure desktop header, Task 2: Restructure desktop filter grid — search on its own row, Task 3: Replace desktop document cards with horizontal rows, Task 4: Remove header buttons from mobile header, Task 5: Restructure mobile filter grid — search on its own row (+2 more)

### Community 68 - "7. Tables and lists"
Cohesion: 0.20
Nodes (10): 7.1 Rows, 7.2 Header, 7.3 Dividers, 7.4 Figures and alignment, 7.5 Ink inside rows, 7.6 Status pills, 7.7 Media, 7.8 Actions and paging (+2 more)

### Community 69 - "Words"
Cohesion: 0.20
Nodes (9): 1. Write the argument first, 2. The two-line headline, 3. Headline shapes that work, 4. Supporting line, body, buttons, 5. Proof without inventing it, 6. Things that read as generated, 7. Micro-typography, Contents (+1 more)

### Community 70 - "Manual Deployment Steps (Major Updates)"
Cohesion: 0.20
Nodes (9): Branch Protection, CI/CD Secrets Required (GitHub Repository Settings → Secrets → Actions), Environment Variables (.env on server), Manual Deploy Sequence, Manual Deployment Steps (Major Updates), PM2 Management, Prerequisites, Rollback (if needed) (+1 more)

### Community 71 - "Review Focus"
Cohesion: 0.22
Nodes (8): Chakra Removal + shadcn (21st.dev-style) Layer Implementation Plan, Global Constraints, Review Focus, Task 1: Checkpoint user WIP, Task 2: Install ui-ux-pro-max skill, Task 3: shadcn init + component set, Task 4: Palette bridge (theme.js → CSS variables), Task 6: Delete all remaining Chakra

### Community 72 - "Review Focus"
Cohesion: 0.20
Nodes (9): Global Constraints, Hierarchical Sales Position Assignment Implementation Plan, Review Focus, Review Focus Test Additions, Task 1: Add position_id column to users table migration, Task 2: Extend user API routes for position_id, Task 3: Update Master.jsx account form - branch-filtered position dropdown, Task 4: Update Dashboard to show (sales_code username) for SALES positions (+1 more)

### Community 73 - "2. The run for an app screen"
Cohesion: 0.22
Nodes (9): 2.1 Inventory the data and the jobs, 2.2 Name the screen's one question, 2.3 Choose a style, 2.4 Build the shell, 2.5 Put in the data, 2.6 Build the states, 2.7 The check, 2.8 Report (+1 more)

### Community 74 - "Critique — judging the render"
Cohesion: 0.22
Nodes (8): 1. How to look, 2. The score, 3. Caps, 4. Writing the critique, 5. What to fix first, 6. When to stop, Contents, Critique — judging the render

### Community 75 - "rules.mjs"
Cohesion: 0.31
Nodes (8): APP_SKIP, colourFamily(), hexToHsl(), inRange(), judge(), judgeApp(), judgeLayout(), RULE_IDS

### Community 76 - "SQLite Auth and Incentive Documents Design"
Cohesion: 0.22
Nodes (8): API boundary, Data model, Document behavior, Intent, Migration, Non-goals, Roles and access, SQLite Auth and Incentive Documents Design

### Community 77 - "Hierarchical Sales Position Assignment"
Cohesion: 0.22
Nodes (8): Approaches, Constraints, Design, Goals, Hierarchical Sales Position Assignment, Intent, Non-goals, Verification

### Community 80 - "Review Focus"
Cohesion: 0.29
Nodes (6): Dev Quick-Login Buttons Implementation Plan, Global Constraints, Review Focus, Task 2: Mount the router and verify against the live server, Task 3: Client `devLogin()` API function with test, Task 4: Quick-login buttons on the login page

### Community 81 - "Dev Quick-Login Buttons — Design"
Cohesion: 0.25
Nodes (7): Approaches considered, Dev Quick-Login Buttons — Design, Goals, How it gets built (decided), Intent, Non-goals / anti-goals, Open items

### Community 82 - "Dokumen Insentif SPV — Design Doc"
Cohesion: 0.14
Nodes (13): Anti-goals, Approaches yang dipertimbangkan, Constraints, Dokumen Insentif SPV — Design Doc, Goals, Intent, Non-goals, Panggilan builder (diputuskan sendiri, boleh dibalik) (+5 more)

### Community 83 - "Design: Chakra removal + shadcn (21st.dev-style) component layer"
Cohesion: 0.25
Nodes (7): Approaches considered, Design: Chakra removal + shadcn (21st.dev-style) component layer, Goals, How, Intent, Non-goals / anti-goals, What's left to the builder

### Community 84 - "Insetif document list layout"
Cohesion: 0.25
Nodes (7): Approaches, Goals, Insetif document list layout, Intent, Interaction and responsive rules, Non-goals, Verification

### Community 85 - "dev-auth.js"
Cohesion: 0.28
Nodes (7): createDevAuthRouter(), { createSession }, crypto, DEV_USERS, express, notFound(), createTestApp()

### Community 86 - "routes/criteria.js"
Cohesion: 0.43
Nodes (6): createCriteriaRouter(), express, isValidText(), { requireAuth, requireRole }, createTestApp(), writeAudit()

### Community 87 - "core.py"
Cohesion: 0.11
Nodes (4): _passes_threshold(), _query_coverage(), _suggest_terms(), format_output()

### Community 88 - "tasteskill v2 (`design-taste-frontend`)"
Cohesion: 0.29
Nodes (6): Contents, How it works, Install, Notes, Requirements, tasteskill v2 (`design-taste-frontend`)

### Community 89 - "vite.config.js"
Cohesion: 0.29
Nodes (5): manualChunks(), Build config, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 90 - "Master Data Rename + User Row Actions Implementation Plan"
Cohesion: 0.29
Nodes (6): Global Constraints, Master Data Rename + User Row Actions Implementation Plan, Review Focus, Task 1: Rename page to Master Data, Task 2: Reusable create/edit form + pencil icon, Task 3: Delete icon replacing Nonaktifkan

### Community 91 - "seed-dummy-docs.js"
Cohesion: 0.18
Nodes (8): brands, criteria, db, format, monthsCount, { openDatabase }, owner, sales

### Community 92 - "app.json"
Cohesion: 0.33
Nodes (5): about, patterns, shells, styles, version

### Community 93 - "9. Type and colour"
Cohesion: 0.33
Nodes (6): 9.1 Type, 9.2 Colour on light screens, 9.3 Colour on dark screens, 9.4 Surfaces, radius, icons, spacing, 9.5 Default tokens, 9. Type and colour

### Community 94 - "parse_decision_rules"
Cohesion: 0.27
Nodes (4): apply_decision_rules(), _object_without_duplicates(), parse_decision_rules(), _validate_action()

### Community 95 - "test_skill_script_paths.py"
Cohesion: 0.38
Nodes (3): resolve(), shipped_invocations(), SkillScriptPathsTest

### Community 96 - "kinds"
Cohesion: 0.40
Nodes (5): note, screens, styles, kinds, analytics

### Community 97 - "3. The shell"
Cohesion: 0.40
Nodes (5): 3.1 Five archetypes, 3.2 Sidebar, 3.3 Top bar, 3.4 Right rail and pinned columns, 3. The shell

### Community 98 - "4. The canvas and the page title"
Cohesion: 0.40
Nodes (5): 4.1 Width and gutters, 4.2 One left edge, one right edge, 4.3 The title, 4.4 Tabs, filters and the date range, 4. The canvas and the page title

### Community 99 - "6. Charts"
Cohesion: 0.40
Nodes (5): 6.1 Which chart for which question, 6.2 One question, one series, 6.3 Axes and gridlines, 6.4 Marks, 6. Charts

### Community 102 - "compilerOptions"
Cohesion: 0.40
Nodes (4): compilerOptions, baseUrl, paths, include

### Community 103 - "spv.js"
Cohesion: 0.27
Nodes (12): Task 2: Agregasi SPV di server, snapshotSpvRows(), withLiveRows(), branchesOfPosition(), computeSpvRows(), mergeIncentives(), parseMoney(), sourceDocuments() (+4 more)

### Community 104 - "builder"
Cohesion: 0.50
Nodes (4): note, screens, styles, builder

### Community 105 - "commerce"
Cohesion: 0.50
Nodes (4): note, screens, styles, commerce

### Community 106 - "community"
Cohesion: 0.50
Nodes (4): note, screens, styles, community

### Community 107 - "creator"
Cohesion: 0.50
Nodes (4): note, screens, styles, creator

### Community 108 - "devtools"
Cohesion: 0.50
Nodes (4): note, screens, styles, devtools

### Community 109 - "finance"
Cohesion: 0.50
Nodes (4): note, screens, styles, finance

### Community 110 - "markets"
Cohesion: 0.50
Nodes (4): markets, note, screens, styles

### Community 111 - "report"
Cohesion: 0.50
Nodes (4): report, note, screens, styles

### Community 112 - "smb-admin"
Cohesion: 0.50
Nodes (4): smb-admin, note, screens, styles

### Community 113 - "support"
Cohesion: 0.50
Nodes (4): support, note, screens, styles

### Community 114 - "wallet"
Cohesion: 0.50
Nodes (4): wallet, note, screens, styles

### Community 115 - "workspace"
Cohesion: 0.50
Nodes (4): workspace, note, screens, styles

### Community 116 - "8. Forms and settings"
Cohesion: 0.50
Nodes (4): 8.1 Fields, 8.2 Settings layout, 8.3 Buttons, 8. Forms and settings

### Community 117 - "_normalize"
Cohesion: 0.13
Nodes (9): _contains_phrase(), _exact_match_diagnostic(), _legacy_successor_guidance(), _normalize(), _rewrite_query_for_domain(), _search_csv(), _search_csv_detailed(), _stack_query_requests_legacy() (+1 more)

### Community 121 - "Keputusan"
Cohesion: 0.20
Nodes (10): Cakupan officer (diputuskan human partner), Golongan, Identitas dokumen, Insentif, Keputusan, Kriteria, Peran, Periode (+2 more)

### Community 122 - "terbilang"
Cohesion: 0.32
Nodes (6): terbilang(), TERBILANG_UNITS, terbilangWords(), Kwitansi (diputuskan human partner), Perubahan API, encodeKwitansi()

### Community 124 - "Task 1: Server — criteria_rows API + seed formats"
Cohesion: 0.33
Nodes (5): Global Constraints, Incentive Document Format Implementation Plan, Review Focus, Task 1: Server — criteria_rows API + seed formats, Task 2: Client — Documents.jsx rewrite with golongan hierarchy + kriteria table

### Community 127 - "Master Data Rename + User Row Actions — Design"
Cohesion: 0.25
Nodes (7): Approaches considered, Goals, How it gets built (decided), Intent, Master Data Rename + User Row Actions — Design, Non-goals / anti-goals, Open items

### Community 129 - "_row_identities"
Cohesion: 0.33
Nodes (3): _exact_row_identity(), _row_identities(), _style_identity()

### Community 132 - "Review Focus"
Cohesion: 0.25
Nodes (7): Dashboard Home Implementation Plan, Global Constraints, Review Focus, Task 1: Add dashboard metric derivation, Task 2: Add dashboard and navigation composition, Task 3: Restyle dashboard for supplied visual direction, Task 4: Verify local runtime and branch

### Community 133 - "split_values"
Cohesion: 0.47
Nodes (3): split_values(), style_identities(), TestStyleIdentityContract

### Community 138 - "astryx-themes.js"
Cohesion: 0.50
Nodes (3): defaultThemeSlug, themes, @astryxdesign/theme-neutral

## Knowledge Gaps
- **15 isolated node(s):** `@astryxdesign/cli`, `@astryxdesign/core`, `@fontsource/inter`, `@stylexjs/stylex`, `framer-motion` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 961 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `search()` connect `search` to `BM25`, `_row_identities`, `read_rows`, `._multi_domain_search`, `TestDiagnosticsContracts`, `test_core_data_quality.py`, `detect_domain`, `search_stack`, `_domain_keywords`, `_normalize`, `core.py`, `.generate`, `persist_design_system`, `TestStyleTaxonomy`, `TestTextLayoutRetrieval`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `search()` (e.g. with `.generate()` and `._multi_domain_search()`) actually correct?**
  _`search()` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@astryxdesign/cli`, `@astryxdesign/core`, `@fontsource/inter` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08038914490527393 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `Button` to `App.jsx`, `Review Focus`, `Dashboard.jsx`, `Master.jsx`, `Pre-Delivery Checklist (canonical — the only one)`, `Insetif.jsx`, `Documents.jsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `DesignSystemGenerator` (e.g. with `TestReasoningMatch` and `.test_known_category_matches_exactly()`) actually correct?**
  _`DesignSystemGenerator` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `PRD: Aplikasi Pemantauan Insentif Penjualan Web` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._