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
