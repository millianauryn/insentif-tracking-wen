import { describe, expect, it } from 'vitest';
import { isGugurCriteria } from './criteria';

describe('isGugurCriteria', () => {
  it('pencapaian di bawah target adalah Gugur', () => {
    expect(isGugurCriteria({ label: 'EFFECTIVE CALLS', target_value: '100', achievement_value: '80' })).toBe(true);
  });

  it('pencapaian sampai 100% tidak Gugur', () => {
    expect(isGugurCriteria({ label: 'EFFECTIVE CALLS', target_value: '100', achievement_value: '100' })).toBe(false);
  });

  it('TOTAL OMZET memakai target tetap 100%', () => {
    expect(isGugurCriteria({ label: 'TOTAL OMZET', target_value: '100', achievement_value: '99' })).toBe(true);
    expect(isGugurCriteria({ label: 'TOTAL OMZET', target_value: '100', achievement_value: '120' })).toBe(false);
  });

  it('tanpa target tidak dihitung Gugur', () => {
    expect(isGugurCriteria({ label: 'EFFECTIVE CALLS', target_value: '', achievement_value: '' })).toBe(false);
  });
});
