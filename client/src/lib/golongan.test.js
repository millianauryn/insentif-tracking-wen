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
  it('sums brand children when present (manual values ignored)', () => {
    expect(principalValueFor(rows, 1)).toEqual({ target: 230, achievement: 260 });
  });

  it('uses manual values when the principal has no brand children', () => {
    expect(principalValueFor(rows, 5)).toEqual({ target: 999, achievement: 999 });
  });
});

describe('computeTotalFor', () => {
  it('total-divisi sums its section: standalone brand + principal effective value (no double-count)', () => {
    // section = B0 (standalone) + P1 effective value (children counted once via P1)
    expect(computeTotalFor(rows, 4)).toEqual({ target: 5 + 230, achievement: 5 + 260 });
  });

  it('total = standalone brands + all principal effective values', () => {
    expect(computeTotalFor(rows, 6)).toEqual({ target: 5 + 230 + 999, achievement: 5 + 260 + 999 });
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
    // P1 covers B1 (20/20); after T1 the orphan brand is standalone again (7/7)
    expect(computeGrandTotal(split)).toEqual({ target: 27, achievement: 27 });
  });

  it('does not double-count children under a principal', () => {
    const simple = [
      { type: 'principal', label: 'P', target: 1, achievement: 1 },
      { type: 'brand', label: 'B', target: 100, achievement: 50 },
    ];
    expect(computeGrandTotal(simple)).toEqual({ target: 100, achievement: 50 });
  });
});
