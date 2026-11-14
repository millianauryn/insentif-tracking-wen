import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import Documents, { buildBrandOptions } from './Documents';

// Render smoke test: executes the component body without effects (no fetch in node).
// A render-time ReferenceError/TypeError here fails this test with its stack —
// guarding against the "white page" regression.
const noop = () => {};
const baseProps = {
  docType: 'sales',
  user: { id: 1, role: 'superadmin', criteria_ids: null, branch_ids: [1] },
  documents: [{ id: 1, salesman: 'A', period: '2026-10', status: 'Draft' }],
  onRefresh: noop,
  setDocuments: noop,
  onCreate: noop,
  onUpdate: noop,
  onSubmit: noop,
  onLoad: noop,
  onCancel: noop,
  documentId: null,
  golonganRows: [{ id: 'r1', label: 'PASEO', type: 'brand', isGroup: false, target: '10', achievement: '5' }],
  updateGolonganRow: noop,
  removeGolonganRow: noop,
  addGolonganRow: noop,
  criteria: [],
  criteriaRows: [{ criteria_id: 1, label: 'EFFECTIVE CALLS', target_value: '', achievement_value: '', incentive_amount: '' }],
  updateCriteriaRow: noop,
  updateSales: noop,
  sales: { name: 'Rina Kusuma', region: 'Banjarmasin', product: '', branch: '', division: '', period: 'November 2026' },
  period: 'November 2026',
  setPeriod: noop,
  kwitansi: { penerima: 'PT. BINTANG SINAR JAYA', jumlahUang: '', keterangan: '', terbilang: '', nominal: '' },
  setKwitansi: noop,
  documentStatus: 'Draft',
  saved: false,
};

describe('Documents render smoke', () => {
  it('sales page renders without crashing', () => {
    const html = renderToString(<Documents {...baseProps} />);
    expect(html).toContain('PERHITUNGAN INSENTIF');
    expect(html).toContain('Informasi Dokumen');
    expect(html).toContain('Wilayah (Kota)');
  });

  it('halaman SPV tidak lagi placeholder', () => {
    const html = renderToString(<Documents {...baseProps} docType="spv" />);
    expect(html).not.toContain('Belum ada data rekap');
  });

  it('bm placeholder page renders', () => {
    const html = renderToString(<Documents {...baseProps} docType="bm" />);
    expect(html).toMatch(/Dokumen\s*<!-- -->\s*BM|Dokumen BM/);
  });

  it('Layout + sidebar render without crashing (user logged in)', async () => {
    const { MemoryRouter } = await import('react-router-dom');
    const { AuthProvider } = await import('../context/AuthContext');
    const Layout = (await import('../components/Layout')).default;
    const html = renderToString(
      <MemoryRouter initialEntries={['/documents/sales']}>
        <AuthProvider>
          <Layout title="Dokumen Insentif" breadcrumb={['Dokumen', 'SALES']}>
            <div>child</div>
          </Layout>
        </AuthProvider>
      </MemoryRouter>
    );
    expect(html).toContain('Dokumen');
    expect(html).toContain('Sales');
  });
});

describe('buildBrandOptions (mengikuti produk yang dipilih)', () => {
  const principals = [{ id: 5, name: 'ENESIS' }, { id: 4, name: 'GROUP PASEO' }];
  const brands = [
    { id: 1, name: 'ANTIS', principal_id: 5, is_active: 1, active: 1 },
    { id: 2, name: 'AMUNIZER', principal_id: 5, is_active: 1, active: 1 },
    { id: 3, name: 'VEGETA', principal_id: 5, is_active: 1, active: 1 },
    { id: 4, name: 'NICE', principal_id: 4, is_active: 1, active: 1 },
    { id: 5, name: 'JOLLY', principal_id: 4, is_active: 1, active: 1 },
    { id: 6, name: 'PASEO', principal_id: 4, is_active: 1, active: 1 },
  ];
  const build = (selected, rows = []) => buildBrandOptions(brands, principals, rows, 0, null, [], selected);

  it('tanpa produk dipilih → brand dan principal tidak terisi', () => {
    expect(build([])).toEqual([]);
  });

  it('satu produk → hanya barang produk itu, urut A→Z', () => {
    const out = build(['ENESIS']);
    expect(out.map((o) => o.value)).toEqual(['AMUNIZER', 'ANTIS', 'VEGETA']);
    expect(out.every((o) => o.hint === 'ENESIS')).toBe(true);
  });

  it('dua produk → dikelompokkan per principal sesuai urutan pilihan, A→Z di dalamnya', () => {
    const out = build(['ENESIS', 'GROUP PASEO']);
    expect(out.map((o) => `${o.hint}:${o.value}`)).toEqual([
      'ENESIS:AMUNIZER',
      'ENESIS:ANTIS',
      'ENESIS:VEGETA',
      'GROUP PASEO:JOLLY',
      'GROUP PASEO:NICE',
      'GROUP PASEO:PASEO',
    ]);
  });

  it('brand yang sudah terpakai di baris lain disembunyikan', () => {
    const out = build(['ENESIS'], [{ type: 'brand', label: 'AMUNIZER' }]);
    expect(out.map((o) => o.value)).toEqual(['ANTIS', 'VEGETA']);
  });

  it('brand tanpa principal tetap muncul selama ada produk dipilih (di akhir, tanpa hint)', () => {
    const withOrphan = [...brands, { id: 7, name: 'ZOLEO', principal_id: null, is_active: 1, active: 1 }];
    const out = buildBrandOptions(withOrphan, principals, [], 0, null, [], ['ENESIS']);
    expect(out.map((o) => o.value)).toEqual(['AMUNIZER', 'ANTIS', 'VEGETA', 'ZOLEO']);
    expect(out[out.length - 1].hint).toBe('');
  });

  it('tanpa produk, brand tanpa principal juga ikut kosong', () => {
    const withOrphan = [...brands, { id: 7, name: 'ZOLEO', principal_id: null, is_active: 1, active: 1 }];
    expect(buildBrandOptions(withOrphan, principals, [], 0, null, [], [])).toEqual([]);
  });
});
