import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { canFinalizeDocument } from '../access';
import Icon from '../components/Icon';
import PickerChips from '../components/PickerChips';
import ComboSelect from '../components/ComboSelect';
import { listPositions, listMasterData } from '../api';
import { computeTotalFor, computeGrandTotal, principalValueFor, principalAutoValue } from '../lib/golongan';
import { monthNames } from '../lib/period';

const JENIS_OPTIONS = [
  { value: 'brand', label: 'Brand' },
  { value: 'principal', label: 'Principal' },
  { value: 'total-divisi', label: 'Total Divisi' },
  { value: 'total', label: 'Total' },
  { value: 'divisi', label: 'Divisi' },
];

const EMPTY_MASTER = { divisions: [], principals: [], brands: [], regions: [], branches: [] };

const parseBrands = (s) => (s ? s.split(',').map((t) => t.replace(/^\s*&\s*/, '').trim()).filter(Boolean) : []);
const joinBrands = (arr) => (arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(', ')}, & ${arr[arr.length - 1]}`);

// Brand yang sudah dipilih di baris lain disembunyikan dari dropdown (duplikat hanya lewat ketik manual).
// Filter seksi Divisi: Brand hanya yang link ke divisi aktif (via principal.division_id); general (tanpa divisi) -> semua.
function buildBrandOptions(brands, principals, allRows, currentId, activeDivisi, divisions) {
  const used = new Set((allRows || []).filter((r) => r.type === 'brand' && r.id !== currentId).map((r) => (r.label || '').trim().toLowerCase()).filter(Boolean));
  const divisionId = activeDivisi ? (divisions || []).find((d) => d.name === activeDivisi)?.id : null;
  const inDivision = (b) => {
    if (!activeDivisi || divisionId == null) return true;
    const principal = (principals || []).find((p) => p.id === b.principal_id);
    return principal?.division_id === divisionId;
  };
  return (brands || [])
    .filter((b) => b.is_active !== 0 && b.active !== 0)
    .filter((b) => !used.has((b.name || '').trim().toLowerCase()))
    .filter(inDivision)
    .map((b) => ({
      value: b.name,
      hint: b.principal_id ? (principals || []).find((p) => p.id === b.principal_id)?.name : '',
    }));
}

function GolonganRow({ row, index, allRows, onUpdate, onRemove, onJenisChange, canEdit, dnd, divisions, brands, principals, activeDivisi }) {
  const target = Number(row.target) || 0;
  const achievement = Number(row.achievement) || 0;
  const pct = target > 0 ? (achievement / target) * 100 : 0;
  const status = target > 0 && pct >= 100 ? 'Tercapai' : 'Gugur';
  const statusLabel = target > 0 ? status : '';

  // Drag-to-reorder (HTML5): row draggable hanya saat mode edit
  const dragging = !!dnd && dnd.dragIndex === index;
  const rowStateClass = `${dragging ? ' row-dragging' : ''}${!!dnd && dnd.overIndex === index && !dragging ? ' row-over' : ''}`;
  const trProps = canEdit && dnd
    ? {
        draggable: true,
        onDragStart: (e) => dnd.start(index, e),
        onDragEnter: () => dnd.enter(index),
        onDragOver: (e) => dnd.over(index, e),
        onDrop: (e) => dnd.drop(index, e),
        onDragEnd: dnd.end,
      }
    : {};

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

  const actionCell = canEdit ? (
    <span className="cell-actions">
      <span className="drag-grip" aria-hidden="true">
        <Icon size={13}><path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"/></Icon>
      </span>
      {deleteBtn}
    </span>
  ) : null;

  // Divisi rows: section header with Divisi select (deletable + draggable like other rows)
  if (row.type === 'divisi') {
    return (
      <tr {...trProps} className={`golongan-divisi-row${rowStateClass}`}>
        <td colSpan={6}>
          <label className="text-[11px] font-semibold text-ink-700 mr-2">Divisi</label>
          <select
            value={row.divisi || ''}
            onChange={(e) => onUpdate(row.id, 'divisi', e.target.value)}
            disabled={!canEdit}
            className="input text-[11px] w-full"
          >
            <option value="">-- Pilih Divisi --</option>
            {(divisions || []).filter((d) => d.is_active !== 0 && d.active !== 0).map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </td>
        <td className="text-center">{actionCell}</td>
      </tr>
    );
  }

  const brandOptions = buildBrandOptions(brands, principals, allRows, row.id, activeDivisi, divisions);
  const activeDivisionId = activeDivisi ? (divisions || []).find((d) => d.name === activeDivisi)?.id : null;
  const principalOptions = (principals || [])
    .filter((p) => p.is_active !== 0 && p.active !== 0)
    .filter((p) => !activeDivisi || activeDivisionId == null || p.division_id === activeDivisionId)
    .map((p) => ({ value: p.name }));
  const activeDivisions = (divisions || []).filter((d) => d.is_active !== 0 && d.active !== 0);
  const nameFieldFor = (type) => {
    if (type === 'brand') return (
      <ComboSelect value={row.label || ''} onChange={(v) => onUpdate(row.id, 'label', v)} options={brandOptions} placeholder="Nama brand" emptyHint="Tidak ada brand cocok." disabled={!canEdit} />
    );
    if (type === 'principal') return (
      <ComboSelect value={row.label || ''} onChange={(v) => onUpdate(row.id, 'label', v)} options={principalOptions} placeholder="Nama principal" emptyHint="Tidak ada principal cocok." disabled={!canEdit} />
    );
    return <input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} placeholder="Nama golongan" />;
  };
  const divisiSelect = (value, onChangeValue) => (
    <select value={value} onChange={(e) => onChangeValue(e.target.value)} disabled={!canEdit} className="input text-[12px] py-1.5 w-full">
      <option value="">-- Pilih Divisi --</option>
      {activeDivisions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
    </select>
  );

  // Total rows: auto-computed from principal + brand rows (not editable)
  if (row.type === 'total-divisi' || row.type === 'total') {
    const total = computeTotalFor(allRows, index);
    const tPct = total.target > 0 ? (total.achievement / total.target) * 100 : 0;
    const tStatus = total.target > 0 && tPct >= 100 ? 'Tercapai' : 'Gugur';
    return (
      <tr {...trProps} className={`font-semibold${rowStateClass}`}>
        <td>{row.type === 'total-divisi' ? divisiSelect(row.divisi || '', (v) => onUpdate(row.id, 'divisi', v)) : <input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} />}</td>
        <td>{jenisSelect}</td>
        <td className="text-right">{total.target.toLocaleString('id-ID')}</td>
        <td className="text-right">{total.achievement.toLocaleString('id-ID')}</td>
        <td className="text-right">{tPct.toFixed(1)}%</td>
        <td><span className={`result-badge ${tStatus === 'Tercapai' ? 'success' : 'warning'}`}>{total.target > 0 ? tStatus : ''}</span></td>
        <td className="text-center">{actionCell}</td>
      </tr>
    );
  }

  // Principal: editable manual inputs; placeholders show the auto sum from linked brands above.
  // No read-only lock — filled manual values override the auto sum.
  if (row.type === 'principal') {
    const auto = principalAutoValue(allRows, index);
    const eff = principalValueFor(allRows, index);
    const pPct = eff.target > 0 ? (eff.achievement / eff.target) * 100 : 0;
    const pStatus = eff.target > 0 && pPct >= 100 ? 'Tercapai' : 'Gugur';
    return (
      <tr {...trProps} className={`font-semibold${rowStateClass}`}>
        <td>{nameFieldFor('principal')}</td>
        <td>{jenisSelect}</td>
        <td><input type="number" min="0" value={row.target ?? ''} onChange={(e) => onUpdate(row.id, 'target', e.target.value)} disabled={!canEdit} placeholder={auto.count > 0 ? String(auto.target) : ''} /></td>
        <td><input type="number" min="0" value={row.achievement ?? ''} onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)} disabled={!canEdit} placeholder={auto.count > 0 ? String(auto.achievement) : ''} /></td>
        <td className="text-right">{eff.target > 0 ? `${pPct.toFixed(1)}%` : '0.0%'}</td>
        <td><span className={`result-badge ${pStatus === 'Tercapai' ? 'success' : 'warning'}`}>{eff.target > 0 ? pStatus : ''}</span></td>
        <td className="text-center">{actionCell}</td>
      </tr>
    );
  }

  return (
    <tr {...trProps} className={rowStateClass}>
      <td>{nameFieldFor(row.type || 'brand')}</td>
      <td>{jenisSelect}</td>
      <td><input type="number" min="0" value={row.target ?? ''} onChange={(e) => onUpdate(row.id, 'target', e.target.value)} disabled={!canEdit} /></td>
      <td><input type="number" min="0" value={row.achievement ?? ''} onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)} disabled={!canEdit} /></td>
      <td className="text-right">{target > 0 ? `${pct.toFixed(1)}%` : '0.0%'}</td>
      <td><span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{statusLabel}</span></td>
      <td className="text-center">{actionCell}</td>
    </tr>
  );
}

function GolonganTable({ rows, onUpdate, onRemove, onJenisChange, onAdd, onReorder, canEdit, salesDivisi, setSalesDivisi, divisions, brands, principals }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const dnd = {
    dragIndex,
    overIndex,
    start: (index, e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      setDragIndex(index);
      setOverIndex(null);
    },
    enter: (index) => {
      if (dragIndex !== null && dragIndex !== index) setOverIndex(index);
    },
    over: (index, e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    drop: (index, e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      if (Number.isInteger(from)) onReorder(from, index);
      setDragIndex(null);
      setOverIndex(null);
    },
    end: () => {
      setDragIndex(null);
      setOverIndex(null);
    },
  };

  // Divisi seksi per baris: mulai dari Divisi atas (salesDivisi), ganti saat Divisi row,
  // tutup (general) setelah Total Divisi/Total. Baris di dalam seksi hanya lihat Brand/Principal link divisi itu.
  const sectionDivisi = (() => {
    const out = [];
    let current = salesDivisi && String(salesDivisi).trim() ? String(salesDivisi) : null;
    rows.forEach((r) => {
      out.push(current);
      if (r.type === 'divisi') current = r.divisi ? String(r.divisi) : null;
      else if (r.type === 'total-divisi' || r.type === 'total') current = null;
    });
    return out;
  })();

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
        {canEdit && (
          <tr className="golongan-divisi-row">
            <td colSpan={6}>
              <label className="text-[11px] font-semibold text-ink-700 mr-2">Divisi</label>
              <select
                value={salesDivisi || ''}
                onChange={(e) => setSalesDivisi(e.target.value)}
                className="input text-[11px] w-full"
              >
                <option value="">-- Pilih Divisi --</option>
                {(divisions || []).filter((d) => d.is_active !== 0 && d.active !== 0).map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </td>
            <td className="text-center" />
          </tr>
        )}
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
              dnd={canEdit ? dnd : null}
              divisions={divisions}
              brands={brands}
              principals={principals}
              activeDivisi={sectionDivisi[index] || null}
            />
          ))}
        </tbody>
      </table>
      {canEdit && (
        <div className="flex justify-end mt-3 gap-2">
          <Button className="button secondary text-[12px] py-1.5 px-3" onClick={() => onAdd('brand')}>
            <Icon size={14}><path d="M12 5v14M5 12h14"/></Icon> Tambah Baris
          </Button>
          <Button className="button secondary text-[12px] py-1.5 px-3" onClick={() => onAdd('divisi')}>
            <Icon size={14}><path d="M12 5v14M5 12h14"/></Icon> Tambah Divisi
          </Button>
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
  const isGugur50 = row.label === 'GOL YG GUGUR KURANG DARI 50%';
  const isCallCompliance = row.label === 'CALL COMPLIANCE';

  return (
    <tr className="kriteria-row">
      <td>{row.label}</td>
      <td><input type="number" min="0" value={row.target_value ?? ''} onChange={(e) => onUpdate(row.criteria_id, 'target_value', e.target.value)} disabled={!canEdit} /></td>
      <td><input type="number" min="0" value={row.achievement_value ?? ''} onChange={(e) => onUpdate(row.criteria_id, 'achievement_value', e.target.value)} disabled={!canEdit} /></td>
      {isGugur50 ? (
        <td></td>
      ) : isCallCompliance ? (
        <td><input type="number" min="0" step="0.01" value={row.percentage_value ?? percentage.toFixed(1)} onChange={(e) => onUpdate(row.criteria_id, 'percentage_value', e.target.value)} disabled={!canEdit} /></td>
      ) : (
        <td>{target > 0 ? `${percentage.toFixed(1)}%` : ''}</td>
      )}
      {isGugur50 ? (
        <td></td>
      ) : (
        <td><span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{target > 0 ? status : ''}</span></td>
      )}
      <td><input type="number" min="0" value={row.incentive_amount ?? ''} onChange={(e) => onUpdate(row.criteria_id, 'incentive_amount', e.target.value)} disabled={!canEdit} /></td>
    </tr>
  );
}

function KriteriaTable({ rows, onUpdate, canEdit, totalOverride, onTotalChange }) {
  // Total = auto-sum of the incentive column, overridable by typing (empty = back to auto)
  const autoSum = rows.reduce((s, r) => s + (Number(r.incentive_amount) || 0), 0);
  const totalValue = totalOverride ?? autoSum;

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
          <tr className="font-semibold bg-slate-50">
            <td>TOTAL INSENTIVE</td>
            <td />
            <td />
            <td />
            <td />
            <td>
              <input
                type="number"
                min="0"
                value={totalValue === '' || totalValue === null || Number.isNaN(totalValue) ? '' : totalValue}
                onChange={(e) => onTotalChange(e.target.value === '' ? null : Number(e.target.value))}
                disabled={!canEdit}
                aria-label="Total insentif"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Documents({
  docType = 'sales',
  user,
  onCreate, onUpdate, onSubmit, onCancel,
  documentId, golonganRows, updateGolonganRow, removeGolonganRow, addGolonganRow, reorderGolonganRow,
  criteriaRows, updateCriteriaRow,
  updateSales, sales, period, setPeriod,
  kwitansi, setKwitansi,
  insentifTotal, setInsentifTotal,
  documentStatus, saved,
  salesDivisi, setSalesDivisi,
}) {
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
    if ((type === 'brand' || type === 'principal' || type === 'divisi') && isAutoLabel) updateGolonganRow(row.id, 'label', '');
    if (type === 'brand' || type === 'principal' || type === 'total') updateGolonganRow(row.id, 'divisi', '');
  };

  // Picking a month keeps the typed year (or the current year) — year stays manual
  const pickMonth = (monthName) => {
    const year = /(\d{4})$/.exec(period || '')?.[1] || String(new Date().getFullYear());
    setPeriod(`${monthName} ${year}`);
  };

  // SPV page: rekap format (Excel-table style), read-only. BM stays a placeholder.
  if (docType === 'bm') {
    const name = docType.toUpperCase();
    return (
      <>
        <div className="page-head doc-page-head">
          <div className="page-head-copy">
            <h1>Dokumen {name}</h1>
            <p>Rekap insentif tingkat {name} belum tersedia pada versi ini.</p>
          </div>
        </div>
        <section className="content-card info-card">
          <div className="empty-state">
            <strong>Halaman {name} masih kosong</strong>
            <p>Gunakan halaman Sales untuk mencatat perhitungan insentif. Rekap {name} akan ditambahkan di tahap berikutnya.</p>
          </div>
        </section>
      </>
    );
  }

  if (docType === 'spv') {
    const name = docType.toUpperCase();
    return (
      <>
        <div className="page-head doc-page-head">
          <div className="page-head-copy">
            <h1>Rekap Insentif {name}</h1>
            <p>Rekapitulasi perhitungan insentif tingkat {name}.</p>
          </div>
        </div>
        <section className="content-card info-card print-section">
          <div className="empty-state">
            <strong>Belum ada data rekap {name}</strong>
            <p>Data rekap insentif tingkat {name} akan ditampilkan dalam tabel berikut setelah tersedia.</p>
          </div>
        </section>
      </>
    );
  }

  // docType === 'sales' — current editor
  return (
    <>
      <div className="page-head doc-page-head">
        <div className="page-head-copy">
          <h1>Perhitungan Insentif</h1>
          <div className="doc-head-meta">
            <span className={`status-pill ${documentStatus === 'Final' ? 'final' : 'draft'}`}>{documentStatus}</span>
            <span className="meta-text">{period} · {sales.name || 'Salesman belum dipilih'}</span>
          </div>
        </div>
        <div className="page-head-actions">
          <Button className="button secondary" type="button" onClick={handlePrint}>
            <Icon size={15}><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5h20v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></Icon>
            Cetak
          </Button>
          <Button className="button primary" type="button" onClick={save} disabled={!canEdit}>
            <Icon size={16}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>
            {documentId ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
          {canFinalize && (
            <Button className="button secondary" type="button" onClick={onSubmit} disabled={!documentId}>Finalisasi</Button>
          )}
        </div>
      </div>

      <div className="print-header">
        <div className="print-title">
          <h1>PERHITUNGAN INSENTIF</h1>
          <Button className="button primary" onClick={handlePrint}>Cetak</Button>
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
              onChange={pickMonth}
              options={monthNames().map((m) => ({ value: m }))}
              placeholder="Pilih bulan, ketik tahunnya..."
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
            <div><strong>Wilayah:</strong><span>{wilayah}</span></div>
            <div><strong>Salesman:</strong><span>{sales.name || '-'}</span></div>
            <div><strong>Produk:</strong><span>{sales.product || '-'}</span></div>
            <div><strong>Bulan:</strong><span>{period || '-'}</span></div>
          </div>
        </div>

        <GolonganTable
          rows={golonganRows}
          onUpdate={updateGolonganRow}
          onRemove={removeGolonganRow}
          onJenisChange={changeJenis}
          onAdd={addGolonganRow}
          onReorder={reorderGolonganRow}
          canEdit={canEdit}
          salesDivisi={salesDivisi}
          setSalesDivisi={setSalesDivisi}
          divisions={masterData.divisions}
          brands={masterData.brands}
          principals={masterData.principals}
        />

        <KriteriaTable
          rows={visibleCriteriaRows}
          onUpdate={updateCriteriaRow}
          canEdit={canEdit}
          totalOverride={insentifTotal}
          onTotalChange={setInsentifTotal}
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
            <span className="sig-name">{selectedPosition?.name || sales.name || '–'}</span>
            <span className="sig-role">{selectedPosition?.position_type || 'SALES'}</span>
          </div>
          <div className="kw-total">
            <span>Total Keseluruhan</span>
            <strong>Rp {totals.achievement.toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </section>

      <footer className="action-bar">
        <div className="autosave"><span className="save-dot" />{saved ? 'Draft tersimpan' : 'Draft belum disimpan'}</div>
        <div className="actions">
          <Button className="button secondary" onClick={onCancel}>Batal</Button>
          <Button className="button primary" onClick={save} disabled={!canEdit}>
            <Icon size={17}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>
            {documentId ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
          {canFinalize && <Button className="button secondary" onClick={onSubmit} disabled={!documentId}>Finalisasi</Button>}
        </div>
      </footer>
    </>
  );
}
