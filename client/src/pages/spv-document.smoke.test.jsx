import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import SpvDocument, { toGolonganRows } from './SpvDocument';
import { computeGrandTotal } from '../lib/golongan';

const noop = () => {};
const props = {
  user: { id: 1, role: 'officer', criteria_ids: null, branch_ids: [1] },
  positions: [{ id: 1, name: 'BUDO', position_type: 'SPV', branch_ids: [1], active: 1 }],
  masterData: {
    divisions: [],
    principals: [{ id: 1, name: 'PT A' }],
    brands: [{ id: 1, name: 'Brand X', principal_id: 1 }],
    regions: [],
    branches: [{ id: 1, name: 'Cabang A', city: 'Banjarmasin' }],
  },
  setDocuments: noop,
  documentFormatId: 1,
  loadTargetId: null,
  onLoadDone: noop,
};

describe('SPV document render', () => {
  it('merender header SPV dengan empat pembeda', () => {
    const html = renderToString(<SpvDocument {...props} />);
    expect(html).toContain('Rekap Insentif SPV');
    expect(html).toContain('Wilayah');
    expect(html).toContain('Jabatan');
    expect(html).toContain('Nama Pejabat');
    expect(html).toContain('Bulan');
  });

  it('menampilkan input SPV dan rentang bulan', () => {
    const html = renderToString(<SpvDocument {...props} />);
    expect(html).toContain('Bulan Mulai');
    expect(html).toContain('Bulan Akhir');
    expect(html).toContain('Pilih SPV');
  });

  it('merender kwitansi bertanda tangan SPV', () => {
    const html = renderToString(<SpvDocument {...props} />);
    expect(html).toContain('KWITANSI');
    expect(html).toContain('SPV');
  });
});

describe('toGolonganRows', () => {
  const masterData = { principals: [{ id: 1, name: 'PT A' }] };

  it('baris tanpa principal ikut dihitung dalam TOTAL', () => {
    const rows = toGolonganRows([
      { label: 'FREE', target: 5, achievement: 5 },
      { label: 'Brand A', principal_id: 1, principal_name: 'PT A', brand_id: 7, target: 200, achievement: 200 },
    ], masterData);
    expect(computeGrandTotal(rows)).toEqual({ target: 205, achievement: 205 });
  });

  it('mengelompokkan brand ke principal dan membuat baris principal berisi jumlahnya', () => {
    const rows = toGolonganRows([
      { label: 'Brand A', principal_id: 1, principal_name: 'PT A', brand_id: 7, target: 200, achievement: 200 },
      { label: 'Brand B', principal_id: 1, principal_name: 'PT A', brand_id: 8, target: 100, achievement: 50 },
    ], masterData);
    expect(rows.map((r) => r.type)).toEqual(['brand', 'brand', 'principal', 'total']);
    const principal = rows.find((r) => r.type === 'principal');
    expect(principal.label).toBe('PT A');
    expect(principal.target).toBe(300);
  });

  it('mengambil nama principal dari master data saat baris beku tidak menyimpannya', () => {
    const rows = toGolonganRows([
      { label: 'Brand A', principal_id: 1, brand_id: 7, target: 10, achievement: 10 },
    ], masterData);
    expect(rows.find((r) => r.type === 'principal').label).toBe('PT A');
  });

  it('tanpa baris tidak membuat baris TOTAL', () => {
    expect(toGolonganRows([], masterData)).toEqual([]);
  });
});
