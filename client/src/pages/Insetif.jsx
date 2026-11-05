import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/Toast';
import { fromApiPeriod } from '../lib/period';
import { errMsg } from '../lib/api';
import { listPositions } from '../api';
import { Search, ChevronLeft, ChevronRight, Plus, Loader2, X, FolderOpen, RotateCcw } from 'lucide-react';

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
  if (status === 'final') {
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

export default function Insetif({ documents, setDocuments, onRefresh, onLoad, onNewDoc }) {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const nameParam = searchParams.get('name') || '';

  const [search, setSearch] = useState(nameParam);
  const [positions, setPositions] = useState([]);
  const [bmId, setBmId] = useState('');
  const [spvId, setSpvId] = useState('');
  const [salesId, setSalesId] = useState('');
  const [periode, setPeriode] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [activeDocId, setActiveDocId] = useState(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newFormData, setNewFormData] = useState({
    sales: '',
    product: '',
    bm: 'Andi Pratama',
    spv: 'Budi Santoso',
    period: '2026-11',
    status: 'draft',
  });
  const [newFormErrors, setNewFormErrors] = useState({});

  const listRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    listPositions().then((r) => setPositions(r.positions || [])).catch(() => setPositions([]));
  }, []);

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

  const handleNewDocSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!newFormData.sales.trim()) errors.sales = 'Nama sales wajib diisi.';
    if (!newFormData.product.trim()) errors.product = 'Nama produk wajib diisi.';
    if (Object.keys(errors).length) {
      setNewFormErrors(errors);
      return;
    }
    const doc = {
      id: Date.now(),
      sales: newFormData.sales.trim(),
      product: newFormData.product.trim(),
      bm: newFormData.bm,
      spv: newFormData.spv,
      period: newFormData.period,
      status: newFormData.status,
    };
    setDocuments((prev) => [doc, ...prev]);
    setNewDialogOpen(false);
    setNewFormData({ sales: '', product: '', bm: 'Andi Pratama', spv: 'Budi Santoso', period: '2026-11', status: 'draft' });
    setNewFormErrors({});
    toast('success', 'Dokumen baru berhasil ditambahkan.');
  };

  const validateField = (name) => {
    if (name === 'sales' && !newFormData.sales.trim()) return 'Nama sales wajib diisi.';
    if (name === 'product' && !newFormData.product.trim()) return 'Nama produk wajib diisi.';
    return '';
  };

  const activeDoc = documents.find((d) => d.id === activeDocId);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Desktop: two-column layout */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_480px] lg:gap-6 lg:px-6 lg:py-6">
        {/* Left: Document List */}
        <section className="card bg-white border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden" aria-labelledby="page-title">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-6 border-b border-[var(--line)]">
            <div className="min-w-0">
              <h1 id="page-title" className="text-[clamp(19px,2.2vw,22px)] font-bold tracking-[-0.015em] leading-[1.3]">
                Dokumen Tersimpan
              </h1>
              <p className="mt-1 text-[13px] text-[var(--ink-2)] leading-[1.5]">
                Cari, filter, dan buka dokumen lama untuk dilanjutkan.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="p-6 border-b border-[var(--line)]" role="search" aria-label="Filter dokumen">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2 lg:col-span-1 min-w-0">
                <label htmlFor="q" className="sr-only">Cari dokumen</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)]" aria-hidden="true" />
                  <Input
                    id="q"
                    type="search"
                    placeholder="Cari sales, produk, periode..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-3 h-10"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="filter-spv" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">SPV</label>
                <Select value={spvId} onValueChange={(v) => { setSpvId(v); setSalesId(''); }}>
                  <SelectTrigger id="filter-spv" className="h-10 w-full">
                    <SelectValue placeholder="Semua SPV" />
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
                    <SelectValue placeholder="Semua sales" />
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
                    <SelectValue placeholder="Semua periode" />
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

          {/* Document List */}
          <div className="p-0" ref={listRef}>
            {visibleDocs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3" id="docList" aria-label="Daftar dokumen tersimpan" role="list">
                {visibleDocs.map((doc) => {
                  const isSelected = doc.id === activeDocId;
                  return (
                    <article
                      key={doc.id}
                      role="listitem"
                      className={`group relative flex flex-col p-4 bg-white border border-[var(--line)] rounded-[var(--radius)] transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-[var(--primary)] shadow-[var(--shadow-md)] bg-[var(--primary-soft)]'
                          : 'hover:ring-[var(--primary)]/50 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5'
                      }`}
                      onClick={() => setActiveDocId(doc.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveDocId(doc.id); }}}
                      tabIndex={0}
                      aria-current={isSelected ? 'true' : undefined}
                      aria-label={`Buka dokumen ${doc.salesman || 'Tanpa nama sales'}, periode ${periodLabel(doc.period)}, status ${doc.status === 'final' ? 'Final' : 'Draft'}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[14px] text-[var(--ink)] truncate group-hover:text-[var(--primary)] transition-colors">
                            {doc.salesman || 'Tanpa nama sales'}
                          </p>
                          <p className="text-[12px] text-[var(--ink-2)] mt-0.5">{periodLabel(doc.period)}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {makeBadge(doc.status)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--line-soft)]">
                        <span className="text-[12px] font-medium text-[var(--link)] group-hover:underline transition-colors">
                          Buka detail
                        </span>
                        <ChevronRight className="size-4 text-[var(--ink-3)] group-hover:text-[var(--primary)] transition-colors" aria-hidden="true" />
                      </div>
                    </article>
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
          </div>
        </section>

        {/* Right: Detail Panel */}
        <aside className="card bg-white border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col" aria-label="Halaman detail dokumen" ref={detailRef}>
          {activeDoc ? (
            <>
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--line)] bg-[var(--bg)]">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setActiveDocId(null)}
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
                  <h3 id="detailInfoTitle" className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-[var(--ink-3)]">
                    Informasi dokumen
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-4 mt-4">
                    <div className="col-span-2">
                      <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">Produk</dt>
                      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)] overflow-wrap-anywhere">{activeDoc.product}</dd>
                    </div>
                    <div>
                      <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">BM</dt>
                      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)]">{activeDoc.bm}</dd>
                    </div>
                    <div>
                      <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">SPV</dt>
                      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)]">{activeDoc.spv}</dd>
                    </div>
                    <div>
                      <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">Periode</dt>
                      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)]">{periodLabel(activeDoc.period)}</dd>
                    </div>
                  </dl>
                </section>

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-[var(--line)]">
                  {activeDoc.status !== 'final' && (
                    <Button
                      variant="default"
                      size="sm"
                      type="button"
                      onClick={() => {
                        const idx = documents.findIndex((d) => d.id === activeDocId);
                        if (idx !== -1) {
                          const next = [...documents];
                          next[idx] = { ...next[idx], status: 'final' };
                          setDocuments(next);
                          toast('success', 'Dokumen ditandai sebagai final.');
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
                onClick={() => setNewDialogOpen(true)}
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
                    className="pl-10 pr-3 h-10"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="filter-spv-m" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">SPV</label>
                  <Select value={spvId} onValueChange={(v) => { setSpvId(v); setSalesId(''); }}>
                    <SelectTrigger id="filter-spv-m" className="h-10 w-full">
                      <SelectValue placeholder="Semua SPV" />
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
                      <SelectValue placeholder="Semua sales" />
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
                    <SelectValue placeholder="Semua periode" />
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
                {visibleDocs.map((doc) => {
                  const isSelected = doc.id === activeDocId;
                  return (
                    <article
                      key={doc.id}
                      role="listitem"
                      className={`relative flex flex-col p-3 bg-white border border-[var(--line)] rounded-[var(--radius)] transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-[var(--primary)] shadow-[var(--shadow-md)] bg-[var(--primary-soft)]'
                          : 'hover:ring-[var(--primary)]/50 hover:shadow-[var(--shadow-md)]'
                      }`}
                      onClick={() => setActiveDocId(doc.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveDocId(doc.id); }}}
                      tabIndex={0}
                      aria-current={isSelected ? 'true' : undefined}
                      aria-label={`Buka dokumen ${doc.salesman || 'Tanpa nama sales'}, periode ${periodLabel(doc.period)}, status ${doc.status === 'final' ? 'Final' : 'Draft'}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[14px] text-[var(--ink)] truncate hover:text-[var(--primary)] transition-colors">
                            {doc.salesman || 'Tanpa nama sales'}
                          </p>
                          <p className="text-[12px] text-[var(--ink-2)] mt-0.5">{periodLabel(doc.period)}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {makeBadge(doc.status)}
                        </div>
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
                  onClick={() => setActiveDocId(null)}
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
                  <h3 id="detailInfoTitleMobile" className="text-[11.5px] font-semibold tracking-[0.05em] uppercase text-[var(--ink-3)]">
                    Informasi dokumen
                  </h3>
                  <dl className="grid grid-cols-1 gap-4 mt-3">
                    <div>
                      <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">Produk</dt>
                      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)] overflow-wrap-anywhere">{activeDoc.product}</dd>
                    </div>
                    <div>
                      <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">BM</dt>
                      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)]">{activeDoc.bm}</dd>
                    </div>
                    <div>
                      <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">SPV</dt>
                      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)]">{activeDoc.spv}</dd>
                    </div>
                    <div>
                      <dt className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-3)]">Periode</dt>
                      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)]">{periodLabel(activeDoc.period)}</dd>
                    </div>
                  </dl>
                </section>

                <div className="flex flex-col gap-2 mt-8 pt-4 border-t border-[var(--line)]">
                  {activeDoc.status !== 'final' && (
                    <Button
                      variant="default"
                      size="sm"
                      type="button"
                      onClick={() => {
                        const idx = documents.findIndex((d) => d.id === activeDocId);
                        if (idx !== -1) {
                          const next = [...documents];
                          next[idx] = { ...next[idx], status: 'final' };
                          setDocuments(next);
                          toast('success', 'Dokumen ditandai sebagai final.');
                          setActiveDocId(null);
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

      {/* New Document Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-[560px] sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Dokumen Baru</DialogTitle>
            <DialogDescription>Isi detail dokumen penjualan yang ingin disimpan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNewDocSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 py-2">
              <div className="col-span-1">
                <label htmlFor="f-sales" className="block text-[12.5px] font-semibold text-[var(--ink)] mb-1">
                  Nama sales <span className="text-[var(--danger)] font-semibold" aria-hidden="true">*</span>
                </label>
                <Input
                  id="f-sales"
                  name="sales"
                  type="text"
                  placeholder="Contoh: Rina Kusuma"
                  value={newFormData.sales}
                  onChange={(e) => setNewFormData((prev) => ({ ...prev, sales: e.target.value }))}
                  onBlur={() => setNewFormErrors((prev) => ({ ...prev, sales: validateField('sales') }))}
                  className={`h-10 ${newFormErrors.sales ? 'border-[var(--danger)] focus-visible:ring-[var(--danger)]/40' : ''}`}
                  aria-invalid={newFormErrors.sales ? 'true' : 'false'}
                  aria-describedby={newFormErrors.sales ? 'f-sales-err' : undefined}
                  required
                  autoComplete="off"
                />
                {newFormErrors.sales && (
                  <p id="f-sales-err" className="mt-1 text-[12px] text-[var(--danger)]" role="alert">
                    {newFormErrors.sales}
                  </p>
                )}
              </div>
              <div className="col-span-1">
                <label htmlFor="f-product" className="block text-[12.5px] font-semibold text-[var(--ink)] mb-1">
                  Produk <span className="text-[var(--danger)] font-semibold" aria-hidden="true">*</span>
                </label>
                <Input
                  id="f-product"
                  name="product"
                  type="text"
                  placeholder="Contoh: Sabun Cair Refill 1L"
                  value={newFormData.product}
                  onChange={(e) => setNewFormData((prev) => ({ ...prev, product: e.target.value }))}
                  onBlur={() => setNewFormErrors((prev) => ({ ...prev, product: validateField('product') }))}
                  className={`h-10 ${newFormErrors.product ? 'border-[var(--danger)] focus-visible:ring-[var(--danger)]/40' : ''}`}
                  aria-invalid={newFormErrors.product ? 'true' : 'false'}
                  aria-describedby={newFormErrors.product ? 'f-product-err' : undefined}
                  required
                  autoComplete="off"
                />
                {newFormErrors.product && (
                  <p id="f-product-err" className="mt-1 text-[12px] text-[var(--danger)]" role="alert">
                    {newFormErrors.product}
                  </p>
                )}
              </div>
              <div className="col-span-1">
                <label htmlFor="f-bm" className="block text-[12.5px] font-semibold text-[var(--ink)] mb-1">BM</label>
                <Select value={newFormData.bm} onValueChange={(v) => setNewFormData((prev) => ({ ...prev, bm: v }))}>
                  <SelectTrigger id="f-bm" className="h-10 w-full">
                    <SelectValue placeholder="Pilih BM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Andi Pratama">Andi Pratama</SelectItem>
                    <SelectItem value="Sari Wijaya">Sari Wijaya</SelectItem>
                    <SelectItem value="Dimas Nugroho">Dimas Nugroho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <label htmlFor="f-spv" className="block text-[12.5px] font-semibold text-[var(--ink)] mb-1">SPV</label>
                <Select value={newFormData.spv} onValueChange={(v) => setNewFormData((prev) => ({ ...prev, spv: v }))}>
                  <SelectTrigger id="f-spv" className="h-10 w-full">
                    <SelectValue placeholder="Pilih SPV" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Budi Santoso">Budi Santoso</SelectItem>
                    <SelectItem value="Maya Kartika">Maya Kartika</SelectItem>
                    <SelectItem value="Rizky Hidayat">Rizky Hidayat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <label htmlFor="f-period" className="block text-[12.5px] font-semibold text-[var(--ink)] mb-1">Periode</label>
                <Select value={newFormData.period} onValueChange={(v) => setNewFormData((prev) => ({ ...prev, period: v }))}>
                  <SelectTrigger id="f-period" className="h-10 w-full">
                    <SelectValue placeholder="Pilih Periode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-10">Oktober 2026</SelectItem>
                    <SelectItem value="2026-11">November 2026</SelectItem>
                    <SelectItem value="2026-12">Desember 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <fieldset className="border-0 p-0 m-0 min-w-0">
                  <legend className="block text-[12.5px] font-semibold text-[var(--ink)] mb-2">Status</legend>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="draft"
                        checked={newFormData.status === 'draft'}
                        onChange={(e) => setNewFormData((prev) => ({ ...prev, status: e.target.value }))}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span className="text-[13px] font-medium text-[var(--ink)]">Draft</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="final"
                        checked={newFormData.status === 'final'}
                        onChange={(e) => setNewFormData((prev) => ({ ...prev, status: e.target.value }))}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span className="text-[13px] font-medium text-[var(--ink)]">Final</span>
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>Batal</Button>
              <Button type="submit" variant="default">Simpan dokumen</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}