import { describe, expect, it } from 'vitest';
import { docPeriodLabel, docMatchesPeriode, docMatchesSpv, docMatchesYear } from './docFilters';

describe('filter tahun dokumen', () => {
  const spv = { doc_kind: 'spv', period: '2026-11', period_end: '2027-02', salesman: 'BUDO' };
  const sales = { doc_kind: 'sales', period: '2026-10', period_end: null, salesman: 'SARI' };

  it('dokumen cocok dengan tahun periodenya', () => {
    expect(docMatchesYear(sales, 2026)).toBe(true);
    expect(docMatchesYear(sales, '2025')).toBe(false);
  });

  it('rentang SPV yang melewati tahun ikut di kedua tahun', () => {
    expect(docMatchesYear(spv, 2026)).toBe(true);
    expect(docMatchesYear(spv, 2027)).toBe(true);
    expect(docMatchesYear(spv, 2028)).toBe(false);
  });

  it('tanpa tahun semua dokumen lolos', () => {
    expect(docMatchesYear(sales, '')).toBe(true);
  });
});

describe('filter dokumen SPV', () => {
  const spv = { doc_kind: 'spv', period: '2026-09', period_end: '2026-11', position_id: 2, salesman: 'BUDO' };
  const sales = { doc_kind: 'sales', period: '2026-10', position_id: null, salesman: 'SARI' };

  it('label rentang untuk SPV, satu bulan untuk sales', () => {
    expect(docPeriodLabel(spv)).toBe('September 2026 – November 2026');
    expect(docPeriodLabel(sales)).toBe('Oktober 2026');
  });

  it('rentang SPV cocok di setiap bulan yang dinaungi', () => {
    expect(docMatchesPeriode(spv, '2026-09')).toBe(true);
    expect(docMatchesPeriode(spv, '2026-10')).toBe(true);
    expect(docMatchesPeriode(spv, '2026-11')).toBe(true);
    expect(docMatchesPeriode(spv, '2026-12')).toBe(false);
  });

  it('dokumen sales tetap cocok persis', () => {
    expect(docMatchesPeriode(sales, '2026-10')).toBe(true);
    expect(docMatchesPeriode(sales, '2026-11')).toBe(false);
  });

  it('tanpa filter bulan semua dokumen lolos', () => {
    expect(docMatchesPeriode(spv, '')).toBe(true);
    expect(docMatchesPeriode(sales, '')).toBe(true);
  });

  it('dokumen SPV sendiri muncul saat filter SPV', () => {
    expect(docMatchesSpv(spv, 2)).toBe(true);
    expect(docMatchesSpv(spv, 3)).toBe(false);
  });

  it('dokumen sales anak SPV tetap muncul saat filter SPV', () => {
    expect(docMatchesSpv(sales, 2, ['SARI', 'RUDI'])).toBe(true);
    expect(docMatchesSpv(sales, 2, ['RUDI'])).toBe(false);
  });

  it('tanpa filter SPV semua dokumen lolos', () => {
    expect(docMatchesSpv(spv, '')).toBe(true);
    expect(docMatchesSpv(sales, '')).toBe(true);
  });
});
