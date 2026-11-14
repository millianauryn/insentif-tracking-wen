# Incentive Document Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace principal/brand document input with a hierarchical golongan table + kriteria table matching the paper "PERHITUNGAN INSENTIF" format, with role-based permissions and color scheme.

**Architecture:** Extend existing `POST /api/documents` and `PATCH /api/documents/:id` to accept `criteria_rows` values. Rewrite `Documents.jsx` with golongan hierarchy table (divisi→principal→brand→summary rows) and kriteria table (labels from `criteria_definitions`, officer inputs values). Add compat layer for existing flat documents.

**Tech Stack:** React 19, Express 5, SQLite (better-sqlite3), Tailwind CSS v4, vitest + supertest

**Spec:** `docs/superpowers/specs/2026-11-03-incentive-document-format-design.md`

## Global Constraints

- No server schema changes — `golongan_rows` and `document_criteria_rows` already have required columns
- Kriteria snapshot: `document_criteria_rows` label/formula frozen at document create
- Uniform percentage: `achievement/target >= 100 → Tercapai`, `< 100 → Gugur` for all criteria
- Existing flat documents (no hierarchy, no criteria values) must render correctly via compat layer
- Color scheme: light blue headers, cream divisi, green principal, white brand items, blue total divisi, yellow grand total; kriteria: light blue headers, white rows

## Review Focus

1. Existing flat golongan rows (no `parent_id`, no `is_group`) render as top-level items without crashing
2. Missing criteria values (`target_value` null) show empty inputs, not `NaN` or `0`
3. Summary rows auto-calculate correctly from children (exclude other summary rows)
4. Officer can only edit target/tercapai/incentive, not kriteria labels
5. Snapshot behavior: editing criteria label in Master Data does not change existing Final document labels

---

### Task 1: Server — criteria_rows API + seed formats

**Files:**
- Modify: `server/routes/documents.js` (POST handler lines 15-50, PATCH handler lines 58-76, add `upsertCriteriaRows` helper)
- Modify: `server/db.js:99-101` (seedDatabase)
- Test: `server/routes/documents.test.js`

**Interfaces:**
- Consumes: existing `document_criteria_rows` schema (criteria_id, target_value, achievement_value, percentage, status, incentive_amount)
- Produces: `POST /api/documents` accepts `criteria_rows: [{ criteria_id, target_value, achievement_value, incentive_amount }]`; `PATCH /api/documents/:id` same structure; `seedDatabase` inserts BM/SPV/Sales formats

- [ ] **Step 1: Write failing test for POST with criteria_rows**

```javascript
// server/routes/documents.test.js
it('stores criteria_rows values on create', async () => {
  const res = await request(app)
    .post('/api/documents')
    .set('Cookie', officerCookie)
    .send({
      format_id: 1,
      period: '2026-09',
      golongan_rows: [{ label: 'PASEO', target: 182000000, achievement: 202812699 }],
      criteria_rows: [
        { criteria_id: 1, target_value: 22, achievement_value: 23.69, incentive_amount: 169615 },
      ],
    });
  expect(res.status).toBe(201);
  const doc = db.prepare('SELECT * FROM document_criteria_rows WHERE document_id = ?').all(res.body.document.id);
  expect(doc[0].target_value).toBe(22);
  expect(doc[0].achievement_value).toBe(23.69);
  expect(doc[0].incentive_amount).toBe(169615);
  expect(doc[0].percentage).toBeCloseTo((23.69 / 22) * 100, 1);
  expect(doc[0].status).toBe('Tercapai');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run routes/documents.test.js -t "criteria_rows"`
Expected: FAIL (criteria_rows not handled)

- [ ] **Step 3: Implement `upsertCriteriaRows(db, documentId, rows)` in `server/routes/documents.js`**

