# Incentive Document Format Design

## Intent

Replace the current principal/brand-based document input with a table format matching the paper "PERHITUNGAN INSENTIVE" document: a hierarchical golongan table (groups, items, summary rows) and a kriteria table (criteria rows with manually input values).

## Goals

- Golongan table with hierarchy: divisi groups, principal sub-groups, individual brand items, summary/total rows
- Kriteria table with labels from `criteria_definitions`, officer inputs target/tercapai/incentive
- Direct table input (remove form/table switcher)
- Role-based permissions: super admin edits criteria labels in Master Data, officer inputs values, observer read-only
- Color scheme matching paper format

## Non-goals

- Kwitansi (receipt) section — out of scope for now
- Auto-calculation of incentive amounts — officer inputs manually
- Jabatan-specific criteria differentiation — for now all 3 formats (BM, SPV, Sales) are duplicates of the sales format

## Constraints

- No server schema changes — `golongan_rows` already has `parent_id`, `is_group`, `label`, `principal_id`, `brand_id`; `document_criteria_rows` already has `target_value`, `achievement_value`, `percentage`, `status`, `incentive_amount`
- API changes limited to accepting `criteria_rows` values in existing create/update endpoints

## Decisions (from builder check)

1. **Kriteria snapshot wins**: existing `document_criteria_rows` behavior stays — label/formula frozen at document create. Super admin edits in Master Data affect new documents only, not existing Final docs.
2. **3 document formats**: create `document_formats` rows for BM, SPV, Sales. For now all three are duplicates of the sales format. Format differs per jabatan; selection logic deferred (for now first active format is used).
3. **Existing documents must keep working**: old flat golongan rows (no hierarchy, no criteria values) need compat rendering — parentless rows → top-level items, missing criteria values → empty inputs.
4. **Uniform percentage formula**: `achievement/target >= 100 → Tercapai`, `< 100 → Gugur` for all criteria. No inversion.

## Approaches considered

1. **Modify existing Documents.jsx + extend API** (chosen) — rewrite UI, extend POST/PATCH to accept `criteria_rows` values. Reuses save/load/finalize logic.
2. **New component + separate criteria endpoint** — new DocumentsTable.jsx, new PATCH endpoint per criteria. More endpoints, more client code.
3. **Modify Documents.jsx, criteria in same PATCH** — same UI rewrite, single endpoint handles both tables. Simpler API but larger payload.

Chose Approach 1: minimal API surface change, reuses existing infrastructure.

## Design

### Data flow

1. Officer creates document → POST `/api/documents` with `golongan_rows` + `criteria_rows` (values)
2. Server creates document, inserts golongan_rows (with hierarchy via `parent_index`), inserts/updates criteria_rows (with values)
3. Officer edits → PATCH `/api/documents/:id` with `golongan_rows` + `criteria_rows`
4. Officer finalizes → POST `/api/documents/:id/finalize`

### API changes

**POST `/api/documents`** — add `criteria_rows` to request body:
```json
{
  "format_id": 1,
  "salesman": "Aldiansyah",
  "product": "Univenus, Enesis, & Philips",
  "period": "2026-09",
  "golongan_rows": [
    { "label": "PULAU BARU", "is_group": true },
    { "label": "PASEO", "parent_index": 0, "principal_id": 1, "brand_id": 1, "target": 182000000, "achievement": 202812699 },
    { "label": "TOTAL DIVISI PULAU BARU", "is_group": true }
  ],
  "criteria_rows": [
    { "criteria_id": 1, "target_value": 22, "achievement_value": 23.69, "incentive_amount": 169615 },
    { "criteria_id": 2, "target_value": 5, "achievement_value": 6.66, "incentive_amount": 209790 }
  ]
}
```

Server logic:
- Insert golongan_rows as existing (handles `parent_index` → `parent_id`)
- For criteria_rows: upsert into `document_criteria_rows` (match on `document_id` + `criteria_id`, set `target_value`, `achievement_value`, `incentive_amount`, compute `percentage` and `status` using uniform formula)
- Existing `document_criteria_rows` labels stay frozen (snapshot) — new criteria added to `criteria_definitions` after doc create do not appear in existing docs

