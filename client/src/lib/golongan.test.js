import { describe, expect, it } from 'vitest';
import { computeTotalFor, computeGrandTotal, principalValueFor } from './golongan';

// B0 before P1 → linked (absorbed into P1's auto sum)
// P1 manual empty → auto from B0 above; P2 manual 999 → overrides (no brand above after TD separator)
const rows = [
  { type: 'brand', label: 'STANDALONE', target: 5, achievement: 5 },
  { type: 'principal', label: 'P1', target: '', achievement: '' },
  { type: 'brand', label: 'B1', target: 200, achievement: 250 },
  { type: 'brand', label: 'B2', target: 30, achievement: 10 },
  { type: 'total-divisi', label: 'TOTAL DIVISI', target: '', achievement: '' },
  { type: 'principal', label: 'P2', target: 999, achievement: 999 },
  { type: 'total', label: 'TOTAL', target: '', achievement: '' },
];

describe('principalValueFor', () => {
  it('auto-sums brand rows above it (linked brands) when manual is empty', () => {
    // P1 at index 1 → brand above B0 is standalone (5/5), but B0 belongs to P1 after revert? P1 sees B0 above.
    expect(principalValueFor(rows, 1)).toEqual({ target: 5, achievement: 5 });
  });

  it('uses manual values when filled (auto overridden)', () => {
    const withManual = [
      { type: 'brand', label: 'B0', target: 500, achievement: 400 },
      { type: 'principal', label: 'P', target: 999, achievement: 888 },
    ];
    expect(principalValueFor(withManual, 1)).toEqual({ target: 999, achievement: 888 });
  });

  it('uses own manual values when it has no brand above', () => {
    // P at index 0 → no brand above, own 999/999
    expect(principalValueFor([{ type: 'principal', label: 'P', target: 999, achievement: 999 }], 0)).toEqual({ target: 999, achievement: 999 });
  });

  it('sums linked brands above after a separator, per field override', () => {
    const linked = [
      { type: 'brand', label: 'B1', target: 200, achievement: 250 },
      { type: 'brand', label: 'B2', target: 30, achievement: 10 },
      { type: 'principal', label: 'P', target: '', achievement: 777 },
    ];
    // auto target 230, manual achievement 777
    expect(principalValueFor(linked, 2)).toEqual({ target: 230, achievement: 777 });
  });
});

describe('computeTotalFor', () => {
  it('total-divisi sums its section: standalone brand + principal effective value (no double-count)', () => {
    // B0 absorbed into P1 (auto 5/5) + B1/B2 standalone flushed at TD (230/260) = 235/265
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
    // TD section (235/265) + P2 manual (999/999, no brand above after TD separator)
    expect(computeTotalFor(rows, 6)).toEqual({ target: 1234, achievement: 1264 });
  });

  it('screenshot case: brand above principal auto-fills principal', () => {
    const shot = [
      { type: 'brand', label: 'ADEM SARI', target: 100000, achievement: 10000 },
      { type: 'principal', label: 'ENESIS', target: '', achievement: '' },
    ];
    expect(principalValueFor(shot, 1)).toEqual({ target: 100000, achievement: 10000 });
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
      { type: 'principal', label: 'P1', target: '', achievement: '' },
      { type: 'brand', label: 'B1', target: 20, achievement: 20 },
      { type: 'total-divisi', label: 'T1' },
      { type: 'brand', label: 'B_orphan', target: 7, achievement: 7 },
    ];
    // P1 at index 0: no brand above + no manual -> 0; B1 buffers then flushed at T1 (20/20); B0rphan standalone (7/7)
    expect(computeGrandTotal(split)).toEqual({ target: 27, achievement: 27 });
  });

  it('does not double-count brands absorbed by the principal above', () => {
    const simple = [
      { type: 'brand', label: 'B', target: 100, achievement: 50 },
      { type: 'principal', label: 'P', target: '', achievement: '' },
    ];
    // B absorbed into P (100/50), not counted twice
    expect(computeGrandTotal(simple)).toEqual({ target: 100, achievement: 50 });
  });
});
