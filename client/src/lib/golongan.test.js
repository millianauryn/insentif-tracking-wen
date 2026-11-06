import { describe, expect, it } from 'vitest';
import { computeTotalFor, computeGrandTotal, principalValueFor } from './golongan';

// P1 has children → its value = children sum (manual 999 ignored)
// P2 has no children → manual value
// brand B0 before any principal → standalone (counts in totals directly)
const rows = [
  { type: 'brand', label: 'STANDALONE', target: 5, achievement: 5 },
  { type: 'principal', label: 'P1', target: 999, achievement: 999 },
  { type: 'brand', label: 'B1', target: 200, achievement: 250 },
  { type: 'brand', label: 'B2', target: 30, achievement: 10 },
  { type: 'total-divisi', label: 'TOTAL DIVISI', target: '', achievement: '' },
  { type: 'principal', label: 'P2', target: 999, achievement: 999 },
  { type: 'total', label: 'TOTAL', target: '', achievement: '' },
];

describe('principalValueFor', () => {
  it('takes values from the row above', () => {
    // P1 at index 1 → row above is STANDALONE brand (5/5)
    expect(principalValueFor(rows, 1)).toEqual({ target: 5, achievement: 5 });
  });

  it('uses own manual values when at index 0', () => {
    // P at index 0 → no row above, uses own values
    expect(principalValueFor([{ type: 'principal', label: 'P', target: 999, achievement: 999 }], 0)).toEqual({ target: 999, achievement: 999 });
  });
});

describe('computeTotalFor', () => {
  it('total-divisi sums its section: standalone brand + principal effective value (no double-count)', () => {
    // section = B0 (standalone 5/5) + P1 effective value (from row above = 5/5)
    expect(computeTotalFor(rows, 4)).toEqual({ target: 10, achievement: 10 });
  });

  it('total = standalone brands + all principal effective values', () => {
    // B0 (5/5) + P1 (from above = 5/5) + TOTAL DIVISI reset + P2 (from above TOTAL DIVISI = 0/0)
    expect(computeTotalFor(rows, 6)).toEqual({ target: 10, achievement: 10 });
  });

  it('returns zeros for missing rows', () => {
    expect(computeTotalFor([], 0)).toEqual({ target: 0, achievement: 0 });
  });
});

describe('computeGrandTotal', () => {
  it('matches the grand total row math', () => {
    expect(computeGrandTotal(rows)).toEqual(computeTotalFor(rows, 6));
  });

  it('resets standalone tracking after a total row', () => {
    const split = [
      { type: 'principal', label: 'P1', target: 10, achievement: 10 },
      { type: 'brand', label: 'B1', target: 20, achievement: 20 },
      { type: 'total-divisi', label: 'T1' },
      { type: 'brand', label: 'B_orphan', target: 7, achievement: 7 },
    ];
    // P1 at index 0 → own values (10/10); B1 under P1 skipped; T1 reset; B_orphan standalone (7/7)
    expect(computeGrandTotal(split)).toEqual({ target: 17, achievement: 17 });
  });

  it('does not double-count children under a principal', () => {
    const simple = [
      { type: 'principal', label: 'P', target: 1, achievement: 1 },
      { type: 'brand', label: 'B', target: 100, achievement: 50 },
    ];
    // P at index 0 → own values (1/1); B under P skipped
    expect(computeGrandTotal(simple)).toEqual({ target: 1, achievement: 1 });
  });
});
