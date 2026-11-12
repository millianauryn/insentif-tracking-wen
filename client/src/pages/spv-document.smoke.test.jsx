import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import SpvDocument from './SpvDocument';

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
