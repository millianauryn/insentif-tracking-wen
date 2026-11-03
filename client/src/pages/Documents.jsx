import { useState, useEffect } from 'react';
import { canFinalizeDocument } from '../access';
import { PERIOD_OPTIONS, fromApiPeriod } from '../lib/period';
import { useToast } from '../components/Toast';
import { errMsg } from '../lib/api';
import Icon from '../components/Icon';
import { listPositions, listMasterData } from '../api';

const JENIS_OPTIONS = [
  { value: 'brand', label: 'Brand' },
  { value: 'principal', label: 'Principal' },
  { value: 'total-divisi', label: 'Total Divisi' },
  { value: 'total', label: 'Total' },
];

const EMPTY_MASTER = { principals: [], brands: [], regions: [], branches: [] };

const parseBrands = (s) => (s ? s.split(',').map((t) => t.replace(/^\s*&\s*/, '').trim()).filter(Boolean) : []);
const joinBrands = (arr) => (arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(', ')}, & ${arr[arr.length - 1]}`);

function computeTotalFor(rows, rowIndex) {
  const row = rows[rowIndex];
  const items = row.type === 'total'
    ? rows.filter((r) => r.type === 'brand')
    : (() => {
        let prev = -1;
        for (let i = rowIndex - 1; i >= 0; i--) {
          if (rows[i].type === 'total-divisi' || rows[i].type === 'total') { prev = i; break; }
        }
        return rows.slice(prev + 1, rowIndex).filter((r) => r.type === 'brand');
      })();
  return {
    target: items.reduce((s, r) => s + (Number(r.target) || 0), 0),
    achievement: items.reduce((s, r) => s + (Number(r.achievement) || 0), 0),
  };
}

function GolonganRow({ row, index, allRows, onUpdate, onRemove, onJenisChange, canEdit }) {
  const target = Number(row.target) || 0;
  const achievement = Number(row.achievement) || 0;
  const isTotal = row.type === 'total-divisi' || row.type === 'total';
  const isPrincipal = row.type === 'principal';

  const total = isTotal ? computeTotalFor(allRows, index) : null;
  const pct = total
    ? (total.target > 0 ? (total.achievement / total.target) * 100 : 0)
    : (target > 0 ? (achievement / target) * 100 : 0);
  const status = (total ? total.target : target) > 0 && pct >= 100 ? 'Tercapai' : 'Gugur';
  const statusLabel = total ? status : (target > 0 ? status : '');

  const jenisSelect = (
    <select
      aria-label={`Jenis baris ${index + 1}`}
      value={row.type || 'brand'}
      onChange={(e) => onJenisChange(row, e.target.value)}
      disabled={!canEdit}
      className="input text-[12px] py-1.5 w-full"
    >
      {JENIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  if (isPrincipal) {
    return (
      <tr>
        <td><input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} placeholder="Nama principal" /></td>
        <td>{jenisSelect}</td>
        <td />
        <td />
        <td />
        <td />
        <td className="text-center">
          {canEdit && (
            <button className="delete-button" onClick={() => onRemove(row.id)} aria-label={`Hapus baris ${index + 1}`}>
              <Icon size={15}><path d="M3 6h18M8 6V4h8v2M19 6l1-14H6L5 6"/></Icon>
            </button>
          )}
        </td>
      </tr>
    );
  }

  if (isTotal) {
    return (
      <tr className="font-semibold">
        <td><input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} /></td>
        <td>{jenisSelect}</td>
        <td className="text-right">{total.target ? total.target.toLocaleString('id-ID') : '—'}</td>
        <td className="text-right">{total.achievement ? total.achievement.toLocaleString('id-ID') : '—'}</td>
        <td className="text-right">{pct.toFixed(1)}%</td>
        <td><span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{statusLabel}</span></td>
        <td className="text-center">
          {canEdit && (
            <button className="delete-button" onClick={() => onRemove(row.id)} aria-label={`Hapus baris ${index + 1}`}>
              <Icon size={15}><path d="M3 6h18M8 6V4h8v2M19 6l1-14H6L5 6"/></Icon>
            </button>
          )}
        </td>
      </tr>
    );
  }

  // brand row
  return (
    <tr>
      <td><input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} placeholder="Nama golongan" /></td>
      <td>{jenisSelect}</td>
      <td><input type="number" min="0" value={row.target ?? ''} onChange={(e) => onUpdate(row.id, 'target', e.target.value)} disabled={!canEdit} /></td>
      <td><input type="number" min="0" value={row.achievement ?? ''} onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)} disabled={!canEdit} /></td>
      <td className="text-right">{target > 0 ? `${pct.toFixed(1)}%` : '0.0%'}</td>
      <td><span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{statusLabel}</span></td>
      <td className="text-center">
        {canEdit && (
          <button className="delete-button" onClick={() => onRemove(row.id)} aria-label={`Hapus baris ${index + 1}`}>
            <Icon size={15}><path d="M3 6h18M8 6V4h8v2M19 6l1-14H6L5 6"/></Icon>
          </button>
        )}
      </td>
    </tr>
  );
}

function GolonganTable({ rows, onUpdate, onRemove, onJenisChange, onAdd, canEdit }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr className="golongan-header">
            <th>GOLONGAN</th>
            <th className="w-[130px]">JENIS</th>
            <th>TARGET</th>
            <th>TERCAPAI (Rp.)</th>
            <th>TERCAPAI (%)</th>
            <th>KET</th>
            <th className="w-[50px]" aria-label="Aksi" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <GolonganRow
              key={row.id}
              row={row}
              index={index}
              allRows={rows}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onJenisChange={onJenisChange}
              canEdit={canEdit}
            />
          ))}
        </tbody>
      </table>
      {canEdit && (
        <div className="flex justify-end mt-3">
          <button className="button secondary text-[12px] py-1.5 px-3" onClick={() => onAdd('brand')}>
            <Icon size={14}><path d="M12 5v14M5 12h14"/></Icon> Tambah Baris
          </button>
        </div>
      )}
    </div>
  );
}

function KriteriaRow({ row, onUpdate, canEdit }) {
  const target = Number(row.target_value) || 0;
  const achievement = Number(row.achievement_value) || 0;
  const percentage = target > 0 ? (achievement / target) * 100 : 0;
  const status = target > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur';

  return (
    <tr className="kriteria-row">
      <td>{row.label}</td>
      <td><input type="number" min="0" value={row.target_value ?? ''} onChange={(e) => onUpdate(row.criteria_id, 'target_value', e.target.value)} disabled={!canEdit} /></td>
      <td><input type="number" min="0" value={row.achievement_value ?? ''} onChange={(e) => onUpdate(row.criteria_id, 'achievement_value', e.target.value)} disabled={!canEdit} /></td>
      <td>{target > 0 ? `${percentage.toFixed(1)}%` : ''}</td>
      <td><span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{target > 0 ? status : ''}</span></td>
      <td><input type="number" min="0" value={row.incentive_amount ?? ''} onChange={(e) => onUpdate(row.criteria_id, 'incentive_amount', e.target.value)} disabled={!canEdit} /></td>
    </tr>
  );
}

function KriteriaTable({ rows, onUpdate, canEdit }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr className="kriteria-header">
            <th>KRITERIA</th>
            <th>TARGET</th>
            <th>TERCAPAI (JUMLAH)</th>
            <th>%</th>
            <th>KET</th>
            <th>INSENTIVE YG DIBERI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <KriteriaRow key={row.criteria_id} row={row} onUpdate={onUpdate} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Documents({
  user, documents, onRefresh, setDocuments,
  onCreate, onUpdate, onSubmit, onLoad, onCancel,
  documentId, golonganRows, updateGolonganRow, removeGolonganRow, addGolonganRow,
  criteriaRows, updateCriteriaRow,
  updateSales, sales, period, setPeriod,
  documentStatus, saved,
}) {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [positions, setPositions] = useState([]);
  const [masterData, setMasterData] = useState(EMPTY_MASTER);
  const [kwitansi, setKwitansi] = useState({
    penerima: 'PT. BINTANG SINAR JAYA',
    jumlahUang: '',
    keterangan: '',
    terbilang: '',
    nominal: '',
  });
  const canEdit = ['superadmin', 'officer'].includes(user.role) && documentStatus === 'Draft';
  const canFinalize = canFinalizeDocument(user, documentStatus);

  useEffect(() => {
    listPositions().then((r) => setPositions(r.positions || [])).catch(() => setPositions([]));
    listMasterData().then(setMasterData).catch(() => setMasterData(EMPTY_MASTER));
  }, []);

  // Wilayah derived: salesman position branch → region, fallback officer's branch region
  const selectedPosition = positions.find(
    (p) => p.active && p.name.trim().toLowerCase() === (sales.name || '').trim().toLowerCase()
  ) || null;
  const branchId = selectedPosition?.branch_ids?.[0] ?? user?.branch_ids?.[0];
  const linkedBranch = masterData.branches.find((b) => b.id === branchId);
  const linkedRegion = masterData.regions.find((r) => r.id === linkedBranch?.region_id);
  const wilayah = linkedRegion?.name || '-';

  // Produk selection derived from sales.product (source of truth)
  const selectedBrands = parseBrands(sales.product);

  // Jabatan-specific kriteria: superadmin / unconfigured jabatan → all criteria visible
  const myCriteriaIds = user.criteria_ids;
  const showAllCriteria = user.role === 'superadmin' || !myCriteriaIds || myCriteriaIds.length === 0;
  const visibleCriteriaRows = showAllCriteria
    ? criteriaRows
    : criteriaRows.filter((r) => myCriteriaIds.includes(r.criteria_id));

  const refreshList = async () => {
    setRefreshing(true);
    try {
      const { documents: next } = await onRefresh();
      setDocuments(next);
    } catch (err) {
      toast('error', errMsg(err));
    } finally {
      setRefreshing(false);
    }
  };

  const save = () => (documentId ? onUpdate() : onCreate());

  const totals = {
    target: golonganRows.filter((r) => r.type === 'brand').reduce((s, r) => s + (Number(r.target) || 0), 0),
    achievement: golonganRows.filter((r) => r.type === 'brand').reduce((s, r) => s + (Number(r.achievement) || 0), 0),
  };
  totals.percentage = totals.target > 0 ? (totals.achievement / totals.target) * 100 : 0;
  totals.status = totals.target > 0 && totals.percentage >= 100 ? 'Tercapai' : 'Gugur';

  const handlePrint = () => window.print();

  const changeJenis = (row, type) => {
    updateGolonganRow(row.id, 'type', type);
    updateGolonganRow(row.id, 'isGroup', type !== 'brand');
    if (type === 'total-divisi' && !row.label) updateGolonganRow(row.id, 'label', 'TOTAL DIVISI');
    if (type === 'total' && !row.label) updateGolonganRow(row.id, 'label', 'TOTAL');
    if (type === 'brand' && (row.label === 'TOTAL DIVISI' || row.label === 'TOTAL')) updateGolonganRow(row.id, 'label', '');
  };

  const toggleBrand = (name) => {
    const next = selectedBrands.includes(name)
      ? selectedBrands.filter((b) => b !== name)
      : [...selectedBrands, name];
    updateSales('product', joinBrands(next));
  };

  return (
    <>
      <div className="print-header">
        <div className="print-title">
          <h1>PERHITUNGAN INSENTIF</h1>
          <button className="button primary" onClick={handlePrint}>Cetak</button>
        </div>
      </div>

      <section className="content-card info-card print-section">
        <div className="doc-header">
          <div className="doc-meta">
            <div><strong>WILAYAH:</strong><span>{wilayah}</span></div>
            <div><strong>SALESMAN:</strong><span>{sales.name || '-'}</span></div>
            <div><strong>PRODUK:</strong><span>{sales.product || '-'}</span></div>
            <div><strong>BULAN:</strong><span>{period || '-'}</span></div>
          </div>
        </div>

        <GolonganTable
          rows={golonganRows}
          onUpdate={updateGolonganRow}
          onRemove={removeGolonganRow}
          onJenisChange={changeJenis}
          onAdd={addGolonganRow}
          canEdit={canEdit}
        />

        <KriteriaTable
          rows={visibleCriteriaRows}
          onUpdate={updateCriteriaRow}
          canEdit={canEdit}
        />

        <div className="kwitansi-card">
          <h3>KWITANSI</h3>
          <div className="kwitansi-grid">
            <div className="kw-row"><label>Sudah terima dari :</label><span>{kwitansi.penerima}</span></div>
            <div className="kw-row"><label>Jumlah Uang</label><input value={kwitansi.jumlahUang} onChange={(e) => setKwitansi({ ...kwitansi, jumlahUang: e.target.value })} disabled={!canEdit} placeholder="Rp." /></div>
            <div className="kw-row"><label>Bayar PemBayaran</label><input value={kwitansi.keterangan} onChange={(e) => setKwitansi({ ...kwitansi, keterangan: e.target.value })} disabled={!canEdit} placeholder="Contoh: Incentive penjualan bulan September 2026" /></div>
            <div className="kw-row"><label>Terbilang</label><input value={kwitansi.terbilang} onChange={(e) => setKwitansi({ ...kwitansi, terbilang: e.target.value })} disabled={!canEdit} placeholder="Contoh: Delapan ratus delapan puluh dua ribu rupiah" /></div>
            <div className="kw-row"><label>Rp.</label><input value={kwitansi.nominal} onChange={(e) => setKwitansi({ ...kwitansi, nominal: e.target.value })} disabled={!canEdit} placeholder="882.000" /></div>
          </div>
          <div className="kw-sign">
            <span className="sig-name">{selectedPosition?.name || sales.name || '—'}</span>
            <span className="sig-role">{selectedPosition?.position_type || 'SALES'}</span>
          </div>
          <div className="kw-total">
            <span>Total Keseluruhan</span>
            <strong>Rp {totals.achievement.toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </section>

      <section className="content-card info-card">
        <div className="section-heading heading-with-action">
          <div>
            <h2>Dokumen Tersimpan</h2>
            <p>Buka dokumen lama untuk dilanjutkan.</p>
          </div>
          <div className="flex gap-2">
            <button className="button secondary" type="button" onClick={refreshList} disabled={refreshing}>{refreshing ? 'Memuat...' : 'Muat Ulang'}</button>
            <button className="button primary" type="button" onClick={onCancel}>Dokumen Baru</button>
          </div>
        </div>
        {documents.length ? (
          <div className="admin-list">
            {documents.map((doc) => (
              <div className="admin-row" key={doc.id}>
                <strong>{doc.salesman || 'Tanpa nama sales'}</strong>
                <span>{fromApiPeriod(doc.period)}</span>
                <span className={`result-badge ${doc.status === 'Final' ? 'success' : 'warning'}`}>{doc.status}</span>
                <button className="text-button" type="button" onClick={() => onLoad(doc)}>Buka</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtitle">Belum ada dokumen tersimpan.</p>
        )}
      </section>

      <section className="content-card info-card">
        <div className="section-heading">
          <div className="section-icon blue"><Icon><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></Icon></div>
          <div><h2>Informasi Dokumen</h2><p>Data dasar dokumen insentif sales.</p></div>
          <span className={`draft-badge ${documentStatus === 'Final' ? 'final-badge' : ''}`}>{documentStatus}</span>
        </div>
        <div className="form-grid">
          <label>
            Salesman
            <input list="salesman-list" value={sales.name} onChange={(e) => updateSales('name', e.target.value)} disabled={!canEdit} placeholder="Pilih nama sales" autoComplete="off" />
            <datalist id="salesman-list">
              {positions.filter((p) => p.active).map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
          </label>
          <label>Wilayah<input value={wilayah} readOnly disabled /></label>
          <label>
            Bulan
            <input list="bulan-list" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={!canEdit} placeholder="Contoh: September 2026" />
            <datalist id="bulan-list">
              {PERIOD_OPTIONS.map((o) => <option key={o} value={o} />)}
            </datalist>
          </label>

          {/* Produk: chips grouped by principal */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold">Produk <span className="text-ink-400 font-normal">(dari nama principal)</span></label>
              <div className="flex gap-1.5">
                <span className="text-[12px] text-ink-500 self-center">{selectedBrands.length} produk dipilih</span>
                <button type="button" className="button secondary text-[11px] px-2 py-1" onClick={() => { const all = masterData.brands.filter((b) => b.is_active !== 0 && b.active !== 0).map((b) => b.name); updateSales('product', joinBrands(all)); }} disabled={!canEdit}>Semua</button>
                <button type="button" className="button secondary text-[11px] px-2 py-1" onClick={() => updateSales('product', '')} disabled={!canEdit}>Kosongkan</button>
              </div>
            </div>
            <div className="max-h-[250px] overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-3">
              {masterData.principals.filter((pr) => pr.is_active !== 0 && pr.active !== 0).map((principal) => {
                const principalBrands = masterData.brands.filter((b) => b.principal_id === principal.id && b.is_active !== 0 && b.active !== 0);
                if (!principalBrands.length) return null;
                return (
                  <div key={principal.id}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">{principal.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {principalBrands.map((brand) => {
                        const checked = selectedBrands.includes(brand.name);
                        return (
                          <label key={brand.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] cursor-pointer transition ${checked ? 'bg-brand-50 border-brand-600 text-brand-800 font-semibold' : 'bg-white border-slate-200 text-ink-700 hover:bg-slate-50'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleBrand(brand.name)} disabled={!canEdit} className="sr-only" />
                            {brand.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!masterData.principals.length && <p className="text-[12px] text-ink-400 text-center py-3">Belum ada produk. Tambah principal & brand di Data Master.</p>}
            </div>
          </div>
        </div>
      </section>

      <footer className="action-bar">
        <div className="autosave"><span className="save-dot" />{saved ? 'Draft tersimpan' : 'Draft belum disimpan'}</div>
        <div className="actions">
          <button className="button secondary" onClick={onCancel}>Batal</button>
          <button className="button primary" onClick={save} disabled={!canEdit}>
            <Icon size={17}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>
            {documentId ? 'Simpan Perubahan' : 'Simpan Draft'}
          </button>
          {canFinalize && <button className="button secondary" onClick={onSubmit} disabled={!documentId}>Finalisasi</button>}
        </div>
      </footer>
    </>
  );
}
