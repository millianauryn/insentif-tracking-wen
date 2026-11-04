import { describe, expect, it } from 'vitest';
import { computeTotalFor } from './golongan';

const rows = [
  { type: 'principal', label: 'PULAU BARU', target: 100, achievement: 50 },
  { type: 'brand', label: 'PASEO', target: 200, achievement: 250 },
  { type: 'total-divisi', label: 'TOTAL DIVISI', target: '', achievement: '' },
  { type: 'principal', label: 'GRP 2', target: 30, achievement: 10 },
  { type: 'brand', label: 'NICE', target: 70, achievement: 90 },
  { type: 'total', label: 'TOTAL', target: '', achievement: '' },
];

describe('computeTotalFor', () => {
  it('total sums every principal + brand row (target & achievement)', () => {
    expect(computeTotalFor(rows, 5)).toEqual({ target: 400, achievement: 400 });
  });

  it('total-divisi sums only its section (since previous total row)', () => {
    expect(computeTotalFor(rows, 2)).toEqual({ target: 300, achievement: 300 });
    // second section starts after first total row
    const withSecondTotal = [...rows];
    withSecondTotal.splice(5, 0, { type: 'total-divisi', label: 'TOTAL DIVISI 2' });
    expect(computeTotalFor(withSecondTotal, 5)).toEqual({ target: 100, achievement: 100 });
  });

  it('excludes other total rows from sums (no double-count)', () => {
    const result = computeTotalFor(rows, 5);
    expect(result.target).toBe(100 + 200 + 30 + 70);
  });

  it('returns zeros for empty or valueless rows', () => {
    expect(computeTotalFor([{ type: 'total', label: 'TOTAL' }], 0)).toEqual({ target: 0, achievement: 0 });
    expect(computeTotalFor([], 0)).toEqual({ target: 0, achievement: 0 });
  });
});
