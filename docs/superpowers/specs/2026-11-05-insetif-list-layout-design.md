# Insetif document list layout

## Intent

Make the saved-document page faster to scan on desktop and mobile.

## Goals

- Remove `Muat Ulang` and `Dokumen Baru` buttons from desktop and mobile headers.
- Place search input on its own row above SPV, Sales, and Periode filters.
- Replace rectangular card grids with compact horizontal document rows.
- Keep row click and keyboard activation opening the existing detail view.
- Preserve status badge, period, empty state, and current filtering behavior.

## Non-goals

- Do not remove or change SPV, Sales, or Periode filters.
- Do not change document fetching, filtering logic, detail content, or dialog behavior.
- Do not add the supplied generic `FilterBar` component or dependency.

## Approaches

1. **Horizontal list rows (selected):** one responsive row per document, with sales name, period, status, and detail affordance. Best scan density and matches requested table/list layout.
2. **Compact horizontal cards:** retain card semantics and heavier borders. Less code change, but keeps unnecessary card treatment.

The selected approach changes only `client/src/pages/Insetif.jsx`. Existing `onRefresh` and `onNewDoc` props remain accepted for compatibility, but their page buttons are removed.

## Interaction and responsive rules

- Desktop rows use a grid-like horizontal arrangement.
- Mobile rows stack metadata while remaining full-width and compact.
- Each row remains keyboard focusable and activates on Enter or Space.
- Selected rows retain existing visual state.

## Verification

Run the client build, inspect desktop and mobile layouts in the browser, and verify clicking or keyboard-activating a row opens detail view.
