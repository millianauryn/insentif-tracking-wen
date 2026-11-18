import { describe, expect, it } from 'vitest';
import { docMatchesScope, docMatchesPeriodeRange, sortDocsByHierarchy } from './docHierarchy';

const positions = [
  { id: 1, name: 'BM1', position_type: 'BM', parent_position_id: null, branch_id: 1 },
  { id: 2, name: 'SPVA', position_type: 'SPV', parent_position_id: 1, branch_id: 1 },
  { id: 3, name: 'SPVB', position_type: 'SPV', parent_position_id: 1, branch_id: 1 },
  { id: 4, name: 'SAL1', position_type: 'SALES', parent_position_id: 2, branch_id: 1 },
  { id: 5, name: 'SAL2', position_type: 'SALES', parent_position_id: 2, branch_id: 1 },
  { id: 6, name: 'SAL3', position_type: 'SALES', parent_position_id: 3, branch_id: null },
];
const branches = [
  { id: 1, name: 'CAB1', city: 'KOTA A', region_id: 1, regions: [] },
  { id: 2, name: 'CAB2', city: 'KOTA B', region_id: 2, regions: [] },
];
const names = new Map(positions.map((p) => [p.name, p]));
const scope = { positions, branches, positionByName: names };

const doc = (salesman, positionId, period = '2026-09', extra = {}) => ({
  id: positionId, salesman, salesman_position_id: positionId, doc_kind: 'sales', period, ...extra,
});

describe('docMatchesScope', () => {
  it('filter cabang memakai posisi Sales, dengan fallback parent untuk posisi tanpa cabang', () => {
    expect(docMatchesScope(doc('SAL1', 4), { branchId: 1 }, scope)).toBe(true);
    expect(docMatchesScope(doc('SAL3', 6), { branchId: 1 }, scope)).toBe(true);
    expect(docMatchesScope(doc('SAL1', 4), { branchId: 2 }, scope)).toBe(false);
  });

  it('filter area memakai relasi branch → region', () => {
    expect(docMatchesScope(doc('SAL1', 4), { areaId: 1 }, scope)).toBe(true);
    expect(docMatchesScope(doc('SAL1', 4), { areaId: 2 }, scope)).toBe(false);
  });

  it('dokumen lama tanpa posisi tetap cocok lewat wilayah (kota)', () => {
    const legacy = { salesman: 'SAL1', period: '2026-09', wilayah: 'KOTA A' };
    expect(docMatchesScope(legacy, { branchId: 1 }, scope)).toBe(true);
    expect(docMatchesScope(legacy, { branchId: 2 }, scope)).toBe(false);
  });
});

describe('docMatchesPeriodeRange', () => {
  it('menampilkan dokumen yang bersentuhan dengan rentang', () => {
    expect(docMatchesPeriodeRange(doc('SAL1', 4), '2026-09', '2026-10')).toBe(true);
    expect(docMatchesPeriodeRange(doc('SAL1', 4, '2026-12'), '2026-09', '2026-10')).toBe(false);
    expect(docMatchesPeriodeRange({ period: '2026-09', period_end: '2026-11', doc_kind: 'spv' }, '2026-10', '2026-10')).toBe(true);
    expect(docMatchesPeriodeRange(doc('SAL1', 4), '', '2026-10')).toBe(false);
  });
});

describe('sortDocsByHierarchy', () => {
  it('BM, lalu SPV diikuti sales-salesnya, sesuai urutan posisi', () => {
    const rows = [
      doc('SAL3', 6), doc('SAL1', 4), doc('SPVB', 3), doc('SAL2', 5), doc('SPVA', 2), doc('BM1', 1),
    ];
    expect(sortDocsByHierarchy(rows, positions, names).map((d) => d.salesman))
      .toEqual(['BM1', 'SPVA', 'SAL1', 'SAL2', 'SPVB', 'SAL3']);
  });

  it('dokumen tanpa data jabatan ditempatkan di akhir', () => {
    const rows = [doc('Orphan', null), doc('SAL1', 4), doc('BM1', 1)];
    expect(sortDocsByHierarchy(rows, positions, names).map((d) => d.salesman))
      .toEqual(['BM1', 'SAL1', 'Orphan']);
  });
});
