// Principal value: if it has brand children (rows until next principal/total), value = sum of
// those brands (target & achievement); otherwise the principal's own manual inputs.
export function principalValueFor(rows, pi) {
  const p = rows[pi];
  let target = 0;
  let achievement = 0;
  let children = 0;
  for (let i = pi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.type === 'principal' || r.type === 'total-divisi' || r.type === 'total') break;
    if (r.type === 'brand') {
      target += Number(r.target) || 0;
      achievement += Number(r.achievement) || 0;
      children++;
    }
  }
  if (children > 0) return { target, achievement };
  return { target: Number(p.target) || 0, achievement: Number(p.achievement) || 0 };
}

// Sum a scope without double-counting: principals contribute their effective value
// (children counted once through the principal), brands count only while outside any
// principal section (standalone). Total rows reset the standalone flag, never add.
function sumScope(scope) {
  let target = 0;
  let achievement = 0;
  let seenPrincipal = false;
  for (let i = 0; i < scope.length; i++) {
    const r = scope[i];
    if (r.type === 'total-divisi' || r.type === 'total') {
      seenPrincipal = false;
      continue;
    }
    if (r.type === 'principal') {
      seenPrincipal = true;
      const v = principalValueFor(scope, i);
      target += v.target;
      achievement += v.achievement;
    } else if (r.type === 'brand' && !seenPrincipal) {
      target += Number(r.target) || 0;
      achievement += Number(r.achievement) || 0;
    }
  }
  return { target, achievement };
}

// Total rows auto-sum principal + brand rows (target & achievement).
// 'total' = whole table; 'total-divisi' = rows since the previous total row (its section).
export function computeTotalFor(rows, rowIndex) {
  const row = rows[rowIndex];
  if (!row) return { target: 0, achievement: 0 };
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
