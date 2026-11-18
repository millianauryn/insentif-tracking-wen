import { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/button';
import Icon from '../components/Icon';
import PickerChips from '../components/PickerChips';
import { MultipleSelect } from '../components/ui/multiple-select';
import ComboSelect from '../components/ComboSelect';
import MonthPicker from '../components/MonthPicker';
import './CompactTable.css';
import { isGugurCriteria } from '../lib/criteria';
import { computeTotalFor, computeTotalAutoFor, computeGrandTotal, principalAutoValue, principalValueFor } from '../lib/golongan';
import { branchRegionIds } from '../lib/orgTree';
import { parseMoney } from '../lib/money';
import { terbilang } from '../lib/terbilang';

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
// Filter produk: hanya brand milik principal yang dipilih — tanpa produk dipilih, kosong.
// Urutan: dikelompokkan per principal (urut pilihan produk), brand A→Z di dalam kelompoknya.
export function buildBrandOptions(brands, principals, allRows, currentId, activeDivisi, divisions, selectedPrincipalNames = []) {
  const selected = (selectedPrincipalNames || []).map((n) => (n || '').trim().toLowerCase()).filter(Boolean);
  if (!selected.length) return []; // belum pilih produk → brand & principal tidak terisi

  const used = new Set((allRows || []).filter((r) => r.type === 'brand' && r.id !== currentId).map((r) => (r.label || '').trim().toLowerCase()).filter(Boolean));
  const divisionId = activeDivisi ? (divisions || []).find((d) => d.name === activeDivisi)?.id : null;
  const inDivision = (b) => {
    if (!activeDivisi || divisionId == null) return true;
    const principal = (principals || []).find((p) => p.id === b.principal_id);
    return principal?.division_id === divisionId;
  };
  const principalOf = (b) => (b.principal_id ? (principals || []).find((p) => p.id === b.principal_id) : null);
  const keyOf = (b) => (principalOf(b)?.name || '').trim().toLowerCase();

  const picked = (brands || [])
    .filter((b) => b.is_active !== 0 && b.active !== 0)
    .filter((b) => !used.has((b.name || '').trim().toLowerCase()))
    .filter(inDivision)
    // Ikut tampil selama ada produk terpilih: principal terpilih ATAU brand tanpa principal.
    .filter((b) => !keyOf(b) || selected.includes(keyOf(b)));

  // '' = kumpulan brand tanpa principal, selalu terakhir.
  const groups = new Map([...selected, ''].map((key) => [key, []]));
  for (const b of picked) groups.get(keyOf(b)).push(b);

  const out = [];
  for (const key of groups.keys()) {
    groups.get(key)
      .sort((a, b2) => (a.name || '').localeCompare(b2.name || ''))
      .forEach((b) => out.push({ value: b.name, hint: principalOf(b)?.name || '' }));
  }
  return out;
}

function GolonganRow({ row, index, allRows, onUpdate, onRemove, onJenisChange, canEdit, dnd, divisions, brands, principals, activeDivisi, selectedPrincipalNames }) {
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
        <td colSpan={5}>
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

  const brandOptions = buildBrandOptions(brands, principals, allRows, row.id, activeDivisi, divisions, selectedPrincipalNames);
  const activeDivisionId = activeDivisi ? (divisions || []).find((d) => d.name === activeDivisi)?.id : null;
  // Principal juga mengikuti produk yang dipilih — urut sesuai urutan pilihan.
  const selectedKeys = (selectedPrincipalNames || []).map((n) => (n || '').trim().toLowerCase()).filter(Boolean);
  const principalOrder = new Map(selectedKeys.map((k, i) => [k, i]));
  const principalOptions = (principals || [])
    .filter((p) => p.is_active !== 0 && p.active !== 0)
    .filter((p) => !activeDivisi || activeDivisionId == null || p.division_id === activeDivisionId)
    .filter((p) => principalOrder.has((p.name || '').trim().toLowerCase()))
    .sort((a, b2) => principalOrder.get((a.name || '').trim().toLowerCase()) - principalOrder.get((b2.name || '').trim().toLowerCase()))
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

  // Total rows: auto dari principal + brand; bisa ditimpa manual lewat kolom pencapaian.
  if (row.type === 'total-divisi' || row.type === 'total') {
    const auto = computeTotalAutoFor(allRows, index);
    const total = computeTotalFor(allRows, index);
    const tPct = total.target > 0 ? (total.achievement / total.target) * 100 : 0;
    const tStatus = total.target > 0 && tPct >= 100 ? 'Tercapai' : 'Gugur';
    return (
      <tr {...trProps} className={`font-semibold${rowStateClass}`}>
        <td>{row.type === 'total-divisi' ? divisiSelect(row.divisi || '', (v) => onUpdate(row.id, 'divisi', v)) : <input value={row.label || ''} onChange={(e) => onUpdate(row.id, 'label', e.target.value)} disabled={!canEdit} />}</td>
        <td>{jenisSelect}</td>
        <td className="text-right">{total.target > 0 ? '100%' : ''}</td>
        <td><span className="pct-input"><input type="number" min="0" step="0.01" value={row.achievement ?? ''} onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)} disabled={!canEdit} placeholder={auto.achievement ? String(auto.achievement) : ''} aria-label={`Tercapai persen total ${index + 1}`} /><span>%</span></span></td>
        <td><span className={`result-badge ${tStatus === 'Tercapai' ? 'success' : 'warning'}`}>{total.target > 0 ? tStatus : ''}</span></td>
        <td className="text-center">{actionCell}</td>
      </tr>
    );
  }

  // Principal: pencapaian otomatis = jumlah brand di atasnya; bisa ditimpa manual.
  if (row.type === 'principal') {
    const auto = principalAutoValue(allRows, index);
    const eff = principalValueFor(allRows, index);
    const pPct = eff.target > 0 ? (eff.achievement / eff.target) * 100 : 0;
    const pStatus = eff.target > 0 && pPct >= 100 ? 'Tercapai' : 'Gugur';
    return (
      <tr {...trProps} className={`font-semibold${rowStateClass}`}>
        <td>{nameFieldFor('principal')}</td>
        <td>{jenisSelect}</td>
        <td>100%</td>
        <td><span className="pct-input"><input type="number" min="0" step="0.01" value={row.achievement ?? ''} onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)} disabled={!canEdit} placeholder={auto.count > 0 ? String(auto.achievement) : ''} aria-label={`Tercapai persen principal ${index + 1}`} /><span>%</span></span></td>
        <td><span className={`result-badge ${pStatus === 'Tercapai' ? 'success' : 'warning'}`}>{eff.target > 0 ? pStatus : ''}</span></td>
        <td className="text-center">{actionCell}</td>
      </tr>
    );
  }

  return (
    <tr {...trProps} className={rowStateClass}>
      <td>{nameFieldFor(row.type || 'brand')}</td>
      <td>{jenisSelect}</td>
      <td>100%</td>
      <td><span className="pct-input"><input type="number" min="0" step="0.01" value={row.achievement ?? ''} onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)} disabled={!canEdit} aria-label={`Tercapai persen baris ${index + 1}`} /><span>%</span></span></td>
      <td><span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{statusLabel}</span></td>
      <td className="text-center">{actionCell}</td>
    </tr>
  );
}

