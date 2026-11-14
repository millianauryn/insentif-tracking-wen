import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

const base = {
  documents: [
    { id: 1, period: '2026-10', status: 'Final', salesman: 'Rina' },
    { id: 2, period: '2026-10', status: 'Draft', salesman: 'Budi' },
  ],
  user: { role: 'superadmin' },
  onNewDoc: () => {},
};

const masterData = {
  regions: [{ id: 1, name: 'KALIMANTAN SELATAN' }],
  branches: [{ id: 10, name: 'PT. PULAU BARU JAYA', city: 'BANJARMASIN', region_id: 1 }],
};

const positions = [
  { id: 1, name: 'BUDI', position_type: 'BM', parent_position_id: null, branch_id: 10, active: 1 },
  { id: 2, name: 'BUDO', position_type: 'SPV', parent_position_id: 1, branch_id: 10, active: 1 },
  { id: 3, name: 'BIDU', position_type: 'SALES', parent_position_id: 2, branch_id: 10, active: 1 },
];

const render = () => renderToString(
  <MemoryRouter>
    <Dashboard {...base} positions={positions} masterData={masterData} />
  </MemoryRouter>,
);

describe('Dashboard', () => {
  it('punya searchbar dan tiga filter berjenjang', () => {
    const html = render();
    expect(html).toContain('Cari area, wilayah, cabang');
    expect(html).toContain('Semua area');
    expect(html).toContain('Semua wilayah');
    expect(html).toContain('Semua cabang');
    expect(html).toContain('Cabang / Distributor');
  });

  it('default tree tertutup: hanya baris AREA yang tampil', () => {
    const html = render();
    expect(html).toContain('KALIMANTAN SELATAN');
    expect(html).toContain('AREA');
    // Belum dibuka → simpul bawah tidak ikut ter-render.
    expect(html).not.toContain('BUDI');
    expect(html).not.toContain('BANJARMASIN');
  });

  it('tanpa area, cabang masuk grup (tanpa area)', () => {
    const html = renderToString(
      <MemoryRouter>
        <Dashboard
          {...base}
          positions={positions}
          masterData={{
            regions: [],
            branches: [{ id: 11, name: 'CABANG BEBAS', city: 'PALANGKA', region_id: null }],
          }}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('(tanpa area)');
    // Default tertutup → nama cabang baru muncul setelah grup dibuka.
    expect(html).not.toContain('CABANG BEBAS');
  });

  it('tanpa data menampilkan empty state, bukan crash', () => {
    const html = renderToString(
      <MemoryRouter>
        <Dashboard {...base} positions={[]} masterData={{}} />
      </MemoryRouter>,
    );
    expect(html).toContain('Belum ada data jabatan');
  });

  it('rail Dokumen terbaru sudah dihapus', () => {
    const html = render();
    expect(html).not.toContain('Dokumen terbaru');
    expect(html).not.toContain('status-pill');
  });
});
