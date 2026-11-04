import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import Documents from './Documents';

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

  it('spv and bm placeholder pages render', () => {
    expect(renderToString(<Documents {...baseProps} docType="spv" />)).toMatch(/Dokumen\s*<!-- -->\s*SPV|Dokumen SPV/);
    expect(renderToString(<Documents {...baseProps} docType="bm" />)).toMatch(/Dokumen\s*<!-- -->\s*BM|Dokumen BM/);
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