export function GolonganTable({ rows, onUpdate, onRemove, onJenisChange, onAdd, onReorder, canEdit, salesDivisi, setSalesDivisi, divisions, brands, principals, selectedPrincipalNames = [] }) {
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
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr className="golongan-header">
            <th>GOLONGAN</th>
            <th className="w-[130px]">JENIS</th>
            <th>TARGET</th>
            <th>TERCAPAI (%)</th>
            <th>KET</th>
            <th className="w-[50px]" aria-label="Aksi" />
          </tr>
        </thead>
        {canEdit && (
          <tbody>
            <tr className="golongan-divisi-row">
              <td colSpan={5}>
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
          </tbody>
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
              selectedPrincipalNames={selectedPrincipalNames}
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

function KriteriaRow({ row, onUpdate, canEdit, incentiveEditable }) {
  // TOTAL OMZET: target tetap 100%, yang diisi officer hanya pencapaian dalam persen.
  const isOmzet = row.label === 'TOTAL OMZET';
  const target = isOmzet ? 100 : (parseMoney(row.target_value) ?? 0);
  const achievement = parseMoney(row.achievement_value) ?? 0;
  const percentage = target > 0 ? (achievement / target) * 100 : 0;
  const status = target > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur';
  const isGugur50 = row.label === 'GOL YG GUGUR KURANG DARI 50%';
  const isCallCompliance = row.label === 'CALL COMPLIANCE';
  const gugur = isGugurCriteria(row);

  return (
    <tr className="kriteria-row">
      <td>{row.label}</td>
      {isOmzet ? <td>100%</td> : <td><input type="number" min="0" value={row.target_value ?? ''} onChange={(e) => onUpdate(row.criteria_id, 'target_value', e.target.value)} disabled={!canEdit} /></td>}
      {isOmzet ? (
        <td><span className="pct-input"><input type="number" min="0" step="0.01" value={row.achievement_value ?? ''} disabled aria-label="Tercapai total omzet (%) dari tabel golongan" /><span>%</span></span></td>
      ) : (
        <td><input type="number" min="0" value={row.achievement_value ?? ''} onChange={(e) => onUpdate(row.criteria_id, 'achievement_value', e.target.value)} disabled={!canEdit} /></td>
      )}
      {isGugur50 ? (
        <td></td>
      ) : isCallCompliance ? (
        <td><span className="pct-input"><input type="number" min="0" step="0.01" value={row.percentage_value ?? percentage.toFixed(1)} onChange={(e) => onUpdate(row.criteria_id, 'percentage_value', e.target.value)} disabled={!canEdit} aria-label="Call Compliance (%)" /><span>%</span></span></td>
      ) : (
        <td>{target > 0 ? `${percentage.toFixed(1)}%` : ''}</td>
      )}
      {isGugur50 ? (
        <td></td>
      ) : (
        <td><span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{target > 0 ? status : ''}</span></td>
      )}
      <td><input type="number" value={gugur ? '0' : (row.incentive_amount ?? '')} onChange={(e) => onUpdate(row.criteria_id, 'incentive_amount', e.target.value)} disabled={gugur || (!canEdit && !incentiveEditable)} aria-label={`Insentive ${row.label}`} /></td>
    </tr>
  );
}

export function KriteriaTable({ rows, onUpdate, canEdit, totalOverride, onTotalChange, totalEditable = false, incentiveEditable = false }) {
  // Total = auto-sum kolom insentif (angka valid saja; Gugur 50% minus ikut kurangi), overridable by typing
  const autoSum = rows.reduce((s, r) => s + (parseMoney(r.incentive_amount) ?? 0), 0);
  const totalValue = totalOverride ?? autoSum;

  return (
    <div className="table-wrap compact-table">
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
            <KriteriaRow key={row.criteria_id} row={row} onUpdate={onUpdate} canEdit={canEdit} incentiveEditable={incentiveEditable} />
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
                value={totalValue === '' || totalValue === null || Number.isNaN(totalValue) ? '' : totalValue}
                onChange={(e) => onTotalChange(e.target.value === '' ? null : Number(e.target.value))}
                disabled={!canEdit && !totalEditable}
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
  onCreate, onUpdate, onCancel,
  documentId, golonganRows, updateGolonganRow, removeGolonganRow, addGolonganRow, reorderGolonganRow,
  criteriaRows, updateCriteriaRow,
  updateSales, sales, period, setPeriod,
  kwitansi, setKwitansi,
  insentifTotal, setInsentifTotal,
  documentStatus, saved,
  salesDivisi, setSalesDivisi,
  masterData = EMPTY_MASTER,
  positions = [],
}) {
  const canEdit = ['superadmin', 'officer'].includes(user.role);

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

  // Superadmin: filter Area (region) dan Cabang menentukan daftar salesman.
  // Dokumen lama hanya menyimpan kota (sales.region), jadi kota itu dipakai sebagai cadangan.
  const [areaName, setAreaName] = useState('');
  const [branchName, setBranchName] = useState('');
  const hasScope = Boolean(areaName || branchName || sales.region);
  const activeBranches = useMemo(
    () => masterData.branches.filter((b) => b.is_active !== 0 && b.active !== 0),
    [masterData.branches],
  );
  const areaRegion = useMemo(
    () => masterData.regions.find((r) => r.name === areaName),
    [masterData.regions, areaName],
  );
  const regionOptions = useMemo(
    () => masterData.regions.filter((r) => r.is_active !== 0).map((r) => ({ value: r.name })),
    [masterData.regions],
  );
  const branchOptions = useMemo(
    () => activeBranches
      .filter((b) => !areaName || (areaRegion && branchRegionIds(b).includes(areaRegion.id)))
      .map((b) => ({ value: b.name })),
    [activeBranches, areaName, areaRegion],
  );
  const scopedBranches = useMemo(() => {
    if (branchName) return activeBranches.filter((b) => b.name === branchName);
    if (areaName) return areaRegion ? activeBranches.filter((b) => branchRegionIds(b).includes(areaRegion.id)) : [];
    return sales.region ? activeBranches.filter((b) => b.city === sales.region) : [];
  }, [activeBranches, branchName, areaName, areaRegion, sales.region]);

  // Sales options: officer → positions at own branches; superadmin → positions at scoped branches
  // (memo: dihitung ulang hanya saat inputs berubah, bukan tiap ketik di form dokumen)
  const salesOptions = useMemo(() => {
    const positionsAtBranches = (branchIds) =>
      positions.filter((p) => p.active && (p.branch_ids || []).some((id) => branchIds.includes(id)));
    return isSuper
      ? positionsAtBranches(scopedBranches.map((b) => b.id))
      : positionsAtBranches(user.branch_ids || []);
  }, [positions, isSuper, scopedBranches, user.branch_ids]);

  const pickArea = (v) => {
    setAreaName(v);
    setBranchName('');
    updateSales('region', '');
  };
  const pickBranch = (v) => {
    setBranchName(v);
    const branch = activeBranches.find((b) => b.name === v);
    updateSales('region', branch?.city || '');
  };
  const salesList = useMemo(() => {
    const salesOnly = salesOptions.filter((p) => p.position_type === 'SALES');
    return salesOnly.length ? salesOnly : salesOptions;
  }, [salesOptions]);

  // Wilayah shown in doc header (kota)
  const wilayah = sales.region || '-';

  // Penerima kwitansi = nama cabang yang di-link ke akun officer; superadmin pilih lewat dropdown
  const ownBranchName = (!isSuper && (user.branch_ids || []).length)
    ? masterData.branches.filter((b) => (user.branch_ids || []).includes(b.id))[0]?.name
    : null;
  useEffect(() => {
    if (isSuper || !ownBranchName || !setKwitansi) return;
    if (kwitansi?.penerima !== ownBranchName) setKwitansi({ ...kwitansi, penerima: ownBranchName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, ownBranchName]);
  const kwPenerima = isSuper ? (kwitansi.penerima || '') : (ownBranchName || kwitansi.penerima || '');

  // Selected salesman's position (kwitansi signature)
  const selectedPosition = positions.find(
    (p) => p.active && p.name.trim().toLowerCase() === (sales.name || '').trim().toLowerCase()
  ) || null;

  // Produk selection derived from sales.product (source of truth)
  const selectedBrands = parseBrands(sales.product);
  // Nama principal terpilih (urut pilihan) — jadi filter dropdown brand & principal di tabel golongan.
  const selectedPrincipalNames = selectedBrands.map((n) => n.trim()).filter(Boolean);

  // Jabatan-specific kriteria: superadmin / unconfigured jabatan → all criteria visible
  const myCriteriaIds = user.criteria_ids;
  const showAllCriteria = user.role === 'superadmin' || !myCriteriaIds || myCriteriaIds.length === 0;
  const visibleCriteriaRows = showAllCriteria
    ? criteriaRows
    : criteriaRows.filter((r) => myCriteriaIds.includes(r.criteria_id));

  // Total insentif efektif: override manual atau jumlah kolom insentif (Gugur 50% minus berkurang dari yang di atas)
  const criteriaAutoSum = visibleCriteriaRows.reduce((s, r) => s + (Number(r.incentive_amount) || 0), 0);
  const effectiveInsentif = insentifTotal ?? criteriaAutoSum;
  const kwAutoPurpose = period ? `Incentive penjualan bulan ${period}` : '';
  const kwEffectiveAmount = kwitansi?.nominal?.trim()
    ? kwitansi.nominal
    : effectiveInsentif
      ? Number(effectiveInsentif).toLocaleString('en-US')
      : '';
  const kwSignatureName = selectedPosition?.name || sales.name || '–';
  const kwSignatureRole = selectedPosition?.position_type === 'SALES'
    ? 'SALES'
    : (selectedPosition?.position_type || 'SALES');

  const save = () => (documentId ? onUpdate() : onCreate());

  const grand = computeGrandTotal(golonganRows);
  const totals = { target: grand.target, achievement: grand.achievement };
  totals.percentage = totals.target > 0 ? (totals.achievement / totals.target) * 100 : 0;
  totals.status = totals.target > 0 && totals.percentage >= 100 ? 'Tercapai' : 'Gugur';

  const changeJenis = (row, type) => {
    const isAutoLabel = row.label === 'TOTAL DIVISI' || row.label === 'TOTAL';
    updateGolonganRow(row.id, 'type', type);
    updateGolonganRow(row.id, 'isGroup', type !== 'brand');
    // Brand dan principal selalu target 100%. Pencapaian principal otomatis dari brand di atas.
    if (type === 'principal') updateGolonganRow(row.id, 'achievement', '');
    updateGolonganRow(row.id, 'target', type === 'brand' || type === 'principal' ? 100 : '');
    if (type === 'total-divisi' && (!row.label || isAutoLabel)) updateGolonganRow(row.id, 'label', 'TOTAL DIVISI');
    if (type === 'total' && (!row.label || isAutoLabel)) updateGolonganRow(row.id, 'label', 'TOTAL');
    if ((type === 'brand' || type === 'principal' || type === 'divisi') && isAutoLabel) updateGolonganRow(row.id, 'label', '');
    if (type === 'brand' || type === 'principal' || type === 'total') updateGolonganRow(row.id, 'divisi', '');
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

  // docType === 'sales' — current editor (halaman SPV punya komponen sendiri: SpvDocument.jsx)
  return (
    <>
      <div className="page-head doc-page-head">
        <div className="page-head-copy">
          <h1>Perhitungan Insentif</h1>
          <div className="doc-head-meta">
            <span className="meta-text">{period} · {sales.name || 'Sales belum dipilih'}</span>
          </div>
        </div>
        <div className="page-head-actions">
          {canEdit && (
            <Button className="button secondary" type="button" onClick={onCancel}>Dokumen Baru</Button>
          )}
          <Button className="button primary" type="button" onClick={save} disabled={!canEdit}>
            <Icon size={16}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>
            {documentId ? 'Simpan Perubahan' : 'Simpan'}
          </Button>
        </div>
      </div>

      <div className="print-header">
        <div className="print-title">
          <h1>PERHITUNGAN INSENTIF</h1>
        </div>
      </div>

      {/* Informasi Dokumen — placed at top */}
      <section className="content-card info-card">
        <div className="section-heading">
          <div className="section-icon blue"><Icon><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></Icon></div>
          <div><h2>Informasi Dokumen</h2><p>Data dasar dokumen insentif sales.</p></div>
          {documentStatus === 'Final' && <span className="draft-badge final-badge">Final</span>}
        </div>
        <div className="form-grid">
          {isSuper ? (
            <>
              <label className="block">
                Area
                <ComboSelect
                  value={areaName}
                  onChange={pickArea}
                  options={regionOptions}
                  placeholder={regionOptions.length ? 'Pilih atau ketik area...' : 'Belum ada area'}
                  disabled={!canEdit}
                  emptyHint={regionOptions.length ? 'Tidak ada area cocok.' : 'Belum ada area.'}
                />
              </label>
              <label className="block">
                Cabang / Distributor
                <ComboSelect
                  value={branchName}
                  onChange={pickBranch}
                  options={branchOptions}
                  placeholder={branchOptions.length ? 'Pilih atau ketik cabang...' : 'Belum ada cabang'}
                  disabled={!canEdit}
                  emptyHint={branchOptions.length ? 'Tidak ada cabang cocok.' : 'Belum ada cabang di area ini.'}
                />
              </label>
            </>
          ) : (
            <label className="block">
              Wilayah (Kota)
              <input value={wilayah} readOnly disabled />
            </label>
          )}
          <label className="block">
            Sales
            <ComboSelect
              value={sales.name}
              onChange={(v) => updateSales('name', v)}
              options={salesList.map((p) => ({ value: p.name, hint: p.position_type }))}
              placeholder={isSuper && !hasScope ? 'Pilih area atau cabang dulu' : 'Pilih atau ketik nama sales...'}
              disabled={!canEdit}
              emptyHint={salesList.length ? 'Tidak ada sales cocok.' : isSuper && !hasScope ? 'Pilih area atau cabang dulu.' : 'Belum ada sales di cabang Anda.'}
            />
          </label>
          <div className="doc-period-product">
            <div className="col-span-1">
              <label className="block">
                Bulan
                <MonthPicker value={period} onChange={setPeriod} disabled={!canEdit} placeholder="Pilih bulan" />
              </label>
            </div>
            <div className="col-span-1">
              <MultipleSelect
                label="Produk"
                tags={masterData.principals
                  .filter((pr) => pr.is_active !== 0 && pr.active !== 0)
                  .map((pr) => ({ key: pr.name, name: pr.name }))}
                defaultValue={selectedBrands.map((name) => ({ key: name, name }))}
                onChange={(items) => updateSales('product', joinBrands(items.map((i) => i.name)))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="content-card info-card print-section">
        <div className="doc-header">
          <div className="doc-meta">
            <div><strong>Wilayah:</strong><span>{wilayah}</span></div>
            <div><strong>Sales:</strong><span>{sales.name || '-'}</span></div>
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
          selectedPrincipalNames={selectedPrincipalNames}
        />

        <KriteriaTable
          rows={visibleCriteriaRows}
          onUpdate={updateCriteriaRow}
          canEdit={canEdit}
          totalOverride={insentifTotal}
          onTotalChange={setInsentifTotal}
        />

        <div className="kwitansi-card">
          <h3><u>KWITANSI</u></h3>
          <div className="kwitansi-grid">
            <div className="kw-row"><label>Sudah terima dari :</label>{isSuper ? (
              <ComboSelect
                value={kwPenerima}
                onChange={(v) => setKwitansi({ ...kwitansi, penerima: v })}
                options={masterData.branches.filter((b) => b.is_active !== 0 && b.active !== 0).map((b) => ({ value: b.name }))}
                placeholder="Pilih cabang..."
                disabled={!canEdit}
                emptyHint="Tidak ada cabang cocok."
              />
            ) : <span>{kwPenerima}</span>}</div>
            <div className="kw-row"><label>Jumlah Uang</label><input value={kwitansi.jumlahUang || kwAutoPurpose} onChange={(e) => setKwitansi({ ...kwitansi, jumlahUang: e.target.value })} disabled={!canEdit} /></div>
            <div className="kw-row"><label>Buat Pembayaran</label><input value={kwitansi.keterangan || kwAutoPurpose} onChange={(e) => setKwitansi({ ...kwitansi, keterangan: e.target.value })} disabled={!canEdit} /></div>
            <div className="kw-row"><label>Terbilang Rp.</label><input value={kwEffectiveAmount} onChange={(e) => setKwitansi({ ...kwitansi, nominal: e.target.value, terbilang: terbilang(e.target.value.replace(/[^\d-]/g, '') || effectiveInsentif || 0) })} disabled={!canEdit} /></div>
          </div>
          <div className="kw-sign">
            <span className="sig-name">{kwSignatureName?.toUpperCase()}</span>
            <span className="sig-role">{kwSignatureRole}</span>
          </div>
          <div className="kw-total">
            <span>Total Keseluruhan</span>
            <strong>Rp {Number(effectiveInsentif || 0).toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </section>

      <footer className="action-bar">
        <div className="autosave"><span className="save-dot" />{saved ? 'Tersimpan' : 'Belum disimpan'}</div>
        <div className="actions">
          <Button className="button secondary" onClick={onCancel}>Batal</Button>
          <Button className="button primary" onClick={save} disabled={!canEdit}>
            <Icon size={17}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>
            {documentId ? 'Simpan Perubahan' : 'Simpan'}
          </Button>
        </div>
      </footer>
    </>
  );
}
