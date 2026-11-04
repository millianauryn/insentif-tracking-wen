// Total rows auto-sum principal + brand rows (target & achievement).
// 'total' = every item row; 'total-divisi' = item rows since the previous total row (its section).
export function computeTotalFor(rows, rowIndex) {
  const isItem = (r) => r.type === 'brand' || r.type === 'principal';
  const row = rows[rowIndex];
  if (!row) return { target: 0, achievement: 0 };
  const items = row.type === 'total'
    ? rows.filter(isItem)
    : (() => {
        let prev = -1;
        for (let i = rowIndex - 1; i >= 0; i--) {
          if (rows[i].type === 'total-divisi' || rows[i].type === 'total') { prev = i; break; }
        }
        return rows.slice(prev + 1, rowIndex).filter(isItem);
      })();
  return {
    target: items.reduce((s, r) => s + (Number(r.target) || 0), 0),
    achievement: items.reduce((s, r) => s + (Number(r.achievement) || 0), 0),
  };
}
