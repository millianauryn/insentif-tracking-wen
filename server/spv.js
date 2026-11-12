// Agregasi dokumen SPV: golongan + kriteria dijumlah dari dokumen sales Final
// milik anak sales di bawah SPV, untuk rentang periode tertentu.

// Cabang yang diwakili sebuah posisi (junction position_branches + branch_id utama).
function branchesOfPosition(db, positionId) {
  const ids = db.prepare('SELECT branch_id FROM position_branches WHERE position_id = ?').all(positionId).map((r) => r.branch_id);
  const primary = db.prepare('SELECT branch_id FROM positions WHERE id = ?').get(positionId);
  if (primary && primary.branch_id && !ids.includes(primary.branch_id)) ids.push(primary.branch_id);
  return ids;
}

// Cakupan: SPV harus ada, bertipe SPV, dan punya cabang yang sama dengan officer.
// Superadmin bebas (perilaku isSuper yang sudah dipakai di halaman sales).
function spvScopeError(db, user, positionId) {
  const id = Number(positionId);
  if (!Number.isInteger(id)) return 'Pilih SPV terlebih dahulu.';
  const position = db.prepare('SELECT id, position_type FROM positions WHERE id = ?').get(id);
  if (!position) return 'SPV tidak ditemukan.';
  if (position.position_type !== 'SPV') return 'Posisi yang dipilih bukan SPV.';
  if (user && user.role === 'superadmin') return null;
  const own = (user && user.branch_ids) || [];
  const scopes = branchesOfPosition(db, id);
  if (!scopes.some((b) => own.includes(b))) return 'SPV di luar cabang yang di-assign ke akun Anda.';
  return null;
}

// Dokumen sales Final milik anak SPV dalam rentang periode.
function sourceDocuments(db, positionId, periodStart, periodEnd) {
  const sales = db.prepare("SELECT id, name FROM positions WHERE parent_position_id = ? AND position_type = 'SALES'").all(positionId);
  if (!sales.length) return [];
  const names = sales.map((s) => s.name.toLowerCase());
  const placeholders = names.map(() => '?').join(',');
  return db.prepare(`
    SELECT * FROM incentive_documents
    WHERE doc_kind = 'sales' AND status = 'Final'
      AND period >= ? AND period <= ?
      AND lower(trim(salesman)) IN (${placeholders})
  `).all(periodStart, periodEnd, ...names);
}

function computeSpvRows(db, positionId, periodStart, periodEnd) {
  const documents = sourceDocuments(db, positionId, periodStart, periodEnd);
  const ids = documents.map((d) => d.id);
  const golongan_rows = [];
  const criteria_rows = [];
  const criteriaAcc = new Map();

  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    // Baris data = is_group 0 (baris brand). Baris group/total dilewati supaya tidak dobel.
    const leaf = db.prepare(`
      SELECT principal_id, brand_id, label, target, achievement FROM golongan_rows
      WHERE is_group = 0 AND document_id IN (${ph})
    `).all(...ids);
    const groups = new Map();
    for (const row of leaf) {
      const key = `${row.principal_id ?? 0}|${row.brand_id ?? 0}|${(row.label || '').trim().toLowerCase()}`;
      const acc = groups.get(key) || {
        principal_id: row.principal_id ?? null,
        brand_id: row.brand_id ?? null,
        label: row.label ?? null,
        target: 0,
        achievement: 0,
      };
      acc.target += Number(row.target) || 0;
      acc.achievement += Number(row.achievement) || 0;
      groups.set(key, acc);
    }
    const principalName = new Map(db.prepare('SELECT id, name FROM principals').all().map((p) => [p.id, p.name]));
    const brandName = new Map(db.prepare('SELECT id, name FROM brands').all().map((b) => [b.id, b.name]));
    for (const acc of groups.values()) {
      golongan_rows.push({
        principal_id: acc.principal_id,
        principal_name: acc.principal_id ? (principalName.get(acc.principal_id) ?? null) : null,
        brand_id: acc.brand_id,
        brand_name: acc.brand_id ? (brandName.get(acc.brand_id) ?? null) : null,
        label: acc.label,
        target: acc.target,
        achievement: acc.achievement,
      });
    }
    golongan_rows.sort((a, b) =>
      `${a.principal_name || ''}|${a.brand_name || a.label || ''}`.localeCompare(`${b.principal_name || ''}|${b.brand_name || b.label || ''}`)
    );

    const critRows = db.prepare(`
      SELECT criteria_id, target_value, achievement_value FROM document_criteria_rows
      WHERE document_id IN (${ph})
    `).all(...ids);
    const acc = criteriaAcc;
    for (const row of critRows) {
      const cur = acc.get(row.criteria_id) || { target_value: 0, achievement_value: 0 };
      cur.target_value += Number(row.target_value) || 0;
      cur.achievement_value += Number(row.achievement_value) || 0;
      acc.set(row.criteria_id, cur);
    }
  }

  // Kriteria: semua kriteria aktif, nilai dijumlah dari dokumen sales (0 bila tidak ada data).
  const definitions = db.prepare('SELECT id, label, target_unit, formula, sort_order FROM criteria_definitions WHERE active = 1 ORDER BY sort_order, id').all();
  for (const def of definitions) {
    const hit = criteriaAcc.get(def.id);
    criteria_rows.push({
      criteria_id: def.id,
      label: def.label,
      target_unit: def.target_unit,
      formula: def.formula,
      target_value: hit ? hit.target_value : 0,
      achievement_value: hit ? hit.achievement_value : 0,
      incentive_amount: null,
      sort_order: def.sort_order,
    });
  }

  return { golongan_rows, criteria_rows };
}

module.exports = { spvScopeError, computeSpvRows };
