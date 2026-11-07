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
  it('sums brand children below (manual values ignored)', () => {
    // P1 at index 1 → children B1 (200/250) + B2 (30/10) = 230/260, manual 999 ignored
    expect(principalValueFor(rows, 1)).toEqual({ target: 230, achievement: 260 });
  });

  it('uses own manual values when it has no brand children', () => {
    // P2 at index 5 → no brand below → own 999/999
    expect(principalValueFor(rows, 5)).toEqual({ target: 999, achievement: 999 });
  });
});

describe('computeTotalFor', () => {
  it('total-divisi sums its section: standalone brand + principal effective value (no double-count)', () => {
    // section = B0 (standalone 5/5) + P1 effective value (children 230/260), no divisi header so fallback separator logic
    expect(computeTotalFor(rows, 4)).toEqual({ target: 235, achievement: 265 });
  });

  it('total-divisi with divisi selector only sums the matching Divisi section above it', () => {
    const divisiRows = [
      { type: 'divisi', divisi: 'D1' },
      { type: 'brand', label: 'B1', target: 100, achievement: 80 },
      { type: 'divisi', divisi: 'D2' },
      { type: 'brand', label: 'B2', target: 50, achievement: 40 },
      { type: 'total-divisi', label: 'TOTAL DIVISI', divisi: 'D2' },
    ];
    // TD selects D2 -> only B2 section (50/40)
    expect(computeTotalFor(divisiRows, 4)).toEqual({ target: 50, achievement: 40 });
  });

  it('total = standalone brands + all principal effective values', () => {
    // B0 (5/5) + P1 (children 230/260) + P2 (manual 999/999), TOTAL DIVISI resets standalone tracking
    expect(computeTotalFor(rows, 6)).toEqual({ target: 1234, achievement: 1264 });
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
    // P1 covers B1 (20/20); after T1 the orphan brand runs standalone again (7/7)
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
