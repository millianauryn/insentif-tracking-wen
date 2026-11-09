import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { fromApiPeriod } from '../lib/period';
import { errMsg, finalizeDocument, getDocument } from '../api';
import ListPager from '../components/ListPager';
import { Search, ChevronLeft, ChevronRight, Plus, Loader2, FolderOpen, RotateCcw } from 'lucide-react';

const fmtNum = (n) => (n === null || n === undefined || n === '' ? '-' : Number(n).toLocaleString('id-ID'));
const pctOf = (a, t) => (Number(t) > 0 ? (Number(a) / Number(t)) * 100 : 0);
const ketOf = (a, t) => (Number(t) > 0 && pctOf(a, t) >= 100 ? 'Tercapai' : Number(t) > 0 ? 'Gugur' : '');

function isDivisiLabel(label) {
  return String(label || '').toUpperCase().startsWith('DIVISI:');
}
function isTotalDivisiLabel(label) {
  return String(label || '').toUpperCase().startsWith('TOTALDIVISI:');
}
function displayLabel(label) {
  if (isDivisiLabel(label)) return label.slice(7);
  if (isTotalDivisiLabel(label)) return `TOTAL DIVISI ${label.slice(12)}`.trim();
  return label || '';
}

function FullDocPreview({ doc }) {
  const golongan = doc.golongan_rows || [];
  const kriteria = doc.criteria_rows || [];
  const sumInsentif = kriteria.reduce((s, r) => s + (Number(r.incentive_amount) || 0), 0);
  const totalInsentif = doc.insentif_total ?? sumInsentif;
  const kw = doc.kwitansi || {};
  const tujuan = kw.keterangan || kw.jumlahUang || (doc.period ? `Incentive penjualan bulan ${fromApiPeriod(doc.period)}` : '');
  return (
    <div className="space-y-5 text-[13px]">
      <div className="text-center border border-[var(--line)] rounded-lg px-3 py-3 bg-[#fbfdfc]">
        <p className="font-bold tracking-wide text-[14px]">PERHITUNGAN INSENTIF</p>
        <p className="mt-1">WILAYAH : {doc.wilayah || '-'}</p>
        <p>SALESMAN : {doc.salesman || '-'}</p>
        <p>PRODUK : {doc.product || '-'}</p>
        <p>BULAN : {fromApiPeriod(doc.period)}</p>
      </div>

      <div className="border border-[var(--line)] rounded-lg overflow-hidden">
        <table className="w-full table-fixed text-[10.5px] leading-[1.25]">
          <colgroup><col className="w-[28%]" /><col className="w-[17%]" /><col className="w-[23%]" /><col className="w-[16%]" /><col className="w-[16%]" /></colgroup>
          <thead>
            <tr className="bg-[#e8eef3] text-left">
              <th className="border border-[var(--line)] px-1 py-0.5 break-words">GOLONGAN</th>
              <th className="border border-[var(--line)] px-1 py-0.5 text-right break-words">TARGET</th>
              <th className="border border-[var(--line)] px-1 py-0.5 text-right break-words">TERCAPAI</th>
              <th className="border border-[var(--line)] px-1 py-0.5 text-right break-words">(%)</th>
              <th className="border border-[var(--line)] px-1 py-0.5 break-words">KET</th>
            </tr>
          </thead>
          <tbody>
            {golongan.map((r) => {
              const label = displayLabel(r.label);
              const divisiRow = isDivisiLabel(r.label);
              const groupRow = !!r.is_group || isTotalDivisiLabel(r.label);
              const pct = pctOf(r.achievement, r.target);
              const ket = ketOf(r.achievement, r.target);
              if (divisiRow) {
                return <tr key={r.id} className="bg-[#f3e2c7] font-bold"><td colSpan={5} className="border border-[var(--line)] px-1.5 py-1 text-center">{label}</td></tr>;
              }
              return (
                <tr key={r.id} className={groupRow ? 'font-bold bg-[#f0f4f8]' : ''}>
                  <td className="border border-[var(--line)] px-1 py-0.5 break-words">{label}</td>
                  <td className="border border-[var(--line)] px-1.5 py-1 text-right whitespace-nowrap">{fmtNum(r.target)}</td>
                  <td className="border border-[var(--line)] px-1.5 py-1 text-right whitespace-nowrap">{fmtNum(r.achievement)}</td>
                  <td className="border border-[var(--line)] px-1.5 py-1 text-right whitespace-nowrap">{Number(r.target) > 0 ? `${pct.toFixed(0)}%` : ''}</td>
                  <td className="border border-[var(--line)] px-1.5 py-1 whitespace-nowrap">{ket}</td>
                </tr>
              );
            })}
            {!golongan.length && <tr><td colSpan={5} className="border border-[var(--line)] px-1.5 py-2 text-center text-[var(--ink-3)]">Golongan kosong.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="border border-[var(--line)] rounded-lg overflow-hidden">
        <table className="w-full table-fixed text-[10.5px] leading-[1.25]">
          <colgroup><col className="w-[28%]" /><col className="w-[12%]" /><col className="w-[19%]" /><col className="w-[9%]" /><col className="w-[13%]" /><col className="w-[19%]" /></colgroup>
          <thead>
            <tr className="bg-[#e8eef3] text-left">
              <th className="border border-[var(--line)] px-1 py-0.5 break-words">KRITERIA</th>
              <th className="border border-[var(--line)] px-1 py-0.5 text-right break-words">TARGET</th>
              <th className="border border-[var(--line)] px-1 py-0.5 text-right break-words">TERCAPAI</th>
              <th className="border border-[var(--line)] px-1 py-0.5 text-right break-words">%</th>
              <th className="border border-[var(--line)] px-1 py-0.5 break-words">KET</th>
              <th className="border border-[var(--line)] px-1 py-0.5 text-right break-words">INSENTIF YG DIBERI</th>
            </tr>
          </thead>
          <tbody>
            {kriteria.map((r) => {
              const pct = pctOf(r.achievement_value, r.target_value);
              const ket = ketOf(r.achievement_value, r.target_value);
              return (
                <tr key={r.criteria_id || r.id}>
                  <td className="border border-[var(--line)] px-1 py-0.5 break-words">- {r.label}</td>
                  <td className="border border-[var(--line)] px-1 py-0.5 text-right whitespace-nowrap">{fmtNum(r.target_value)}</td>
                  <td className="border border-[var(--line)] px-1 py-0.5 text-right whitespace-nowrap">{fmtNum(r.achievement_value)}</td>
                  <td className="border border-[var(--line)] px-1 py-0.5 text-right whitespace-nowrap">{Number(r.target_value) > 0 ? `${pct.toFixed(0)}%` : r.percentage_value != null && r.percentage_value !== '' ? `${Number(r.percentage_value).toFixed(1)}%` : ''}</td>
                  <td className="border border-[var(--line)] px-1 py-0.5 whitespace-nowrap">{ket}</td>
                  <td className="border border-[var(--line)] px-1 py-0.5 text-right whitespace-nowrap">{fmtNum(r.incentive_amount)}</td>
                </tr>
              );
            })}
            {!kriteria.length && <tr><td colSpan={6} className="border border-[var(--line)] px-1.5 py-2 text-center text-[var(--ink-3)]">Kriteria kosong.</td></tr>}
            <tr className="font-bold bg-[#f0f4f8]">
              <td className="border border-[var(--line)] px-1 py-0.5">TOTAL</td>
              <td className="border border-[var(--line)]" colSpan={4} />
              <td className="border border-[var(--line)] px-1 py-0.5 text-right whitespace-nowrap">{fmtNum(totalInsentif)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="border border-[var(--line)] rounded-lg px-4 py-3">
        <p className="text-center font-bold underline mb-3">KWITANSI</p>
        <div className="space-y-2">
          <p><span className="inline-block w-40 text-[var(--ink-3)]">Sudah terima dari :</span> {kw.penerima || 'PT. BINTANG SINAR JAYA'}</p>
          <p><span className="inline-block w-40 text-[var(--ink-3)]">Jumlah Uang</span> {tujuan}</p>
          <p><span className="inline-block w-40 text-[var(--ink-3)]">Buat Pembayaran</span> {tujuan}</p>
          <p><span className="inline-block w-40 text-[var(--ink-3)]">Terbilang Rp.</span> <strong>{Number(totalInsentif) !== 0 ? fmtNum(totalInsentif) : '-'}</strong></p>
        </div>
        <div className="mt-6 text-right">
          <p className="font-bold uppercase">{doc.salesman || '-'}</p>
          <p className="text-[var(--ink-3)] text-[11px] uppercase">Salesman</p>
        </div>
      </div>
    </div>
  );
}

const childrenOf = (positions, id) => positions.filter((p) => p.parent_position_id === id);
const descendantsOf = (positions, id) => {
  const out = [];
  const walk = (parentId) => childrenOf(positions, parentId).forEach((c) => { out.push(c); walk(c.id); });
  walk(id);
  return out;
};
const parentOf = (positions, p) => positions.find((x) => x.id === p.parent_position_id);

const PERIOD_LABELS = {
  '2026-10': 'Oktober 2026',
  '2026-11': 'November 2026',
  '2026-12': 'Desember 2026',
};

function periodLabel(key) {
  return PERIOD_LABELS[key] || key;
}

function makeBadge(status) {
  if (String(status).toLowerCase() === 'final') {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1.5 px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-700" aria-hidden="true" />
        Final
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-700" aria-hidden="true" />
      Draft
    </Badge>
  );
}

export default function Insetif({ documents, setDocuments, onRefresh, positions = [], onLoad, onDelete, onNewDoc }) {
  const toast = useToast();
  // Map nama -> posisi: lookup per baris O(1), bukan find O(n) tiap render.
  const positionByName = useMemo(() => new Map(positions.map((p) => [p.name, p])), [positions]);
  const { user } = useAuth();
  const canFinalize = ['observer', 'superadmin'].includes(user?.role);
  const isDraft = (s) => String(s).toLowerCase() !== 'final';
  const [searchParams] = useSearchParams();
  const nameParam = searchParams.get('name') || '';
  const openDocParam = searchParams.get('openDoc') || '';

  const [search, setSearch] = useState(nameParam);
  const [bmId, setBmId] = useState('');
  const [spvId, setSpvId] = useState('');
  const [salesId, setSalesId] = useState('');
  const [periode, setPeriode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [activeDocId, setActiveDocId] = useState(null);
  const [fullDoc, setFullDoc] = useState(null);
  const [fullLoading, setFullLoading] = useState(false);

  const listRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    if (!nameParam || !positions.length) return;
    const target = positions.find((p) => p.name === nameParam);
    if (!target) return;
    if (target.position_type === 'BM') {
      setBmId(String(target.id));
    } else if (target.position_type === 'SPV') {
      setSpvId(String(target.id));
      const bm = parentOf(positions, target);
      if (bm) setBmId(String(bm.id));
    } else {
      setSalesId(String(target.id));
      const spv = parentOf(positions, target);
      if (spv) {
        setSpvId(String(spv.id));
        const bm = parentOf(positions, spv);
        if (bm) setBmId(String(bm.id));
      }
    }
  }, [nameParam, positions]);

  // Open detail panel for a doc clicked from Dashboard (?openDoc=<id>).
  useEffect(() => {
    if (!openDocParam || !documents.length) return;
    if (documents.some((d) => String(d.id) === openDocParam)) {
      setActiveDocId(openDocParam);
    }
  }, [openDocParam, documents]);

  // Klik nama sales → tabel muncul + navbar ciut otomatis.
  useEffect(() => {
    if (activeDocId) window.dispatchEvent(new Event('insetif-narrow'));
    else window.dispatchEvent(new Event('insetif-expand'));
  }, [activeDocId]);

  // Ambil baris golongan/kriteria/kwitansi agar panel detail menampilkan input officer.
  useEffect(() => {
    if (!activeDocId) {
      setFullDoc(null);
      return;
    }
    let cancelled = false;
    setFullLoading(true);
    getDocument(activeDocId)
      .then((r) => { if (!cancelled) setFullDoc(r.document); })
      .catch(() => { if (!cancelled) setFullDoc(null); })
      .finally(() => { if (!cancelled) setFullLoading(false); });
    return () => { cancelled = true; };
  }, [activeDocId]);

  const bms = positions.filter((p) => p.position_type === 'BM');
  const spvOptions = bmId
    ? childrenOf(positions, Number(bmId)).filter((p) => p.position_type === 'SPV')
    : positions.filter((p) => p.position_type === 'SPV');
  const salesScope = spvId
    ? childrenOf(positions, Number(spvId))
    : bmId
      ? descendantsOf(positions, Number(bmId))
      : positions;
  const salesOptions = salesScope.filter((p) => p.position_type === 'SALES');

  const periodeOptions = useMemo(
    () => [...new Set(documents.map((d) => d.period).filter(Boolean))].sort().reverse(),
    [documents],
  );

  const visibleDocs = useMemo(() => {
    let rows = documents;
    if (salesId) {
      const s = positions.find((p) => p.id === Number(salesId));
      if (s) rows = rows.filter((d) => d.salesman === s.name);
    } else if (spvId) {
      const names = childrenOf(positions, Number(spvId)).map((p) => p.name);
      rows = rows.filter((d) => names.includes(d.salesman));
    } else if (bmId) {
      const names = descendantsOf(positions, Number(bmId)).map((p) => p.name);
      rows = rows.filter((d) => names.includes(d.salesman));
    }
    if (periode) rows = rows.filter((d) => d.period === periode);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((d) =>
        `${d.salesman || ''} ${d.product || ''} ${fromApiPeriod(d.period)}`.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [documents, positions, salesId, spvId, bmId, periode, search]);

  // Kembali ke halaman 1 saat pencarian atau filter berubah.
  useEffect(() => { setPage(1); }, [search, bmId, spvId, salesId, periode]);

  // Jika hasil filter menyusut (mis. dokumen dihapus), turunkan halaman ke posisi valid.
  useEffect(() => {
    const tp = Math.ceil(visibleDocs.length / limit) || 1;
    if (page > tp) setPage(tp);
  }, [visibleDocs.length, limit, page]);

  const paginatedDocs = useMemo(() => {
    const start = (page - 1) * limit;
    return visibleDocs.slice(start, start + limit);
  }, [visibleDocs, page, limit]);

  const totalPages = Math.ceil(visibleDocs.length / limit) || 1;

  const refreshList = async () => {
    setRefreshing(true);
    try {
      const { documents: next } = await onRefresh();
      setDocuments(next);
      toast('success', 'Daftar dokumen dimuat ulang.');
    } catch (err) {
      toast('error', errMsg(err));
    } finally {
      setRefreshing(false);
    }
  };

  const activeDoc = documents.find((d) => d.id === activeDocId);
  const canEditDoc = !!activeDoc && isDraft(activeDoc.status) && ['officer', 'superadmin'].includes(user?.role);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Desktop: two-column layout */}
      <div className={`hidden lg:grid lg:gap-6 lg:px-6 lg:py-6 ${activeDoc ? 'lg:grid-cols-[360px_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)]'}`}>
        {/* Left: Document List */}
        <section
          className={`card min-w-0 bg-white border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden ${
            !activeDoc ? 'lg:col-span-2' : ''
          }`}
          aria-label="Daftar dokumen"
        >
          {/* Filters */}
          <div className="p-6 border-b border-[var(--line)]" role="search" aria-label="Filter dokumen">
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <label htmlFor="q" className="sr-only">Cari dokumen</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)]" aria-hidden="true" />
                  <Input
                    id="q"
                    type="search"
                    placeholder="Cari sales, produk, periode..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-3 h-10"
                    style={{ paddingLeft: 44 }}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label htmlFor="filter-bm" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">BM</label>
                  <Select value={bmId} onValueChange={(v) => { setBmId(v); setSpvId(''); setSalesId(''); }}>
                    <SelectTrigger id="filter-bm" className="h-10 w-full">
                      <SelectValue placeholder="Semua BM">{bmId ? bms.find((p) => String(p.id) === bmId)?.name : 'Semua BM'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua BM</SelectItem>
                      {bms.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="filter-spv" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">SPV</label>
                  <Select value={spvId} onValueChange={(v) => { setSpvId(v); setSalesId(''); }}>
                    <SelectTrigger id="filter-spv" className="h-10 w-full">
                      <SelectValue placeholder="Semua SPV">{spvId ? spvOptions.find((p) => String(p.id) === spvId)?.name : 'Semua SPV'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua SPV</SelectItem>
                      {spvOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="filter-sales" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">Sales</label>
                  <Select value={salesId} onValueChange={setSalesId}>
                    <SelectTrigger id="filter-sales" className="h-10 w-full">
                      <SelectValue placeholder="Semua sales">{salesId ? salesOptions.find((p) => String(p.id) === salesId)?.name : 'Semua sales'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua sales</SelectItem>
                      {salesOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="filter-periode" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">Periode</label>
                  <Select value={periode} onValueChange={setPeriode}>
                    <SelectTrigger id="filter-periode" className="h-10 w-full">
                      <SelectValue placeholder="Semua periode">{periode ? periodLabel(periode) : 'Semua periode'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua periode</SelectItem>
                      {periodeOptions.map((key) => (
                        <SelectItem key={key} value={key}>{periodLabel(key)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Document List */}
          <div className="p-0" ref={listRef}>
            {visibleDocs.length > 0 ? (
              <div className="flex flex-col divide-y divide-[var(--line)]" id="docList" aria-label="Daftar dokumen tersimpan" role="list">
                {paginatedDocs.map((doc) => {
                  const isSelected = doc.id === activeDocId;
                  const pos = positionByName.get(doc.salesman);
                  return (
                    <div
                      key={doc.id}
                      role="listitem"
                      className={`group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[var(--primary-soft)] ring-inset ring-2 ring-[var(--primary)]'
                          : 'hover:bg-[var(--bg)]'
                      }`}
                      onClick={() => setActiveDocId((cur) => (cur === doc.id ? null : doc.id))}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveDocId((cur) => (cur === doc.id ? null : doc.id)); }}}
                      tabIndex={0}
                      aria-current={isSelected ? 'true' : undefined}
                      aria-label={`Buka dokumen ${doc.salesman || 'Tanpa nama sales'}, periode ${periodLabel(doc.period)}, status ${String(doc.status).toLowerCase() === 'final' ? 'Final' : 'Draft'}`}
                    >
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="flex-1 min-w-0 font-medium text-[13px] leading-[1.3] text-[var(--ink)] truncate group-hover:text-[var(--primary)] transition-colors">
                            {doc.salesman || 'Tanpa nama sales'}
                          </p>
                          <p className="shrink-0 text-[12px] text-[var(--ink-2)] whitespace-nowrap">{periodLabel(doc.period)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          {pos ? (
                            <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${pos.position_type === 'BM' ? 'bg-blue-100 text-blue-700' : pos.position_type === 'SPV' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{pos.position_type}</span>
                          ) : <span />}
                          <div className="shrink-0">{makeBadge(doc.status)}</div>
                        </div>
                      </div>
                      <ChevronRight className="shrink-0 size-4 mt-1 text-[var(--ink-3)] group-hover:text-[var(--primary)] transition-colors" aria-hidden="true" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 border-t border-[var(--line)]">
                <FolderOpen className="size-11 text-[var(--ink-3)]" aria-hidden="true" />
                <h3 className="text-[15px] font-semibold text-[var(--ink)]">Tidak ada dokumen ditemukan</h3>
                <p className="text-[13px] text-[var(--ink-2)] text-center max-w-[340px] leading-[1.55]">
                  Coba ubah kata kunci pencarian atau filter yang dipilih untuk melihat dokumen lain.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setBmId(''); setSpvId(''); setSalesId(''); setPeriode(''); }}>
                  Hapus semua filter
                </Button>
              </div>
            )}
            {visibleDocs.length > 0 && (
              <div className="p-4 border-t border-[var(--line)]">
                <ListPager
                  page={page}
                  pages={totalPages}
                  total={visibleDocs.length}
                  limit={limit}
                  onPage={setPage}
                  onLimit={setLimit}
                />
              </div>
            )}
          </div>
        </section>

        {/* Right: Detail Panel (muncul setelah dokumen dibuka) */}
        {activeDoc && (
          <aside className="card min-w-0 bg-white border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col" aria-label="Halaman detail dokumen" ref={detailRef}>
          {activeDoc ? (
            <>
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--line)] bg-[var(--bg)]">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => { window.dispatchEvent(new Event('insetif-expand')); setActiveDocId(null); }}
                  className="gap-1.5 h-8 px-3"
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  <span>Kembali</span>
                </Button>
                <p className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-[var(--ink-3)]">Detail dokumen</p>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <header className="flex items-start gap-4 mb-6">
                  <span className="flex shrink-0 items-center justify-center size-11 rounded-[12px] bg-[var(--primary-soft)] text-[var(--primary)]" aria-hidden="true">
                    <FolderOpen className="size-5.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-[var(--ink-3)]">Dokumen penjualan</p>
                    <h2 id="detailHeading" className="mt-1 text-[clamp(20px,2.4vw,24px)] font-bold tracking-[-0.02em] leading-[1.25] overflow-wrap-anywhere">
                      {activeDoc.salesman || 'Tanpa nama sales'}
                    </h2>
                    <p className="mt-1 text-[13px] text-[var(--ink-2)]">{periodLabel(activeDoc.period)}</p>
                  </div>
                  <div className="flex-shrink-0 mt-1">{makeBadge(activeDoc.status)}</div>
                </header>

                <section className="border-t border-[var(--line)] pt-5 mt-6" aria-labelledby="detailInfoTitle">
                  <h3 id="detailInfoTitle" className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-[var(--ink-3)] mb-4">
                    Pratinjau dokumen (input officer)
                  </h3>
                  {fullLoading ? (
                    <p className="text-[13px] text-[var(--ink-2)] flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat isi dokumen…</p>
                  ) : fullDoc ? (
                    <FullDocPreview doc={fullDoc} />
                  ) : (
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-4 mt-4">
                      <div className="col-span-2">
                        <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">Produk</dt>
                        <dd className="mt-1 text-[14px] font-medium text-[var(--ink)] overflow-wrap-anywhere">{activeDoc.product || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">Periode</dt>
                        <dd className="mt-1 text-[14px] font-medium text-[var(--ink)]">{periodLabel(activeDoc.period)}</dd>
                      </div>
                    </dl>
                  )}
                </section>

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-[var(--line)]">
                  {canEditDoc && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => onLoad?.(activeDoc)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="bg-white text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          if (!window.confirm(`Hapus dokumen ${activeDoc.salesman || activeDoc.id} periode ${periodLabel(activeDoc.period)}?`)) return;
                          onDelete?.(activeDocId);
                          window.dispatchEvent(new Event('insetif-expand'));
                        }}
                      >
                        Hapus
                      </Button>
                    </>
                  )}
                  {canFinalize && String(activeDoc.status).toLowerCase() !== 'final' && (
                    <Button
                      variant="default"
                      size="sm"
                      type="button"
                      onClick={async () => {
                        try {
                          const result = await finalizeDocument(activeDocId);
                          setDocuments((prev) => prev.map((d) => d.id === result.document.id ? { ...d, status: result.document.status } : d));
                          toast('success', 'Dokumen ditandai sebagai final.');
                        } catch (err) {
                          toast('error', errMsg(err));
                        }
                      }}
                    >
                      Tandai Final
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
              <span className="flex items-center justify-center size-13 rounded-[14px] bg-[var(--line-soft)] text-[var(--ink-3)] mb-3" aria-hidden="true">
                <FolderOpen className="size-6" />
              </span>
              <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Belum ada dokumen dipilih</h2>
              <p className="mt-1 text-[13px] text-[var(--ink-2)] max-w-[320px] leading-[1.6]">
                Klik <strong className="text-[var(--ink)] font-semibold">Buka</strong> pada salah satu dokumen di daftar untuk menampilkan halamannya di sini.
              </p>
            </div>
          )}
        </aside>
        )}
      </div>

      {/* Mobile: Single column with detail overlay */}
      <div className="lg:hidden pb-20 px-4 py-4">
        <section className="card bg-white border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden" aria-labelledby="page-title-mobile">
          <div className="flex flex-col items-start justify-between gap-3 p-4 border-b border-[var(--line)]">
            <div>
              <h1 id="page-title-mobile" className="text-[clamp(19px,2.2vw,22px)] font-bold tracking-[-0.015em] leading-[1.3]">
                Dokumen Tersimpan
              </h1>
              <p className="mt-1 text-[13px] text-[var(--ink-2)] leading-[1.5]">
                Cari, filter, dan buka dokumen lama untuk dilanjutkan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={refreshList}
                disabled={refreshing}
                className="flex-1 gap-1.5 h-9 justify-center"
              >
                {refreshing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Memuat...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    <span>Muat Ulang</span>
                  </>
                )}
              </Button>
              <Button
                variant="default"
                size="sm"
                type="button"
                onClick={onNewDoc}
                className="flex-1 gap-1.5 h-9 justify-center"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>Dokumen Baru</span>
              </Button>
            </div>
          </div>

          {/* Filters Mobile */}
          <div className="p-4 border-b border-[var(--line)]" role="search" aria-label="Filter dokumen">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="q-m" className="sr-only">Cari dokumen</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)]" aria-hidden="true" />
                  <Input
                    id="q-m"
                    type="search"
                    placeholder="Cari sales, produk, periode..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-3 h-10"
                    style={{ paddingLeft: 44 }}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="filter-bm-m" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">BM</label>
                <Select value={bmId} onValueChange={(v) => { setBmId(v); setSpvId(''); setSalesId(''); }}>
                  <SelectTrigger id="filter-bm-m" className="h-10 w-full">
                    <SelectValue placeholder="Semua BM">{bmId ? bms.find((p) => String(p.id) === bmId)?.name : 'Semua BM'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua BM</SelectItem>
                    {bms.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="filter-spv-m" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">SPV</label>
                  <Select value={spvId} onValueChange={(v) => { setSpvId(v); setSalesId(''); }}>
                    <SelectTrigger id="filter-spv-m" className="h-10 w-full">
                      <SelectValue placeholder="Semua SPV">{spvId ? spvOptions.find((p) => String(p.id) === spvId)?.name : 'Semua SPV'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua SPV</SelectItem>
                      {spvOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="filter-sales-m" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">Sales</label>
                  <Select value={salesId} onValueChange={setSalesId}>
                    <SelectTrigger id="filter-sales-m" className="h-10 w-full">
                      <SelectValue placeholder="Semua sales">{salesId ? salesOptions.find((p) => String(p.id) === salesId)?.name : 'Semua sales'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua sales</SelectItem>
                      {salesOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label htmlFor="filter-periode-m" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">Periode</label>
                <Select value={periode} onValueChange={setPeriode}>
                  <SelectTrigger id="filter-periode-m" className="h-10 w-full">
                    <SelectValue placeholder="Semua periode">{periode ? periodLabel(periode) : 'Semua periode'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua periode</SelectItem>
                    {periodeOptions.map((key) => (
                      <SelectItem key={key} value={key}>{periodLabel(key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Document List Mobile */}
          <div className="p-0">
            {visibleDocs.length > 0 ? (
              <div className="flex flex-col gap-2 px-3 pb-4" id="docList" aria-label="Daftar dokumen tersimpan" role="list">
                {paginatedDocs.map((doc) => {
                  const isSelected = doc.id === activeDocId;
                  const pos = positionByName.get(doc.salesman);
                  return (
                    <article
                      key={doc.id}
                      role="listitem"
                      className={`relative flex flex-col p-3 bg-white border border-[var(--line)] rounded-[var(--radius)] transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-[var(--primary)] shadow-[var(--shadow-md)] bg-[var(--primary-soft)]'
                          : 'hover:ring-[var(--primary)]/50 hover:shadow-[var(--shadow-md)]'
                      }`}
                      onClick={() => setActiveDocId((cur) => (cur === doc.id ? null : doc.id))}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveDocId((cur) => (cur === doc.id ? null : doc.id)); }}}
                      tabIndex={0}
                      aria-current={isSelected ? 'true' : undefined}
                      aria-label={`Buka dokumen ${doc.salesman || 'Tanpa nama sales'}, periode ${periodLabel(doc.period)}, status ${String(doc.status).toLowerCase() === 'final' ? 'Final' : 'Draft'}`}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <p className="flex-1 min-w-0 font-semibold text-[14px] text-[var(--ink)] truncate hover:text-[var(--primary)] transition-colors">
                          {doc.salesman || 'Tanpa nama sales'}
                        </p>
                        <p className="shrink-0 text-[12px] text-[var(--ink-2)] whitespace-nowrap">{periodLabel(doc.period)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {pos ? (
                          <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${pos.position_type === 'BM' ? 'bg-blue-100 text-blue-700' : pos.position_type === 'SPV' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{pos.position_type}</span>
                        ) : <span />}
                        <div className="flex-shrink-0">{makeBadge(doc.status)}</div>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--line-soft)]">
                        <span className="text-[12px] font-medium text-[var(--link)] hover:underline transition-colors">
                          Buka detail
                        </span>
                        <ChevronRight className="size-4 text-[var(--ink-3)] hover:text-[var(--primary)] transition-colors" aria-hidden="true" />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 border-t border-[var(--line)]">
                <FolderOpen className="size-11 text-[var(--ink-3)]" aria-hidden="true" />
                <h3 className="text-[15px] font-semibold text-[var(--ink)]">Tidak ada dokumen ditemukan</h3>
                <p className="text-[13px] text-[var(--ink-2)] text-center max-w-[340px] leading-[1.55]">
                  Coba ubah kata kunci pencarian atau filter yang dipilih untuk melihat dokumen lain.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setBmId(''); setSpvId(''); setSalesId(''); setPeriode(''); }}>
                  Hapus semua filter
                </Button>
              </div>
            )}
            {visibleDocs.length > 0 && (
              <div className="p-4 border-t border-[var(--line)]">
                <ListPager
                  page={page}
                  pages={totalPages}
                  total={visibleDocs.length}
                  limit={limit}
                  onPage={setPage}
                  onLimit={setLimit}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Mobile Detail Overlay */}
      {activeDoc && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-detail-heading"
        >
          <div className="p-4 pb-20">
            <div className="card bg-white border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col h-full min-h-[calc(100vh-32px)]">
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[var(--line)] bg-[var(--bg)] sticky top-0 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => { window.dispatchEvent(new Event('insetif-expand')); setActiveDocId(null); }}
                  className="gap-1.5 h-9 px-3 min-h-[44px]"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  <span>Kembali</span>
                </Button>
                <p className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-[var(--ink-3)]">Detail dokumen</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <header className="flex items-start gap-3 mb-5">
                  <span className="flex shrink-0 items-center justify-center size-11 rounded-[12px] bg-[var(--primary-soft)] text-[var(--primary)]" aria-hidden="true">
                    <FolderOpen className="size-5.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-[var(--ink-3)]">Dokumen penjualan</p>
                    <h2 id="mobile-detail-heading" className="mt-1 text-[clamp(20px,2.4vw,24px)] font-bold tracking-[-0.02em] leading-[1.25] overflow-wrap-anywhere">
                      {activeDoc.salesman || 'Tanpa nama sales'}
                    </h2>
                    <p className="mt-1 text-[13px] text-[var(--ink-2)]">{periodLabel(activeDoc.period)}</p>
                  </div>
                  <div className="flex-shrink-0 mt-1">{makeBadge(activeDoc.status)}</div>
                </header>

                <section className="border-t border-[var(--line)] pt-4 mt-5" aria-labelledby="detailInfoTitleMobile">
                  <h3 id="detailInfoTitleMobile" className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-[var(--ink-3)] mb-4">
                    Pratinjau dokumen (input officer)
                  </h3>
                  {fullLoading ? (
                    <p className="text-[13px] text-[var(--ink-2)]">Memuat isi dokumen…</p>
                  ) : fullDoc ? (
                    <FullDocPreview doc={fullDoc} />
                  ) : null}
                </section>

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-[var(--line)]">
                  {canEditDoc && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => onLoad?.(activeDoc)}
                        className="min-h-[44px]"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="min-h-[44px] bg-white text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          if (!window.confirm(`Hapus dokumen ${activeDoc.salesman || activeDoc.id} periode ${periodLabel(activeDoc.period)}?`)) return;
                          onDelete?.(activeDocId);
                          window.dispatchEvent(new Event('insetif-expand'));
                        }}
                      >
                        Hapus
                      </Button>
                    </>
                  )}
                  {canFinalize && String(activeDoc.status).toLowerCase() !== 'final' && (
                    <Button
                      variant="default"
                      size="sm"
                      type="button"
                      onClick={async () => {
                        try {
                          const result = await finalizeDocument(activeDocId);
                          setDocuments((prev) => prev.map((d) => d.id === result.document.id ? { ...d, status: result.document.status } : d));
                          toast('success', 'Dokumen ditandai sebagai final.');
                          setActiveDocId(null);
                        } catch (err) {
                          toast('error', errMsg(err));
                        }
                      }}
                      className="min-h-[44px]"
                    >
                      Tandai Final
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
