import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import Icon from '../components/Icon';
import ComboSelect from '../components/ComboSelect';
import MonthPicker from '../components/MonthPicker';
import { useToast } from '../components/Toast';
import { GolonganTable, KriteriaTable } from './Documents';
import { createDocument, updateDocument, finalizeDocument, getDocument, previewSpvRows, errMsg, getDocumentHistory, deleteDocument } from '../api';
import { terbilang } from '../lib/terbilang';
import { toApiPeriod, fromApiPeriod, currentPeriodLabel, periodRangeLabel } from '../lib/period';
import { parseMoney } from '../lib/money';
import { branchRegionIds } from '../lib/orgTree';

const EMPTY_KWITANSI = {
  penerima: 'PT. BINTANG SINAR JAYA',
  jumlahUang: '',
  keterangan: '',
  terbilang: '',
  nominal: '',
};

const API_PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

// Baris server (golongan_rows) -> baris tabel client: brand di bawah principal,
// lalu satu baris principal berisi jumlah brand-nya, lalu satu baris TOTAL.
// Urutan ini yang dipakai client untuk menghitung total otomatis (computeGrandTotal).
// Baris tanpa principal (merek bebas) diletakkan SETELAH grup principal: kalau di depan,
// computeGrandTotal membuangnya (baris principal menggandakan/menimpa jumlahnya).
// Nama principal dicari dari masterData saat baris beku (dokumen Final) tidak menyimpannya.
export function toGolonganRows(rows, masterData) {
  const out = [];
  const principals = new Map();
  const withoutPrincipal = [];
  rows.forEach((row, index) => {
    const brand = {
      id: `spv-brand-${index}`,
      label: row.label || row.brand_name || '',
      type: 'brand',
      isGroup: false,
      target: row.target ?? 0,
      achievement: row.achievement ?? 0,
    };
    if (!row.principal_id) { withoutPrincipal.push(brand); return; }
    if (!principals.has(row.principal_id)) {
      const name = row.principal_name
        || (masterData?.principals || []).find((p) => p.id === row.principal_id)?.name
        || '';
      principals.set(row.principal_id, { name, brands: [], target: 0, achievement: 0 });
    }
    const group = principals.get(row.principal_id);
    group.brands.push(brand);
    group.target += Number(row.target) || 0;
    group.achievement += Number(row.achievement) || 0;
  });
  for (const group of principals.values()) {
    group.brands.forEach((b) => out.push(b));
    out.push({
      id: `spv-principal-${group.name}`,
      label: group.name,
      type: 'principal',
      isGroup: true,
      target: group.target,
      achievement: group.achievement,
    });
  }
  withoutPrincipal.forEach((b) => out.push(b));
  if (out.length) out.push({ id: 'spv-total', label: 'TOTAL', type: 'total', isGroup: true, target: '', achievement: '' });
  return out;
}

function toCriteriaRows(rows) {
  return rows.map((row) => ({
    criteria_id: row.criteria_id,
    label: row.label,
    target_value: row.target_value ?? 0,
    achievement_value: row.achievement_value ?? 0,
    incentive_amount: row.incentive_amount ?? '',
  }));
}

