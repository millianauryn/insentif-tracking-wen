// Principal value: takes target & achievement from the row immediately above,
// not from brand children below.
export function principalValueFor(rows, pi) {
  if (pi > 0) {
    const above = rows[pi - 1];
    return {
      target: Number(above.target) || 0,
      achievement: Number(above.achievement) || 0,
    };
  }
  return { target: Number(rows[pi]?.target) || 0, achievement: Number(rows[pi]?.achievement) || 0 };
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
    if (r.type === 'total-divisi' || r.type === 'total' || r.type === 'divisi') {
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
      if (rows[i].type === 'total-divisi' || rows[i].type === 'total' || rows[i].type === 'divisi') { start = i + 1; break; }
    }
  }
  const scope = rows.slice(start, row.type === 'total' ? rows.length : rowIndex);
  return sumScope(scope);
}

// Grand total over the whole table (summary cards + kwitansi Total Keseluruhan)
export function computeGrandTotal(rows) {
  return sumScope(rows);
}
