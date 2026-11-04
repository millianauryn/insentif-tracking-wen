import { useState, useEffect } from 'react';
import { canFinalizeDocument } from '../access';
import { fromApiPeriod } from '../lib/period';
import { useToast } from '../components/Toast';
import { errMsg } from '../lib/api';
import Icon from '../components/Icon';
import PickerChips from '../components/PickerChips';
import ComboSelect from '../components/ComboSelect';
import { listPositions, listMasterData } from '../api';
import { computeTotalFor, computeGrandTotal, principalValueFor } from '../lib/golongan';
import { monthsOfYear } from '../lib/period';

const JENIS_OPTIONS = [
  { value: 'brand', label: 'Brand' },
  { value: 'principal', label: 'Principal' },
  { value: 'total-divisi', label: 'Total Divisi' },
  { value: 'total', label: 'Total' },
];

const EMPTY_MASTER = { principals: [], brands: [], regions: [], branches: [] };

const parseBrands = (s) => (s ? s.split(',').map((t) => t.replace(/^\s*&\s*/, '').trim()).filter(Boolean) : []);
const joinBrands = (arr) => (arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(', ')}, & ${arr[arr.length - 1]}`);

function GolonganRow({ row, index, allRows, onUpdate, onRemove, onJenisChange, canEdit }) {
  const target = Number(row.target) || 0;
  const achievement = Number(row.achievement) || 0;
  const pct = target > 0 ? (achievement / target) * 100 : 0;
  const status = target > 0 && pct >= 100 ? 'Tercapai' : 'Gugur';
  const statusLabel = target > 0 ? status : '';

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

  const deleteBtn = canEdit ? (
    <button className="delete-button" onClick={() => onRemove(row.id)} aria-label={`Hapus baris ${index + 1}`}>
      <Icon size={15}><path d="M3 6h18M8 6V4h8v2M19 6l1-14H6L5 6"/></Icon>
    </button>
  ) : null;

  // Total rows: auto-computed from principal + brand rows (not editable)
  if (row.type === 'total-divisi' || row.type === 'total') {
    const total = computeTotalFor(allRows, index);
    const tPct = total.target > 0 ? (total.achievement / total.target) * 100 : 0;
    const tStatus = total.target > 0 && tPct >= 100 ? 'Tercapai' : 'Gugur';
    return (
      <tr className="font-semibold">
        <td><input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} /></td>
        <td>{jenisSelect}</td>
        <td className="text-right">{total.target.toLocaleString('id-ID')}</td>
        <td className="text-right">{total.achievement.toLocaleString('id-ID')}</td>
        <td className="text-right">{tPct.toFixed(1)}%</td>
        <td><span className={`result-badge ${tStatus === 'Tercapai' ? 'success' : 'warning'}`}>{total.target > 0 ? tStatus : ''}</span></td>
        <td className="text-center">{deleteBtn}</td>
      </tr>
    );
  }

  // Principal with brand children: value = sum of those brands (auto, not editable)
  if (row.type === 'principal') {
    let hasChildren = false;
    for (let i = index + 1; i < allRows.length; i++) {
      const r = allRows[i];
      if (r.type === 'principal' || r.type === 'total-divisi' || r.type === 'total') break;
      if (r.type === 'brand') { hasChildren = true; break; }
    }
    if (hasChildren) {
      const v = principalValueFor(allRows, index);
      const pPct = v.target > 0 ? (v.achievement / v.target) * 100 : 0;
      const pStatus = v.target > 0 && pPct >= 100 ? 'Tercapai' : 'Gugur';
      return (
        <tr className="font-semibold">
          <td><input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} placeholder="Nama principal" /></td>
          <td>{jenisSelect}</td>
          <td className="text-right">{v.target.toLocaleString('id-ID')}</td>
          <td className="text-right">{v.achievement.toLocaleString('id-ID')}</td>
          <td className="text-right">{pPct.toFixed(1)}%</td>
          <td><span className={`result-badge ${pStatus === 'Tercapai' ? 'success' : 'warning'}`}>{v.target > 0 ? pStatus : ''}</span></td>
          <td className="text-center">{deleteBtn}</td>
        </tr>
      );
    }
    // no brand children → manual inputs (same as brand row)
  }

  return (
    <tr>
      <td><input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} placeholder="Nama golongan" /></td>
      <td>{jenisSelect}</td>
      <td><input type="number" min="0" value={row.target ?? ''} onChange={(e) => onUpdate(row.id, 'target', e.target.value)} disabled={!canEdit} /></td>
      <td><input type="number" min="0" value={row.achievement ?? ''} onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)} disabled={!canEdit} /></td>
      <td className="text-right">{target > 0 ? `${pct.toFixed(1)}%` : '0.0%'}</td>
      <td><span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{statusLabel}</span></td>
      <td className="text-center">{deleteBtn}</td>
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
  docType = 'sales',
  user, documents, onRefresh, setDocuments,
  onCreate, onUpdate, onSubmit, onLoad, onCancel,
  documentId, golonganRows, updateGolonganRow, removeGolonganRow, addGolonganRow,
  criteriaRows, updateCriteriaRow,
  updateSales, sales, period, setPeriod,
  kwitansi, setKwitansi,
  documentStatus, saved,
}) {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [positions, setPositions] = useState([]);
  const [masterData, setMasterData] = useState(EMPTY_MASTER);
  const canEdit = ['superadmin', 'officer'].includes(user.role) && documentStatus === 'Draft';
  const canFinalize = canFinalizeDocument(user, documentStatus);

  useEffect(() => {
    listPositions().then((r) => setPositions(r.positions || [])).catch(() => setPositions([]));
    listMasterData().then(setMasterData).catch(() => setMasterData(EMPTY_MASTER));
  }, []);

  // Officer: wilayah auto-fills from own linked cabang (city → region fallback)
  const isSuper = user.role === 'superadmin';
  useEffect(() => {
    if (isSuper || sales.region) return;
    const own = masterData.branches.filter((b) => (user.branch_ids || []).includes(b.id));
    if (!own.length) return;
    const withCity = own.find((b) => b.city);
    const city = withCity?.city || masterData.regions.find((r) => r.id === own[0].region_id)?.name;
    if (city) updateSales('region', city);
  }, [isSuper, user.branch_ids, masterData, sales.region, updateSales]);

  // Sales options: officer → positions at own branches; superadmin → positions at branches in chosen kota
  const positionsAtBranches = (branchIds) =>
    positions.filter((p) => p.active && (p.branch_ids || []).some((id) => branchIds.includes(id)));
  const salesOptions = isSuper
    ? (sales.region
        ? positionsAtBranches(masterData.branches.filter((b) => b.city === sales.region).map((b) => b.id))
        : [])
    : positionsAtBranches(user.branch_ids || []);
  const salesList = (() => {
    const salesOnly = salesOptions.filter((p) => p.position_type === 'SALES');
    return salesOnly.length ? salesOnly : salesOptions;
  })();

  // Superadmin wilayah dropdown: distinct kota from active branches
  const kotaOptions = [...new Set(
    masterData.branches
      .filter((b) => (b.is_active !== 0 && b.active !== 0) && b.city)
      .map((b) => b.city)
  )].sort();

  // Wilayah shown in doc header (kota)
  const wilayah = sales.region || '-';

  // Selected salesman's position (kwitansi signature)
  const selectedPosition = positions.find(
    (p) => p.active && p.name.trim().toLowerCase() === (sales.name || '').trim().toLowerCase()
  ) || null;

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

  const grand = computeGrandTotal(golonganRows);
  const totals = { target: grand.target, achievement: grand.achievement };
  totals.percentage = totals.target > 0 ? (totals.achievement / totals.target) * 100 : 0;
  totals.status = totals.target > 0 && totals.percentage >= 100 ? 'Tercapai' : 'Gugur';

  const handlePrint = () => window.print();

  const changeJenis = (row, type) => {
    const isAutoLabel = row.label === 'TOTAL DIVISI' || row.label === 'TOTAL';
    updateGolonganRow(row.id, 'type', type);
    updateGolonganRow(row.id, 'isGroup', type !== 'brand');
    if (type === 'total-divisi' && (!row.label || isAutoLabel)) updateGolonganRow(row.id, 'label', 'TOTAL DIVISI');
    if (type === 'total' && (!row.label || isAutoLabel)) updateGolonganRow(row.id, 'label', 'TOTAL');
    if ((type === 'brand' || type === 'principal') && isAutoLabel) updateGolonganRow(row.id, 'label', '');
  };

  // SPV / BM pages are placeholders for now (switch via sidebar tree)
  if (docType === 'spv' || docType === 'bm') {
    const name = docType.toUpperCase();
    return (
      <section className="content-card info-card">
        <div className="section-heading">
          <div>
            <h2>Dokumen {name}</h2>
            <p>Halaman dokumen {name}.</p>
          </div>
        </div>
        <p className="py-10 text-center text-[13px] text-ink-400">Halaman ini masih kosong — belum ada input untuk {name}.</p>
      </section>
    );
  }

  // docType === 'sales' — current editor
  return (
    <>
      <div className="print-header">
        <div className="print-title">
          <h1>PERHITUNGAN INSENTIF</h1>
          <button className="button primary" onClick={handlePrint}>Cetak</button>
        </div>
      </div>

      {/* Informasi Dokumen — placed at top */}
      <section className="content-card info-card">
        <div className="section-heading">
          <div className="section-icon blue"><Icon><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></Icon></div>
          <div><h2>Informasi Dokumen</h2><p>Data dasar dokumen insentif sales.</p></div>
          <span className={`draft-badge ${documentStatus === 'Final' ? 'final-badge' : ''}`}>{documentStatus}</span>
        </div>
        <div className="form-grid">
          <label className="block">
            Wilayah (Kota)
            {isSuper ? (
              <ComboSelect
                value={sales.region}
                onChange={(v) => updateSales('region', v)}
                options={kotaOptions.map((k) => ({ value: k }))}
                placeholder={kotaOptions.length ? 'Pilih atau ketik wilayah...' : 'Belum ada kota di cabang'}
                disabled={!canEdit}
                emptyHint={kotaOptions.length ? 'Tidak ada wilayah cocok.' : 'Belum ada kota di cabang.'}
              />
            ) : (
              <input value={wilayah} readOnly disabled />
            )}
          </label>
          <label className="block">
            Salesman
            <ComboSelect
              value={sales.name}
              onChange={(v) => updateSales('name', v)}
              options={salesList.map((p) => ({ value: p.name, hint: p.position_type }))}
              placeholder={isSuper && !sales.region ? 'Pilih wilayah dulu' : 'Pilih atau ketik nama sales...'}
              disabled={!canEdit}
              emptyHint={salesList.length ? 'Tidak ada sales cocok.' : isSuper && !sales.region ? 'Pilih wilayah dulu.' : 'Belum ada sales di cabang Anda.'}
            />
          </label>
          <label className="block">
            Bulan
            <ComboSelect
              value={period}
              onChange={setPeriod}
              options={monthsOfYear().map((m) => ({ value: m }))}
              placeholder="Pilih atau ketik bulan..."
              disabled={!canEdit}
              emptyHint="Tidak ada bulan cocok."
            />
          </label>
          <div className="col-span-2">
            <PickerChips
              label="Produk"
              hint="(nama principal)"
              variant="inline"
              searchPlaceholder="Cari produk..."
              showClear={false}
              items={masterData.principals
                .filter((pr) => pr.is_active !== 0 && pr.active !== 0)
                .map((pr) => ({ id: pr.name, name: pr.name }))}
              selected={selectedBrands}
              onChange={(names) => updateSales('product', joinBrands(names))}
              canEdit={canEdit}
            />
          </div>
        </div>
      </section>

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