```javascript
function upsertCriteriaRows(db, documentId, rows) {
  if (!Array.isArray(rows)) return;
  const existing = db.prepare('SELECT criteria_id FROM document_criteria_rows WHERE document_id = ?').all(documentId);
  const existingIds = new Set(existing.map(r => r.criteria_id));
  const upsert = db.prepare(`
    INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, target_value, achievement_value, percentage, status, incentive_amount, sort_order)
    VALUES (?, ?, (SELECT label FROM criteria_definitions WHERE id = ?), (SELECT target_unit FROM criteria_definitions WHERE id = ?), (SELECT formula FROM criteria_definitions WHERE id = ?), ?, ?, ?, ?, ?, (SELECT sort_order FROM criteria_definitions WHERE id = ?))
    ON CONFLICT(document_id, criteria_id) DO UPDATE SET target_value = excluded.target_value, achievement_value = excluded.achievement_value, percentage = excluded.percentage, status = excluded.status, incentive_amount = excluded.incentive_amount
  `);
  rows.forEach(row => {
    if (!existingIds.has(row.criteria_id)) return; // snapshot: only update existing
    const target = Number(row.target_value) || 0;
    const achievement = Number(row.achievement_value) || 0;
    const percentage = target > 0 ? (achievement / target) * 100 : 0;
    const status = target > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur';
    upsert.run(documentId, row.criteria_id, row.criteria_id, row.criteria_id, row.criteria_id, target, achievement, percentage, status, Number(row.incentive_amount) || 0, row.criteria_id);
  });
}
```

