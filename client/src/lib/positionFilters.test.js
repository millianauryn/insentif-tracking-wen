import { describe, expect, it } from 'vitest';
import { parentOptionsFor, keepValidParent } from './positionFilters';

const positions = [
  { id: 1, name: 'BUDI', position_type: 'BM', active: 1, branch_ids: [1] },
  { id: 2, name: 'TEST1', position_type: 'BM', active: 1, branch_ids: [6] },
  { id: 3, name: 'BUDO', position_type: 'SPV', active: 1, branch_ids: [1] },
  { id: 4, name: 'TEST A', position_type: 'SPV', active: 1, branch_ids: [6] },
  { id: 5, name: 'NONAKTIF', position_type: 'BM', active: 0, branch_ids: [1] },
];

describe('parentOptionsFor', () => {
  it('belum pilih cabang → tidak ada kandidat', () => {
    expect(parentOptionsFor(positions, 'SPV', [])).toEqual([]);
    expect(parentOptionsFor(positions, 'SPV', null)).toEqual([]);
  });

  it('pilih cabang → hanya atasan yang link ke cabang itu', () => {
    expect(parentOptionsFor(positions, 'SPV', [1]).map((p) => p.name)).toEqual(['BUDI']);
    expect(parentOptionsFor(positions, 'SPV', [6]).map((p) => p.name)).toEqual(['TEST1']);
  });

  it('beberapa cabang → atasan dari semua cabang terpilih', () => {
    expect(parentOptionsFor(positions, 'SPV', [1, 6]).map((p) => p.name)).toEqual(['BUDI', 'TEST1']);
  });

  it('SALES mencari SPV, SPV mencari BM, BM tidak butuh atasan', () => {
    expect(parentOptionsFor(positions, 'SALES', [1]).map((p) => p.name)).toEqual(['BUDO']);
    expect(parentOptionsFor(positions, 'BM', [1])).toEqual([]);
  });

  it('posisi nonaktif tidak ditawarkan', () => {
    expect(parentOptionsFor(positions, 'SPV', [1]).map((p) => p.name)).not.toContain('NONAKTIF');
  });
});

describe('keepValidParent', () => {
  it('atasan masih ada di cabang baru → dipertahankan', () => {
    expect(keepValidParent(positions, [1], '1')).toBe('1');
    expect(keepValidParent(positions, [1], 1)).toBe(1);
  });

  it('atasan keluar dari cabang baru → dibuang', () => {
    expect(keepValidParent(positions, [6], '1')).toBe('');
  });

  it('tanpa atasan terpilih / tidak dikenal → string kosong', () => {
    expect(keepValidParent(positions, [1], '')).toBe('');
    expect(keepValidParent(positions, [1], '999')).toBe('');
  });
});
