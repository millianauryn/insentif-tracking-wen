import { describe, expect, it } from 'vitest';
import { branchRegionIds, cityOf, filterBranches, buildOrgTree, pruneTree, countPositions } from './orgTree';

const regions = [
  { id: 1, name: 'Kalimantan' },
  { id: 2, name: 'Jawa' },
];

const branches = [
  { id: 10, name: 'Cabang A', city: 'Banjarmasin', regions: [{ id: 1 }] },
  { id: 11, name: 'Cabang B', city: 'Banjarbaru', regions: [{ id: 1 }] },
  { id: 12, name: 'Cabang C', city: 'Surabaya', regions: [{ id: 2 }] },
  { id: 13, name: 'Cabang D', city: 'Pontianak', regions: [] }, // belum ada area
];

const positions = [
  { id: 1, name: 'BUDI', position_type: 'BM', parent_position_id: null, branch_id: 10, active: 1 },
  { id: 2, name: 'BUDO', position_type: 'SPV', parent_position_id: 1, branch_id: 10, active: 1 },
  { id: 3, name: 'BIDU', position_type: 'SALES', parent_position_id: 2, branch_id: 10, active: 1 },
  // Parent-nya di cabang lain → jadi akar di cabang ini, jangan hilang.
  { id: 4, name: 'DONI', position_type: 'SALES', parent_position_id: 2, branch_id: 11, active: 1 },
];

const tree = buildOrgTree({ regions, branches, positions });

describe('branchRegionIds / cityOf', () => {
  it('memakai junction regions, fallback region_id utama', () => {
    expect(branchRegionIds({ regions: [{ id: 5 }] })).toEqual([5]);
    expect(branchRegionIds({ region_id: 7 })).toEqual([7]);
    expect(branchRegionIds({})).toEqual([]);
  });

  it('city kosong jadi (tanpa wilayah)', () => {
    expect(cityOf({ city: 'Banjarmasin' })).toBe('Banjarmasin');
    expect(cityOf({})).toBe('(tanpa wilayah)');
  });
});

describe('buildOrgTree', () => {
  it('hierarki: area -> wilayah -> cabang -> BM -> SPV -> SALES', () => {
    const area = tree.find((n) => n.label === 'Kalimantan');
    expect(area.kind).toBe('area');
    // Wilayah diurutkan alfabetis: Banjarbaru sebelum Banjarmasin.
    expect(area.children.map((w) => w.label)).toEqual(['Banjarbaru', 'Banjarmasin']);
    expect(area.children[1].kind).toBe('wilayah');

    const branch = area.children[1].children[0];
    expect(branch.kind).toBe('cabang');
    expect(branch.label).toBe('Cabang A');

    const bm = branch.children[0];
    expect(bm.kind).toBe('position');
    expect(bm.position.position_type).toBe('BM');
    expect(bm.children[0].position.position_type).toBe('SPV');
    expect(bm.children[0].children[0].position.position_type).toBe('SALES');
    expect(bm.children[0].children[0].position.name).toBe('BIDU');
  });

  it('cabang tanpa area masuk grup (tanpa area)', () => {
    const none = tree.find((n) => n.label === '(tanpa area)');
    expect(none).toBeTruthy();
    expect(none.children[0].children[0].label).toBe('Cabang D');
  });

  it('sales yang parent-nya di cabang lain tetap tampil sebagai akar', () => {
    const area = tree.find((n) => n.label === 'Kalimantan');
    const cabangB = area.children.find((w) => w.label === 'Banjarbaru').children[0];
    expect(cabangB.children.map((c) => c.position.name)).toEqual(['DONI']);
  });
});

describe('filterBranches', () => {
  it('filter area menyaring cabangnya', () => {
    expect(filterBranches(branches, { areaId: 2 }).map((b) => b.name)).toEqual(['Cabang C']);
  });

  it('filter area + wilayah menyaring lebih sempit', () => {
    expect(filterBranches(branches, { areaId: 1, city: 'Banjarbaru' }).map((b) => b.name)).toEqual(['Cabang B']);
  });

  it('tanpa filter semua cabang lolos', () => {
    expect(filterBranches(branches, {})).toHaveLength(4);
  });

  it('filter cabang memilih satu', () => {
    expect(filterBranches(branches, { branchId: 13 }).map((b) => b.name)).toEqual(['Cabang D']);
  });
});

describe('pruneTree', () => {
  it('cari "bm" menampilkan BM lengkap dengan SPV dan sales-nya', () => {
    const hit = pruneTree(tree, 'bm');
    expect(hit).toHaveLength(1);
    const bm = hit[0].children[0].children[0].children[0];
    expect(bm.position.name).toBe('BUDI');
    expect(bm.children[0].position.name).toBe('BUDO');
    expect(bm.children[0].children[0].position.name).toBe('BIDU');
  });

  it('cari nama sales menampilkan ancestor-nya saja (sibling dibuang)', () => {
    const hit = pruneTree(tree, 'BIDU');
    expect(hit).toHaveLength(1);
    expect(hit[0].label).toBe('Kalimantan');
    const cabangA = hit[0].children[0].children[0];
    expect(cabangA.label).toBe('Cabang A');
    expect(cabangA.children).toHaveLength(1); // hanya BUDI, bukan cabang lain
    expect(cabangA.children[0].children[0].position.name).toBe('BUDO');
    expect(cabangA.children[0].children[0].children[0].position.name).toBe('BIDU');
  });

  it('cari nama area menampilkan seluruh subtree-nya', () => {
    const hit = pruneTree(tree, 'kalimantan');
    expect(hit).toHaveLength(1);
    expect(hit[0].children).toHaveLength(2); // dua wilayah
    const totalCabang = hit[0].children.reduce((sum, w) => sum + w.children.length, 0);
    expect(totalCabang).toBe(2); // Cabang A + B
  });

  it('query kosong mengembalikan tree penuh', () => {
    expect(pruneTree(tree, '  ')).toBe(tree);
  });
});

describe('countPositions', () => {
  it('menghitung sales saja', () => {
    expect(countPositions(tree, 'SALES')).toBe(2);
  });

  it('menghitung semua position', () => {
    expect(countPositions(tree)).toBe(4);
  });
});
