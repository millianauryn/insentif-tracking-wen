# Design: Chakra removal + shadcn (21st.dev-style) component layer

Date: 2026-11-04 · Status: approved with amendments (scope: all screens; sourcing: shadcn official)

## Intent

The app currently mixes three styling systems: house CSS (App.css/index.css, Tailwind v4),
Chakra UI v3 (added in the last session), and the taste-skill restyle. The user wants every
trace of Chakra gone and the whole UI running on shadcn-style components — 21st.dev is the
style reference, `ui-ux-pro-max` the design-guideline skill, `design-taste-frontend` the
quality gate.

Why now: Chakra is the only alien dependency in a Tailwind v4 stack; its provider/theme/snippets
add weight without buying anything the house CSS does not already provide.

## Goals

- `@chakra-ui/react` + `@emotion/react` fully removed (deps, `components/ui/{provider,toaster,
  tooltip,color-mode}`, `theme.js`, provider wrap in `main.jsx`, ChakraProvider in tests).
- ALL screens run on shadcn-style local components + Tailwind: Layout, Dashboard, Login,
  Master, Documents (chrome only — see non-goals).
- Components sourced from the **official shadcn registry** (`npx shadcn@latest add ...`,
  MIT, no key) — 21st.dev is shadcn-compatible and serves as the visual reference for which
  components and which variants to pick (its catalog/`.md` pages are free to browse).
  Rationale: 21st's own code endpoint needs an API key with a 2-retrievals/day free quota;
  user chose the shadcn-official path.
- Skill `nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max` installed and used for visual
  decisions during the swap.
- Brand look preserved: teal single-hue chrome, sentence-case copy, divided KPI strip,
  ruled T-frame shell — the structure that passed the taste gate stays.
- All gates green afterwards: taste `lint.mjs --app` 0/0, `inspect.mjs --app` 0 FAIL on
  dashboard/master/login/documents (documents keeps `--allow micro-label,tiny-text` for the
  paper format), `ui-smoke` 0 errors, client 27/27, server 49/49.

## Non-goals / anti-goals

- No change to the paper print format (PERHITUNGAN INSENTIF, golongan/kriteria tables,
  kwitansi) — print CSS and its screen-preview table styles stay byte-identical.
- No violet/gradient/glass, no tinted-circle icons, greys >= 4.5:1 (taste rules hold).
- No 21st API key, no paid plan, no 21st MCP — shadcn official registry only.
- No new dependency beyond shadcn components (radix/cva/tailwind-merge) and the ui-ux-pro-max
  skill.

## Approaches considered

1. **Chakra out, shadcn layer over all screens (chosen).** Delete Chakra, translate every
   Chakra-rendered screen and the ad-hoc controls (tabs, badges, modal, pager) into local
   shadcn-style components. Keeps the gate-passed structure, print risk near zero.
2. **21st registry with API key.** Literal "from 21st.dev" but free tier = 2 code pulls/day
   and OAuth needs human login — rejected by user choice.
3. **Delete Chakra only, keep house classes.** Cheapest but does not satisfy "jalankan
   semuanya dari 21st.dev".

## How

1. Install the skill: `npx skills add nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max -g -y`.
2. Add shadcn components via `npx shadcn@latest add` (official registry): `button`, `badge`,
   `breadcrumb`, `avatar`, `input`, `tabs`, `dialog`, `table`, `select`, `card` — only what
   the five screens render. Installed under `client/src/components/ui/` (shadcn convention),
   themed with brand teal.
3. Move `theme.js` palette into CSS variables in `index.css` (brand teal scale, greys, radii,
   font sizes) before deleting `theme.js`.
4. Rewrite the screens' controls onto the shadcn components:
   - Layout: sidebar/nav, breadcrumb, top-bar actions, avatar, icon buttons.
   - Dashboard: title-row button, KPI strip cells, recent-list rows, View-all button.
   - Login: form inputs + submit button.
   - Master: tabs, search input, status badges, pager buttons, modal.
   - Documents: toolbar buttons, status badges, doc-list rows; paper tables untouched.
5. Delete Chakra: package.json deps, `components/ui/{provider,toaster,tooltip,color-mode}.jsx`,
   `theme.js`, Provider wrap in `main.jsx`, ChakraProvider block in `documents.smoke.test.jsx`.
6. Gates: taste lint + inspect (4 screens), ui-smoke (dashboard + documents), client/server
   tests, eslint. Fix FAILs; re-look at screenshots.

## What's left to the builder

Picking exact shadcn variants (with 21st.dev previews as reference), translating the JSX,
theming to brand teal, and running the gate loop. One print-to-PDF pass after the swap.
