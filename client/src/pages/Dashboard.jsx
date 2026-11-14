import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Search } from 'lucide-react';
import { Button, buttonVariants } from '../components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { cn } from 'cn';
import Icon from '../components/Icon';
import { branchRegionIds, cityOf, filterBranches, buildOrgTree, pruneTree, countPositions } from '../lib/orgTree';

function EmptyState({ title, copy }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

// Lama kerja: "1 tahun 2 bulan 30 hari (20 Mei 2000)"
function tenureLabel(joinDate) {
  if (!joinDate) return '–';
  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime())) return '–';
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  years = Math.max(0, years);
  months = Math.max(0, months);
  days = Math.max(0, days);
  const dateStr = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${years} tahun ${months} bulan ${days} hari (${dateStr})`;
}

// Satu simpul tree: area / wilayah / cabang / position.
// Barisnya bisa diklik untuk buka/tutup (tanpa harus klik ikon kecil).
function TreeNode({ node, depth, expanded, onToggle, documentsFinal }) {
  const kids = node.children || [];
  const open = expanded.has(node.key);
  const isPosition = node.kind === 'position';
  const p = node.position;
  const docFinal = isPosition ? (documentsFinal[p.name] || 0) : 0;
  const displayName = isPosition && p.position_type === 'SALES' && p.sales_code
    ? `${p.sales_code} ${p.name}`
    : node.label;
  const toggleable = kids.length > 0;

  const rowProps = toggleable
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-expanded': open,
        onClick: () => onToggle(node.key),
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(node.key);
          }
        },
      }
    : {};

  return (
    <div className="org-node">
      <div className={`org-row${toggleable ? ' is-toggle' : ''}`} {...rowProps}>
        <span className="org-role">{isPosition ? p.position_type : node.badge}</span>
        {isPosition ? (
          <Link className="org-name" to={`/insetif?name=${encodeURIComponent(p.name)}`}>{displayName}</Link>
        ) : (
          <span className="org-name">{displayName}</span>
        )}
        {isPosition && <span className="org-tenure">{tenureLabel(p.join_date)}</span>}
        {toggleable && (
          <span className={`org-toggle${open ? ' open' : ''}`} aria-hidden="true">
            {open ? <Minus size={13} /> : <Plus size={13} />}
          </span>
        )}
      </div>
      {isPosition && (
        <div className="org-summary">
          <span className="org-summary-item">Insentif yang diterima: <span className="org-summary-value">{docFinal}</span></span>
        </div>
      )}
      {toggleable && open && (
        <div className="org-children">
          {kids.map((child) => (
            <TreeNode
              key={child.key}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              documentsFinal={documentsFinal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ documents = [], user, positions = [], users = [], masterData = {}, onNewDoc }) {
  // expanded kosong = semua tertutup secara default (lihat gambar referensi).
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [areaId, setAreaId] = useState('');
  const [city, setCity] = useState('');
  const [branchId, setBranchId] = useState('');

  const toggleNode = (key) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const activePositions = useMemo(() => positions.filter((p) => p.active !== 0), [positions]);
  const regions = useMemo(() => (masterData.regions || []).filter((r) => r.is_active !== 0), [masterData.regions]);
  const branches = useMemo(() => (masterData.branches || []).filter((b) => b.is_active !== 0), [masterData.branches]);

  // Pilihan dropdown berjenjang: area → wilayah → cabang.
  const areaBranches = useMemo(
    () => (areaId ? branches.filter((b) => branchRegionIds(b).includes(Number(areaId))) : branches),
    [branches, areaId],
  );
  const cityOptions = useMemo(() => [...new Set(areaBranches.map(cityOf))].sort(), [areaBranches]);
  const branchOptions = useMemo(
    () => (city ? areaBranches.filter((b) => cityOf(b) === city) : areaBranches),
    [areaBranches, city],
  );

  // Pool cabang setelah ketiga filter diterapkan (AND).
  const branchPool = useMemo(
    () => filterBranches(branches, { areaId, city, branchId }),
    [branches, areaId, city, branchId],
  );

  // Susun tree: area -> wilayah -> cabang -> jabatan user (BM -> SPV -> SALES).
  const fullTree = useMemo(
    () => buildOrgTree({ regions, branches: branchPool, positions: activePositions }),
    [regions, branchPool, activePositions],
  );

  // Pencarian menyaring tree; aturannya di lib/orgTree.js (pruneTree).
  const prunedTree = useMemo(() => pruneTree(fullTree, query), [fullTree, query]);
  const totalSales = countPositions(prunedTree, "SALES");

  const documentsFinal = useMemo(() => {
    const counts = {};
    documents.forEach((d) => {
      if (String(d.status).toLowerCase() === 'final') counts[d.salesman] = (counts[d.salesman] || 0) + 1;
    });
    return counts;
  }, [documents]);

  const hasFilter = Boolean(query.trim() || areaId || city || branchId);

  // Base UI Select.Value menampilkan nilai mentah (id) kecuali `items` diberikan.
  const areaItems = useMemo(() => Object.fromEntries(regions.map((r) => [String(r.id), r.name])), [regions]);
  const branchItems = useMemo(() => Object.fromEntries(branchOptions.map((b) => [String(b.id), b.name])), [branchOptions]);

  return (
    <>
      <div className="page-head">
        <div className="page-head-copy">
          <h1>Dashboard</h1>
          <p>Ringkasan dokumen dan struktur tim insentif.</p>
        </div>
        <div className="page-head-actions">
          <Link className={cn(buttonVariants({ variant: 'outline' }), 'h-9 px-4')} to="/insetif">Lihat semua dokumen</Link>
          <Button onClick={onNewDoc} disabled={user?.role === 'observer'} className="h-9 px-4">
            <Icon size={16}><path d="M12 5v14M5 12h14" /></Icon>Tambah Dokumen
          </Button>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <article className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Struktur Jabatan</h2>
              </div>
              <span className="card-note">{totalSales} sales</span>
            </div>

            {/* Filter berjenjang + pencarian */}
            <div className="flex flex-col gap-3 mb-4">
              {/* Ikon jadi sibling flex, bukan absolute — teks placeholder tidak pernah tertimpa. */}
              <div className="dash-search flex h-8 items-center gap-2 rounded-lg border border-input px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <Search size={15} className="shrink-0 text-[var(--ink-3)]" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari area, wilayah, cabang, atau nama jabatan..."
                  className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                  aria-label="Cari struktur jabatan"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="dash-area" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">Area</label>
                  <Select value={areaId} items={areaItems} onValueChange={(v) => { setAreaId(v); setCity(''); setBranchId(''); }}>
                    <SelectTrigger id="dash-area" className="h-10 w-full"><SelectValue placeholder="Semua area" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua area</SelectItem>
                      {regions.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="dash-wilayah" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">Wilayah</label>
                  <Select value={city} onValueChange={(v) => { setCity(v); setBranchId(''); }}>
                    <SelectTrigger id="dash-wilayah" className="h-10 w-full"><SelectValue placeholder="Semua wilayah" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua wilayah</SelectItem>
                      {cityOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="dash-cabang" className="block text-[12px] font-medium text-[var(--ink-2)] mb-1">Cabang / Distributor</label>
                  <Select value={branchId} items={branchItems} onValueChange={setBranchId}>
                    <SelectTrigger id="dash-cabang" className="h-10 w-full"><SelectValue placeholder="Semua cabang" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Semua cabang</SelectItem>
                      {branchOptions.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {prunedTree.length ? (
              <div className="org-tree">
                {prunedTree.map((node) => (
                  <TreeNode
                    key={node.key}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggleNode}
                    documentsFinal={documentsFinal}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={hasFilter ? 'Tidak ada yang cocok' : 'Belum ada data jabatan'}
                copy={hasFilter ? 'Ubah kata kunci atau filter yang dipilih.' : 'Tambah jabatan BM, SPV, dan sales di Data Master.'}
              />
            )}
          </article>
        </div>
      </div>
    </>
  );
}