export default function SpvDocument({ user, positions, masterData, setDocuments, documentFormatId, loadTargetId, onLoadDone }) {
  const toast = useToast();
  const isSuper = user.role === 'superadmin';
  const [documentId, setDocumentId] = useState(null);
  const [documentStatus, setDocumentStatus] = useState('Draft');
  const [positionId, setPositionId] = useState('');
  const [areaName, setAreaName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [periodStart, setPeriodStart] = useState(currentPeriodLabel());
  const [periodEnd, setPeriodEnd] = useState(currentPeriodLabel());
  const [golonganRows, setGolonganRows] = useState([]);
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [insentifTotal, setInsentifTotal] = useState(null);
  const [kwitansi, setKwitansi] = useState(EMPTY_KWITANSI);
  const [savedWilayah, setSavedWilayah] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async () => {
    if (!documentId) return;
    setHistoryOpen(true);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const { history } = await getDocumentHistory(documentId);
      setHistoryData(history || []);
    } catch (err) {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryData(null);
  };

  const canEditDoc = ['officer', 'superadmin'].includes(user.role) && documentStatus === 'Draft';
  const canFinalize = ['observer', 'superadmin'].includes(user.role) && documentStatus === 'Draft' && !!documentId;
  const canDeleteDoc = ['officer', 'superadmin'].includes(user.role) && !!documentId;
  // Total insentif: jumlah insentif per kriteria, boleh dioverride manual di baris TOTAL.
  const totalInsenitif = insentifTotal ?? criteriaRows.reduce((sum, r) => sum + (parseMoney(r.incentive_amount) ?? 0), 0);
  const updateCriteriaRow = (criteriaId, field, value) => {
    setCriteriaRows((rows) => rows.map((r) => (r.criteria_id === criteriaId ? { ...r, [field]: value } : r)));
  };

  const branches = useMemo(
    () => (masterData?.branches || []).filter((b) => b.is_active !== 0 && b.active !== 0),
    [masterData?.branches],
  );
  const regionOptions = useMemo(
    () => (masterData?.regions || []).filter((r) => r.is_active !== 0).map((r) => ({ value: r.name })),
    [masterData?.regions],
  );
  const areaRegion = (masterData?.regions || []).find((r) => r.name === areaName);
  const branchOptions = useMemo(
    () => branches
      .filter((b) => !areaName || branchRegionIds(b).includes(areaRegion?.id))
      .map((b) => ({ value: b.name })),
    [branches, areaName, areaRegion?.id],
  );
  const spvOptions = useMemo(() => positions.filter((p) => {
    if (p.position_type !== 'SPV' || p.active === 0) return false;
    const ids = p.branch_id ? [p.branch_id] : (p.branch_ids || []);
    if (!isSuper && !ids.some((id) => (user.branch_ids || []).includes(id))) return false;
    if (branchName) return ids.includes(branches.find((b) => b.name === branchName)?.id);
    if (areaName) return ids.some((id) => {
      const b = branches.find((x) => x.id === id);
      return b && branchRegionIds(b).includes(areaRegion?.id);
    });
    return true;
  }), [positions, isSuper, user.branch_ids, branches, branchName, areaName, areaRegion?.id]);

  const spv = positions.find((p) => String(p.id) === String(positionId)) || null;
  const spvName = spv?.name || '';
  const periodLabel = periodRangeLabel(toApiPeriod(periodStart), toApiPeriod(periodEnd));
  // Wilayah diturunkan dari cabang SPV (kota pertama), read-only.
  const spvBranchCity = (spv?.branch_ids || [])
    .map((id) => (masterData?.branches || []).find((b) => b.id === id)?.city)
    .filter(Boolean)[0] || '';
  const wilayah = spvBranchCity || savedWilayah;

  // Muat dokumen SPV yang dibuka dari daftar "Dokumen Tersimpan".
  useEffect(() => {
    if (!loadTargetId) return;
    let cancelled = false;
    getDocument(loadTargetId)
      .then(({ document: full }) => {
        if (cancelled) return;
        setDocumentId(full.id);
        setDocumentStatus(full.status);
        setPositionId(String(full.position_id || ''));
        setPeriodStart(fromApiPeriod(full.period));
        setPeriodEnd(fromApiPeriod(full.period_end || full.period));
        setInsentifTotal(full.insentif_total ?? null);
        setKwitansi({ ...EMPTY_KWITANSI, ...(full.kwitansi || {}) });
        setSavedWilayah(full.wilayah || '');
        const savedBranch = branches.find((b) =>
          String(b.city || '').toLowerCase() === String(full.wilayah || '').toLowerCase());
        setBranchName(savedBranch?.name || '');
        const savedRegion = (masterData?.regions || []).find((r) =>
          savedBranch && branchRegionIds(savedBranch).includes(r.id));
        setAreaName(savedRegion?.name || '');
        setGolonganRows(toGolonganRows(full.golongan_rows || [], masterData));
        setCriteriaRows(toCriteriaRows(full.criteria_rows || []));
        setSaved(true);
      })
      .catch((err) => toast('error', errMsg(err)))
      .finally(() => { if (!cancelled) onLoadDone?.(); });
    return () => { cancelled = true; };
  }, [loadTargetId]);

  // Pratinjau: baris ikut berubah begitu SPV + rentang diisi — tanpa harus Simpan Draft.
  // Dokumen Final memakai snapshot beku, jadi pratinjau dimatikan saat status Final.
  useEffect(() => {
    if (!positionId || documentStatus === 'Final') return;
    const start = toApiPeriod(periodStart);
    const end = toApiPeriod(periodEnd);
    if (!API_PERIOD.test(start) || !API_PERIOD.test(end)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewSpvRows({ position_id: Number(positionId), period: start, period_end: end })
        .then((data) => {
          if (cancelled) return;
          setGolonganRows(toGolonganRows(data.golongan_rows || [], masterData));
          // Insentif yang sudah diketik officer tidak hilang saat pratinjau dimuat ulang.
          setCriteriaRows((prev) => toCriteriaRows((data.criteria_rows || []).map((r) => ({
            ...r,
            incentive_amount: prev.find((p) => p.criteria_id === r.criteria_id)?.incentive_amount ?? r.incentive_amount ?? '',
          }))));
        })
        .catch(() => { /* pratinjau gagal: tabel tetap kosong, simpan tetap bisa dipakai */ });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [positionId, periodStart, periodEnd, documentStatus, masterData]);

  const payload = () => ({
    doc_kind: 'spv',
    position_id: Number(positionId),
    format_id: documentFormatId,
    period: toApiPeriod(periodStart),
    period_end: toApiPeriod(periodEnd),
    salesman: spvName,
    wilayah: wilayah || null,
    insentif_total: totalInsenitif,
    // Target & pencapaian tetap server; client hanya mengirim insentif per kriteria.
    criteria_rows: criteriaRows.map((r) => ({ criteria_id: r.criteria_id, incentive_amount: r.incentive_amount })),
    kwitansi,
  });

  const refresh = async (id) => {
    const { document: full } = await getDocument(id);
    setGolonganRows(toGolonganRows(full.golongan_rows || [], masterData));
    setCriteriaRows(toCriteriaRows(full.criteria_rows || []));
    setDocuments((current) => [full, ...current.filter((d) => d.id !== full.id)]);
  };

  const save = async () => {
    if (!canEditDoc || saving) return;
    if (!positionId) { toast('error', 'Pilih SPV terlebih dahulu.'); return; }
    const start = toApiPeriod(periodStart);
    const end = toApiPeriod(periodEnd);
    if (!API_PERIOD.test(start) || !API_PERIOD.test(end)) {
      toast('error', 'Bulan harus lengkap, contoh: Oktober 2026');
      return;
    }
    setSaving(true);
    try {
      const result = documentId
        ? await updateDocument(documentId, payload())
        : await createDocument(payload());
      setDocumentId(result.document.id);
      setDocumentStatus(result.document.status);
      await refresh(result.document.id);
      setSaved(true);
      toast('success', documentId ? 'Dokumen SPV terupdate.' : 'Dokumen SPV tersimpan.');
    } catch (err) {
      toast('error', errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!canFinalize) return;
    try {
      const result = await finalizeDocument(documentId);
      setDocumentStatus(result.document.status);
      await refresh(result.document.id);
      setDocuments((current) => current.map((d) => d.id === result.document.id ? { ...d, status: result.document.status } : d));
      toast('success', 'Dokumen SPV difinalisasi.');
    } catch (err) {
      toast('error', errMsg(err));
    }
  };

  const reset = () => {
    setDocumentId(null);
    setDocumentStatus('Draft');
    setPositionId('');
    setAreaName('');
    setBranchName('');
    setGolonganRows([]);
    setCriteriaRows([]);
    setInsentifTotal(null);
    setKwitansi(EMPTY_KWITANSI);
    setSavedWilayah('');
    setSaved(false);
  };

  return (
    <>
      <div className="page-head doc-page-head">
        <div className="page-head-copy">
          <h1>Perhitungan Insentif</h1>
          <div className="doc-head-meta">
            <span className="meta-text">{periodLabel} · {spvName || 'SPV belum dipilih'}</span>
          </div>
        </div>
        <div className="page-head-actions">
          <Button className="button secondary" type="button" onClick={reset}>Dokumen Baru</Button>
          <Button className="button primary" type="button" onClick={save} disabled={!canEditDoc || saving}>
            <Icon size={16}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>
            {documentId ? 'Simpan Perubahan' : 'Simpan'}
          </Button>
          {canFinalize && <Button className="button secondary" type="button" onClick={submit}>Finalisasi</Button>}
          {canDeleteDoc && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="bg-white text-red-600 border-red-200 hover:bg-red-50" style={{ borderColor: '#fecdd3' }}
              onClick={() => {
                if (!window.confirm(`Hapus dokumen ${spvName || documentId} periode ${periodLabel}?`)) return;
                deleteDocument(documentId).then(() => {
                  window.dispatchEvent(new Event('insetif-expand'));
                });
              }}
            >
              Hapus
            </Button>
          )}
          {documentId && (
            <Button className="button secondary" type="button" onClick={openHistory} disabled={historyLoading}>
              {historyLoading ? 'Memuat...' : 'Riwayat'}
            </Button>
          )}
        </div>
      </div>

      <div className="print-header">
        <div className="print-title">
          <h1>PERHITUNGAN INSENTIF</h1>
        </div>
      </div>

      <section className="content-card info-card">
        <div className="section-heading">
          <div className="section-icon blue"><Icon><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></Icon></div>
          <div><h2>Informasi Dokumen</h2><p>Data dasar dokumen insentif SPV.</p></div>
          {documentStatus === 'Final' && <span className="draft-badge final-badge">Final</span>}
        </div>
        <div className="form-grid">
          <label className="block">
            Area
            <ComboSelect
              value={areaName}
              onChange={(v) => { setAreaName(v); setBranchName(''); setPositionId(''); }}
              options={regionOptions}
              placeholder={regionOptions.length ? 'Pilih atau ketik area...' : 'Belum ada area'}
              disabled={!canEditDoc}
              emptyHint={regionOptions.length ? 'Tidak ada area cocok.' : 'Belum ada area.'}
            />
          </label>
          <label className="block">
            Cabang / Distributor
            <ComboSelect
              value={branchName}
              onChange={(v) => { setBranchName(v); setPositionId(''); }}
              options={branchOptions}
              placeholder={branchOptions.length ? 'Pilih atau ketik cabang...' : 'Belum ada cabang'}
              disabled={!canEditDoc}
              emptyHint={branchOptions.length ? 'Tidak ada cabang cocok.' : 'Belum ada cabang di area ini.'}
            />
          </label>
          <label className="block">
            SPV
            <ComboSelect
              value={spvName}
              onChange={(v) => { const hit = spvOptions.find((p) => p.name === v); setPositionId(hit ? String(hit.id) : ''); }}
              options={spvOptions.map((p) => ({ value: p.name, hint: p.sales_code || '' }))}
              placeholder="Pilih SPV..."
              disabled={!canEditDoc}
              emptyHint="Tidak ada SPV di cabang atau area ini."
            />
          </label>
          <div className="doc-period-range">
            <div className="col-span-1">
              <label className="block">
                Periode Awal
                <MonthPicker value={periodStart} onChange={setPeriodStart} disabled={!canEditDoc} placeholder="Pilih bulan awal" />
              </label>
            </div>
            <div className="col-span-1">
              <label className="block">
                Periode Akhir
                <MonthPicker value={periodEnd} onChange={setPeriodEnd} disabled={!canEditDoc} placeholder="Pilih bulan akhir" />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="content-card info-card print-section">
        <div className="doc-header">
          <div className="doc-meta">
            <div><strong>Area:</strong><span>{areaName || '-'}</span></div>
            <div><strong>Cabang:</strong><span>{branchName || '-'}</span></div>
            <div><strong>Jabatan:</strong><span>SPV</span></div>
            <div><strong>Nama Pejabat:</strong><span>{spvName || '-'}</span></div>
            <div><strong>Bulan:</strong><span>{periodLabel || '-'}</span></div>
          </div>
        </div>

        {golonganRows.length ? (
          <GolonganTable
            rows={golonganRows}
            onUpdate={() => {}}
            onRemove={() => {}}
            onJenisChange={() => {}}
            onAdd={() => {}}
            onReorder={() => {}}
            canEdit={false}
            salesDivisi={null}
            setSalesDivisi={() => {}}
            divisions={masterData?.divisions || []}
            brands={masterData?.brands || []}
            principals={masterData?.principals || []}
          />
        ) : (
          <div className="empty-state">
            <strong>{positionId ? 'Belum ada dokumen sales Final di rentang ini' : 'Pilih SPV dan rentang bulan'}</strong>
            <p>{positionId
              ? 'Tidak ada dokumen sales Final di bawah SPV ini pada rentang terpilih.'
              : 'Baris golongan dan kriteria muncul otomatis begitu SPV dan rentang bulan dipilih.'}</p>
          </div>
        )}

        <KriteriaTable
          rows={criteriaRows}
          onUpdate={updateCriteriaRow}
          canEdit={false}
          incentiveEditable={canEditDoc}
          totalEditable={canEditDoc}
          totalOverride={insentifTotal}
          onTotalChange={setInsentifTotal}
        />

        <div className="kwitansi-card">
          <h3><u>KWITANSI</u></h3>
          <div className="kwitansi-grid">
            <div className="kw-row"><label>Sudah terima dari :</label>{isSuper ? (
              <ComboSelect
                value={kwitansi.penerima}
                onChange={(v) => setKwitansi({ ...kwitansi, penerima: v })}
                options={(masterData?.branches || []).filter((b) => b.is_active !== 0 && b.active !== 0).map((b) => ({ value: b.name }))}
                placeholder="Pilih cabang..."
                disabled={!canEditDoc}
                emptyHint="Belum ada cabang."
              />
            ) : <span>{kwitansi.penerima}</span>}</div>
            <div className="kw-row"><label>Jumlah Uang</label><input value={kwitansi.jumlahUang} onChange={(e) => setKwitansi({ ...kwitansi, jumlahUang: e.target.value })} disabled={!canEditDoc} /></div>
            <div className="kw-row"><label>Buat Pembayaran</label><input value={kwitansi.keterangan} onChange={(e) => setKwitansi({ ...kwitansi, keterangan: e.target.value })} disabled={!canEditDoc} /></div>
            <div className="kw-row"><label>Terbilang Rp.</label><input value={kwitansi.nominal} onChange={(e) => setKwitansi({ ...kwitansi, nominal: e.target.value, terbilang: terbilang(e.target.value.replace(/[^\d-]/g, '') || insentifTotal || 0) })} disabled={!canEditDoc} /></div>
          </div>
          <div className="kw-sign">
            <span className="sig-name">{(spvName || '-').toUpperCase()}</span>
            <span className="sig-role">SPV</span>
          </div>
          <div className="kw-total">
            <span>Total Keseluruhan</span>
            <strong>Rp {Number(totalInsenitif || 0).toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </section>

      <footer className="action-bar">
        <div className="autosave"><span className="save-dot" />{saved ? 'Tersimpan' : 'Belum disimpan'}</div>
        <div className="actions">
          <Button className="button secondary" onClick={reset}>Batal</Button>
          <Button className="button primary" onClick={save} disabled={!canEditDoc || saving}>
            <Icon size={17}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>
            {documentId ? 'Simpan Perubahan' : 'Simpan'}
          </Button>
          {canFinalize && <Button className="button secondary" onClick={submit}>Finalisasi</Button>}
        </div>
      </footer>

      {/* History Modal */}
      {historyOpen && historyData !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeHistory}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-title"
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
              <h2 id="history-title" className="text-[16px] font-semibold text-[var(--ink)]">
                Riwayat Dokumen
              </h2>
              <button
                className="p-2 rounded-lg hover:bg-[var(--line-soft)] text-[var(--ink-2)] transition-colors"
                onClick={closeHistory}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {historyLoading ? (
                <div className="flex justify-center py-8 text-[var(--ink-2)]">
                  <span className="animate-spin">⏳</span> Memuat riwayat...
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8 text-[var(--ink-2)]">
                  <p>Belum ada riwayat untuk dokumen ini.</p>
                  <p className="text-[13px] mt-1">Dokumen lama sebelum sistem audit aktif tidak memiliki riwayat.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--line)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--ink)]">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--primary-soft)] text-[var(--primary)]">
                              {item.action}
                            </span>
                            <span className="text-[var(--ink-2)]">oleh</span>
                            <span className="font-semibold">{item.actor_name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--ink-soft)] text-[var(--ink-2)]">
                              {item.actor_role}
                            </span>
                          </div>
                          <div className="mt-2 text-[12px] text-[var(--ink-2)]">
                            {new Date(item.created_at).toLocaleString('id-ID', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