**PATCH `/api/documents/:id`** — add `criteria_rows` to request body (same structure as POST):
- Update golongan_rows (existing delete-and-reinsert logic)
- Upsert criteria_rows with values

**GET `/api/documents/:id`** — already returns `criteria_rows` with all columns including values. No change needed.

### Client changes

**Documents.jsx** — full rewrite:

1. **Golongan table** (hierarchical):
   - Columns: GOLONGAN | TARGET | TERCAPAI (Rp.) | % | KET
   - Row types:
     - Divisi group header (cream): label only, no inputs
     - Principal sub-group (green): label only, no inputs
     - Individual brand item (white): combobox (free-text or brand select) + target input + achievement input + auto % + auto KET
     - Total divisi (blue): label + auto-summed target/achievement from children
     - Grand total (yellow): label + auto-summed target/achievement from all items
   - Add buttons: "Tambah Divisi", "Tambah Principal" (under divisi), "Tambah Brand" (under principal), "Tambah Total Divisi", "Tambah Total"
   - Combobox behavior: type free-text → saves `label`; select from brands dropdown → saves `principal_id` + `brand_id`

2. **Kriteria table**:
   - Columns: KRITERIA | TARGET | TERCAPAI (JUMLAH) | % | KET | INSENTIVE YG DIBERI
   - Rows from `criteria_definitions` (labels read-only for officer)
   - Officer inputs: target, tercapai, incentive amount
   - Auto-calculated: % = (achievement/target)*100, KET = Tercapai (>=100%) or Gugur (<100%)

3. **Remove**: form/table switcher, principal/brand dropdown approach

4. **Color scheme**:
   - Golongan table: light blue headers, cream divisi, green principal, white brand items, blue total divisi, yellow grand total
   - Kriteria table: light blue headers, white rows

5. **Role-based permissions**:
   - Super admin: can edit everything (golongan + kriteria values)
   - Officer: can edit golongan target/tercapai, kriteria target/tercapai/incentive
   - Observer: read-only (all inputs disabled)

6. **Compat layer for existing documents**:
   - Old flat golongan rows (no `parent_id`, no `is_group`) → render as top-level items (no hierarchy)
   - Missing criteria values (`target_value`, `achievement_value`, `incentive_amount` null) → empty inputs, officer can fill in

**App.jsx** — update data flow:
- Pass `criteria` (from `criteria_definitions`) to Documents component
- Handle `criteria_rows` values in save/load logic
- Update `saveDraft` and `updateDraft` to include `criteria_rows`

**Master.jsx** — kriteria management (already exists):
- Super admin can edit criteria labels in Kriteria Dokumen tab
- No changes needed (verify it works correctly)

### UI interaction

**Adding golongan rows:**
- "Tambah Divisi" button → adds divisi group header at end
- "Tambah Principal" button (per divisi) → adds principal sub-group under that divisi
- "Tambah Brand" button (per principal) → adds brand item under that principal
- "Tambah Total Divisi" button (per divisi) → adds summary row that auto-sums children
- "Tambah Total" button → adds grand total row that auto-sums all items

**Editing values:**
- Brand item rows: combobox for golongan (type or select), number inputs for target/achievement
- Kriteria rows: number inputs for target/achievement/incentive
- % and KET columns: read-only, auto-calculated

**Deleting rows:**
- Delete button per row (removes row + children if group)

### Calculations

- **Percentage**: `(achievement / target) * 100`, displayed as "106.0%"
- **KET**: `Tercapai` if percentage >= 100, else `Gugur`
- **Total rows**: sum of target and achievement from all child items (not including other total rows)

## What's left to the builder

- Create 3 `document_formats` rows (BM, SPV, Sales) — all duplicates of sales format
- Implement API changes (accept `criteria_rows` in POST/PATCH, upsert logic with uniform percentage formula)
- Rewrite Documents.jsx with golongan hierarchy table + kriteria table
- Add compat layer for existing flat documents (parentless rows → top-level items)
- Update App.jsx data flow for criteria_rows
- Add CSS for color scheme (light blue, cream, green, white, blue, yellow)
- Test role-based permissions (super admin, officer, observer)
- Test hierarchy (groups, items, summary rows auto-calculate)
- Test existing documents render correctly with compat layer
