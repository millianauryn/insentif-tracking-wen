// Auto sum for a principal: sum of brand rows above it since last separator (linked brands).
// Manual override: non-empty row.target / row.achievement replaces the auto sum (per field).
export function principalAutoValue(rows, pi) {
  let target = 0;
  let achievement = 0;
  let count = 0;
  for (let i = pi - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.type === 'principal' || r.type === 'total-divisi' || r.type === 'total' || r.type === 'divisi') break;
    if (r.type === 'brand') {
      target += Number(r.target) || 0;
      achievement += Number(r.achievement) || 0;
      count++;
    }
  }
  return { target, achievement, count };
}

export function principalValueFor(rows, pi) {
  const p = rows[pi];
  const auto = principalAutoValue(rows, pi);
  const manualTarget = p.target !== '' && p.target !== null && p.target !== undefined;
  const manualAchievement = p.achievement !== '' && p.achievement !== null && p.achievement !== undefined;
  return {
    target: manualTarget ? Number(p.target) || 0 : auto.target,
    achievement: manualAchievement ? Number(p.achievement) || 0 : auto.achievement,
  };
}

// Sum a scope without double-counting: brands linked above a principal are
// counted once through the principal, standalone brands (no principal below
// in their segment) count directly. Total/divisi rows reset, never add.
function sumScope(scope) {
  let target = 0;
  let achievement = 0;
  let pendingTarget = 0;
  let pendingAchievement = 0;
  let pending = 0;
  const flush = () => { target += pendingTarget; achievement += pendingAchievement; pendingTarget = 0; pendingAchievement = 0; pending = 0; };
  for (let i = 0; i < scope.length; i++) {
    const r = scope[i];
    if (r.type === 'total-divisi' || r.type === 'total' || r.type === 'divisi') { flush(); continue; }
    if (r.type === 'principal') {
      const v = principalValueFor(scope, i);
      target += v.target;
      achievement += v.achievement;
      pendingTarget = 0; pendingAchievement = 0; pending = 0;
      continue;
    }
    if (r.type === 'brand') {
      pendingTarget += Number(r.target) || 0;
      pendingAchievement += Number(r.achievement) || 0;
      pending++;
    }
  }
  flush();
  return { target, achievement };
}

// Total rows auto-sum principal + brand rows (target & achievement).
// 'total' = whole table; 'total-divisi' = rows since the Divisi header above
// (matching row.divisi if set, else nearest Divisi header; fallback: previous total/divisi separator).
export function computeTotalFor(rows, rowIndex) {
  const row = rows[rowIndex];
  if (!row) return { target: 0, achievement: 0 };
  if (row.type === 'total-divisi') {
    let start = 0;
    let found = false;
    for (let i = rowIndex - 1; i >= 0; i--) {
      if (rows[i].type !== 'divisi') continue;
      if (row.divisi && (rows[i].divisi || rows[i].label) !== row.divisi) continue;
      start = i + 1;
      found = true;
      break;
    }
    if (!found) {
      for (let i = rowIndex - 1; i >= 0; i--) {
        if (rows[i].type === 'total-divisi' || rows[i].type === 'total' || rows[i].type === 'divisi') { start = i + 1; break; }
      }
    }
    return sumScope(rows.slice(start, rowIndex));
  }
  let start = 0;
  if (row.type !== 'total') {
    for (let i = rowIndex - 1; i >= 0; i--) {
      if (rows[i].type === 'total-divisi' || rows[i].type === 'total') { start = i + 1; break; }
    }
  }
  const scope = rows.slice(start, row.type === 'total' ? rows.length : rowIndex);
  return sumScope(scope);
}

// Grand total over the whole table (summary cards + kwitansi Total Keseluruhan)
export function computeGrandTotal(rows) {
  return sumScope(rows);
}

// Payload baris golongan untuk API: label + angka + id brand/principal dari master.
// Id dipakai agregasi SPV (kelompokkan per principal/brand), jadi wajib tersimpan.
// shortcut: Divisi disimpan sebagai prefix label "DIVISI:<nama>", Total Divisi "TOTALDIVISI:<nama>".
export function buildGolonganRowsPayload(rows, masterData = {}) {
  const brands = masterData.brands || [];
  const principals = masterData.principals || [];
  const byName = (list, label) =>
    list.find((x) => (x.name || '').trim().toLowerCase() === (label || '').trim().toLowerCase());
  const filtered = (rows || []).filter((row) => row.label || row.target || row.achievement || row.divisi);
  let lastPrincipalIndex;
  return filtered.map((row, index) => {
    const result = {
      label: row.type === 'divisi'
        ? `DIVISI:${row.divisi || ''}`
        : row.type === 'total-divisi'
          ? (row.divisi ? `TOTALDIVISI:${row.divisi}` : row.label || 'TOTAL DIVISI')
          : row.label || null,
      is_group: row.isGroup || false,
      target: row.target !== undefined && row.target !== '' ? Number(row.target) : null,
      achievement: row.achievement !== undefined && row.achievement !== '' ? Number(row.achievement) : null,
      sort_order: index,
    };
    // Divisi/total rows start a new section and never take a parent
    if (row.type === 'divisi' || row.type === 'total-divisi' || row.type === 'total') {
      lastPrincipalIndex = undefined;
      return result;
    }
    if (row.type === 'principal') {
      lastPrincipalIndex = index;
      const principal = byName(principals, row.label);
      if (principal) result.principal_id = principal.id;
      return result;
    }
    const brand = byName(brands, row.label);
    if (brand) {
      result.brand_id = brand.id;
      result.principal_id = brand.principal_id ?? null;
    }
    if (lastPrincipalIndex !== undefined) result.parent_index = lastPrincipalIndex;
    return result;
  });
}
