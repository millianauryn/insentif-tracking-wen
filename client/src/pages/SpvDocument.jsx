import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import Icon from '../components/Icon';
import ComboSelect from '../components/ComboSelect';
import { useToast } from '../components/Toast';
import { GolonganTable, KriteriaTable } from './Documents';
import { createDocument, updateDocument, finalizeDocument, getDocument, previewSpvRows, errMsg } from '../api';
import { terbilang } from '../lib/terbilang';
import { toApiPeriod, fromApiPeriod, monthNames, currentPeriodLabel, periodRangeLabel } from '../lib/period';

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
    incentive_amount: '',
  }));
}

// Memilih bulan dari daftar -> lengkapi dengan tahun; ketik bebas -> teks mentah.
function pickMonth(value, picked, current) {
  if (!picked) return value;
  const year = /(\d{4})$/.exec(current || '')?.[1] || String(new Date().getFullYear());
  return `${value} ${year}`;
}

export default function SpvDocument({ user, positions, masterData, setDocuments, documentFormatId, loadTargetId, onLoadDone }) {
  const toast = useToast();
  const isSuper = user.role === 'superadmin';
  const [documentId, setDocumentId] = useState(null);
  const [documentStatus, setDocumentStatus] = useState('Draft');
  const [positionId, setPositionId] = useState('');
  const [periodStart, setPeriodStart] = useState(currentPeriodLabel());
  const [periodEnd, setPeriodEnd] = useState(currentPeriodLabel());
  const [golonganRows, setGolonganRows] = useState([]);
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [insentifTotal, setInsentifTotal] = useState(null);
  const [kwitansi, setKwitansi] = useState(EMPTY_KWITANSI);
  const [savedWilayah, setSavedWilayah] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEditDoc = ['officer', 'superadmin'].includes(user.role) && documentStatus === 'Draft';
  const canFinalize = ['observer', 'superadmin'].includes(user.role) && documentStatus === 'Draft' && !!documentId;

  const spvOptions = useMemo(() => positions.filter((p) => p.position_type === 'SPV' && p.active !== 0
    && (isSuper || (p.branch_ids || []).some((id) => (user.branch_ids || []).includes(id)))),
    [positions, isSuper, user.branch_ids]);

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
          setCriteriaRows(toCriteriaRows(data.criteria_rows || []));
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
    insentif_total: insentifTotal,
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
          <h1>Rekap Insentif SPV</h1>
          <p>Akumulasi insentif sales di bawah SPV untuk periode terpilih.</p>
        </div>
        <div className="page-head-actions">
          <Button className="button secondary" type="button" onClick={() => window.print()}>
            <Icon size={15}><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5h20v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></Icon>
            Cetak
          </Button>
          <Button className="button primary" type="button" onClick={save} disabled={!canEditDoc || saving}>
            {documentId ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
          {canFinalize && <Button className="button secondary" type="button" onClick={submit}>Finalisasi</Button>}
        </div>
      </div>

      <section className="content-card info-card">
        <div className="form-grid">
          <label className="block">
            SPV
            <ComboSelect
              value={spvName}
              onChange={(v) => { const hit = spvOptions.find((p) => p.name === v); setPositionId(hit ? String(hit.id) : ''); }}
              options={spvOptions.map((p) => ({ value: p.name, hint: p.sales_code || '' }))}
              placeholder="Pilih SPV..."
              disabled={!canEditDoc}
              emptyHint="Tidak ada SPV di cabang Anda."
            />
          </label>
          <label className="block">
            Bulan Mulai
            <ComboSelect
              value={periodStart}
              onChange={(v, picked) => setPeriodStart(pickMonth(v, picked, periodStart))}
              options={monthNames().map((m) => ({ value: m }))}
              placeholder="Pilih bulan, ketik tahunnya..."
              disabled={!canEditDoc}
              emptyHint="Tidak ada bulan cocok."
            />
          </label>
          <label className="block">
            Bulan Akhir
            <ComboSelect
              value={periodEnd}
              onChange={(v, picked) => setPeriodEnd(pickMonth(v, picked, periodEnd))}
              options={monthNames().map((m) => ({ value: m }))}
              placeholder="Pilih bulan, ketik tahunnya..."
              disabled={!canEditDoc}
              emptyHint="Tidak ada bulan cocok."
            />
          </label>
          <label className="block">
            Wilayah (Kota)
            <input value={wilayah} readOnly disabled />
          </label>
        </div>
      </section>

      <section className="content-card info-card print-section">
        <div className="doc-header">
          <div className="doc-meta">
            <div><strong>Wilayah:</strong><span>{wilayah || '-'}</span></div>
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
          onUpdate={() => {}}
          canEdit={false}
          totalEditable={canEditDoc}
          totalOverride={insentifTotal}
          onTotalChange={setInsentifTotal}
        />

        <div className="kwitansi-card">
          <h3><u>KWITANSI</u></h3>
          <div className="kwitansi-grid">
            <div className="kw-row"><label>Sudah terima dari :</label><span>{kwitansi.penerima}</span></div>
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
            <strong>Rp {Number(insentifTotal || 0).toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </section>

      <footer className="action-bar">
        <div className="autosave"><span className="save-dot" />{saved ? 'Draft tersimpan' : 'Draft belum disimpan'}</div>
        <div className="actions">
          <Button className="button secondary" onClick={reset}>Batal</Button>
          <Button className="button primary" onClick={save} disabled={!canEditDoc || saving}>
            {documentId ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
          {canFinalize && <Button className="button secondary" onClick={submit}>Finalisasi</Button>}
        </div>
      </footer>
    </>
  );
}