Call `upsertCriteriaRows(db, documentId, input.criteria_rows || [])` in POST after `insertGolonganRows`, and in PATCH after golongan update.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run routes/documents.test.js -t "criteria_rows"`
Expected: PASS

- [ ] **Step 5: Write failing test for PATCH with criteria_rows**

```javascript
it('updates criteria_rows values on patch', async () => {
  // create doc first, then patch with new criteria values
  const res = await request(app)
    .patch(`/api/documents/${docId}`)
    .set('Cookie', officerCookie)
    .send({
      criteria_rows: [{ criteria_id: 1, target_value: 30, achievement_value: 35, incentive_amount: 200000 }],
    });
  expect(res.status).toBe(200);
  const row = db.prepare('SELECT * FROM document_criteria_rows WHERE document_id = ? AND criteria_id = 1').get(docId);
  expect(row.target_value).toBe(30);
  expect(row.percentage).toBeCloseTo((35 / 30) * 100, 1);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd server && npx vitest run routes/documents.test.js -t "criteria_rows on patch"`
Expected: FAIL

- [ ] **Step 7: Add `upsertCriteriaRows` call in PATCH handler**

In `updateDocument` function, after golongan_rows handling, add:
```javascript
if (Array.isArray(input.criteria_rows)) {
  upsertCriteriaRows(db, document.id, input.criteria_rows);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && npx vitest run routes/documents.test.js -t "criteria_rows on patch"`
Expected: PASS

- [ ] **Step 9: Add seed for BM, SPV, Sales formats in `server/db.js`**

```javascript
// In seedDatabase, after existing Default format insert:
db.prepare("INSERT OR IGNORE INTO document_formats (name, version, active) VALUES ('Sales', '1', 1)").run();
db.prepare("INSERT OR IGNORE INTO document_formats (name, version, active) VALUES ('SPV', '1', 1)").run();
db.prepare("INSERT OR IGNORE INTO document_formats (name, version, active) VALUES ('BM', '1', 1)").run();
```

- [ ] **Step 10: Run full server test suite**

Run: `cd server && npm test`
Expected: All tests pass

- [ ] **Step 11: Commit**

```bash
git add server/routes/documents.js server/db.js server/routes/documents.test.js
git commit -m "feat(server): accept criteria_rows values in document create/update"
```

---

### Task 2: Client — Documents.jsx rewrite with golongan hierarchy + kriteria table

**Files:**
- Rewrite: `client/src/pages/Documents.jsx`
- Modify: `client/src/App.jsx` (saveDraft, updateDraft, loadDocument, data flow)
- Modify: `client/src/App.css` (color scheme classes)
- Test: browser walkthrough

**Interfaces:**
- Consumes: `criteria` array from `criteria_definitions` (label, target_unit, sort_order), `criteriaRows` from `document_criteria_rows` (criteria_id, target_value, achievement_value, incentive_amount, percentage, status)
- Produces: `Documents` component props extended with `criteria` and `criteriaRows`; `saveDraft`/`updateDraft` send `criteria_rows` array

- [ ] **Step 1: Add CSS color scheme classes to `client/src/App.css`**

```css
/* Golongan table colors */
.golongan-header { background: #d6eaf8; } /* light blue */
.golongan-divisi { background: #fef9e7; } /* cream */
.golongan-principal { background: #d5f5e3; } /* green */
.golongan-brand { background: #ffffff; } /* white */
.golongan-total-divisi { background: #d6eaf8; } /* blue */
.golongan-total { background: #fcf3cf; } /* yellow */

/* Kriteria table */
.kriteria-header { background: #d6eaf8; } /* light blue */
.kriteria-row { background: #ffffff; } /* white */
```

- [ ] **Step 2: Implement GolonganTable component in Documents.jsx**

Hierarchical table with columns: GOLONGAN | TARGET | TERCAPAI (Rp.) | % | KET

Row types (distinguished by `is_group` and `label` pattern):
- Divisi group header (cream): label only, bold
- Principal sub-group (green): label only, bold
- Individual brand item (white): combobox (free-text or brand select) + target input + achievement input + auto % + auto KET
- Total divisi (blue): label + auto-summed target/achievement from children
- Grand total (yellow): label + auto-summed target/achievement from all items

Add buttons: "Tambah Divisi", "Tambah Principal" (per divisi), "Tambah Brand" (per principal), "Tambah Total Divisi" (per divisi), "Tambah Total"

Combobox behavior: type free-text → saves `label`; select from brands dropdown → saves `principal_id` + `brand_id`

- [ ] **Step 3: Implement KriteriaTable component in Documents.jsx**

Table with columns: KRITERIA | TARGET | TERCAPAI (JUMLAH) | % | KET | INSENTIVE YG DIBERI

Rows from `criteria` prop (labels read-only for officer). Officer inputs: target, tercapai, incentive amount. Auto-calculated: % and KET.

- [ ] **Step 4: Update App.jsx saveDraft and updateDraft to include criteria_rows**

```javascript
const saveDraft = async () => {
  // ... existing logic ...
  const result = await createDocument({
    format_id: documentFormatId,
    salesman: sales.name,
    product: sales.branch,
    period: toApiPeriod(period),
    golongan_rows: buildGolonganRows(),
    criteria_rows: buildCriteriaRows(), // new
  });
  // ...
};
```

`buildCriteriaRows()` maps `criteriaRows` state to `[{ criteria_id, target_value, achievement_value, incentive_amount }]`.

- [ ] **Step 5: Update App.jsx loadDocument to read criteria_rows**

```javascript
const loadDocument = async (doc) => {
  const { document: full } = await getDocument(doc.id);
  // ... existing logic ...
  setCriteriaRows(full.criteria_rows || []); // new
};
```

- [ ] **Step 6: Add compat layer for existing flat documents**

In `loadDocument`, if `full.golongan_rows` have no `parent_id` and no `is_group`, render them as top-level items (no hierarchy). If `full.criteria_rows` have null `target_value`/`achievement_value`/`incentive_amount`, show empty inputs.

- [ ] **Step 7: Browser walkthrough test**

- Create new document → golongan table renders with hierarchy, kriteria table renders with labels
- Add divisi → principal → brand rows → hierarchy works
- Input target/tercapai → % and KET auto-calculate
- Input kriteria values → % and KET auto-calculate
- Save → verify values persist
- Load existing flat document → renders as top-level items, kriteria values empty
- Role check: officer can edit values, observer read-only

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Documents.jsx client/src/App.jsx client/src/App.css
git commit -m "feat(client): golongan hierarchy table + kriteria table for incentive document format"
```
