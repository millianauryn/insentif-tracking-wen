import { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import { fromApiPeriod } from '../lib/period';
import { listHierarchy } from '../api';

function KpiCard({ icon, label, value, helper, tone }) {
  const icons = { chart: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>, target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></>, trend: <path d="m4 16 5-5 3 3 7-8M15 6h4v4"/>, document: <><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/></> };
  return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon>{icons[icon]}</Icon></div><div className="kpi-body"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div><span className={`kpi-trend ${tone}`}>●</span></article>;
}

const PERIOD_OPTIONS = ['Oktober 2026', 'November 2026', 'Desember 2026'];

function TreeNode({ label, role, count, open, onToggle, depth }) {
  const depthClass = depth === 0 ? 'bg-slate-50/70' : depth === 1 ? 'bg-white hover:bg-slate-50' : 'hover:bg-slate-50';
  return (
    <button onClick={onToggle} className={`flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left ${depthClass}`}>
      <span className={`text-[11px] font-bold uppercase tracking-wide ${depth === 0 ? 'text-blue-600' : depth === 1 ? 'text-emerald-600' : 'text-ink-500'}`}>{role}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink-900">{label}</span>
      <span className="hidden whitespace-nowrap text-[11.5px] text-ink-400 sm:inline">{count} dokumen</span>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-ink-400 ${open ? 'bg-ink-900 text-white' : 'bg-slate-100'}`}>
        {open ? <Icon size={12}><path d="M5 12h14"/></Icon> : <Icon size={12}><path d="M12 5v14M5 12h14"/></Icon>}
      </span>
    </button>
  );
}

function DocRow({ doc, onClick }) {
  const statusColor = doc.status === 'Final' ? 'text-emerald-600' : 'text-slate-400';
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 hover:bg-slate-50 cursor-pointer" onClick={onClick}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold leading-none text-ink-900">{doc.salesman || 'Tanpa nama'}</p>
        <p className="mt-0.5 truncate text-[10.5px] text-ink-400">{fromApiPeriod(doc.period)} · {doc.product || ''}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`whitespace-nowrap text-[11.5px] font-bold ${statusColor}`}>{doc.status}</span>
        <button className="icon-button" onClick={(e) => { e.stopPropagation(); onClick?.(); }}><Icon size="15"><path d="M4 5h16v14H4z"/><path d="M8 10h8M8 14h5"/></Icon></button>
      </div>
    </div>
  );
}

export default function Dashboard({ documents, user, period, setPeriod, onNewDoc, onLoadDoc }) {
  const [open, setOpen] = useState({});
  const [hierarchy, setHierarchy] = useState(null);

  useEffect(() => {
    listHierarchy()
      .then(setHierarchy)
      .catch(() => setHierarchy({ chain: [], subordinates: [] }));
  }, []);

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));


  // Build visible user set: current user's chain + their subordinates
  const visibleUserIds = new Set();
  const chainUsers = hierarchy?.chain || [];
  const subordinateUsers = hierarchy?.subordinates || [];
  chainUsers.forEach((u) => visibleUserIds.add(u.id));
  subordinateUsers.forEach((u) => visibleUserIds.add(u.id));
  // If no hierarchy data, show all documents (superadmin default)
  const showAll = user.role === 'superadmin' || visibleUserIds.size === 0;
  const visibleDocs = showAll ? documents : documents.filter((d) => visibleUserIds.has(d.owner_id));

  // Build tree: group visible docs by salesman
  const bySalesman = visibleDocs.reduce((acc, doc) => {
    const sm = doc.salesman || 'Tanpa Nama';
    if (!acc[sm]) acc[sm] = [];
    acc[sm].push(doc);
    return acc;
  }, {});

  // For hierarchy display: build from chain + subordinates
  // chain = [BM, SPV, Sales...] walking up parent_id from current user
  // subordinates = all users reporting to anyone in chain
  const allUsers = [...chainUsers, ...subordinateUsers];
  const rootUser = chainUsers[0] || null; // BM (top of chain)
  // BM's direct reports = subordinates whose parent_id = BM.id
  const bmReports = rootUser ? allUsers.filter((u) => u.parent_id === rootUser.id) : [];
  // For each BM report (SPV), their direct reports = Sales
  const getReports = (parentId) => allUsers.filter((u) => u.parent_id === parentId);

  const totalDocs = visibleDocs.length;
  const draftCount = visibleDocs.filter((d) => d.status === 'Draft').length;
  const finalCount = visibleDocs.filter((d) => d.status === 'Final').length;

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">OVERVIEW / INSENTIF SALES</p>
          <h1>Selamat datang, {user.username}</h1>
          <p className="subtitle">Pantau performa penjualan dan dokumen insentif dalam satu tampilan.</p>
        </div>
        <div className="topbar-actions">
          <label className="period-control">Periode<select value={period} onChange={(event) => setPeriod(event.target.value)}>{PERIOD_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
        </div>
      </header>
      <div className="dashboard-toolbar">
        <div><h2>Ringkasan Performa</h2><p>Data pencapaian periode {period}</p></div>
        <button className="button primary" onClick={onNewDoc} disabled={user.role === 'observer'}><Icon size={17}><path d="M12 5v14M5 12h14"/></Icon>Tambah Dokumen</button>
      </div>
      <section className="kpi-grid">
        <KpiCard icon="chart" label="Total Dokumen" value={totalDocs.toString().padStart(2, '0')} helper="Dokumen tersimpan" tone="blue" />
        <KpiCard icon="target" label="Draft" value={draftCount} helper="Belum dikirim" tone="purple" />
        <KpiCard icon="trend" label="Final" value={finalCount} helper="Sudah disetujui" tone="green" />
        <KpiCard icon="document" label="Total Sales" value={(bmReports.length + bmReports.reduce((sum, spv) => sum + getReports(spv.id).length, 0)).toString().padStart(2, '0')} helper="Sales aktif" tone="orange" />
      </section>

      {/* Hierarchy tree: BM → SPV → Sales */}
      <section className="content-card info-card">
        <div className="section-heading">
          <div className="section-icon orange"><Icon><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h4"/></Icon></div>
          <div><h2>Struktur Organisasi</h2><p>BM → SPV → Sales</p></div>
        </div>
        <div className="space-y-1">
          {rootUser ? (
            // Hierarchy mode: BM → SPV → Sales from chain + subordinates
            <div>
              <TreeNode label={rootUser.username} role="BM" count={visibleDocs.filter((d) => d.owner_id === rootUser.id).length} open={open[`bm:${rootUser.id}`]} onToggle={() => toggle(`bm:${rootUser.id}`)} depth={0} />
              {open[`bm:${rootUser.id}`] && (
                <div className="px-3 py-1 space-y-1">
                  {visibleDocs.filter((d) => d.owner_id === rootUser.id).map((doc) => <DocRow key={doc.id} doc={doc} onClick={() => onLoadDoc?.(doc)} />)}
                  {bmReports.map((spv) => (
                    <div key={spv.id}>
                      <TreeNode label={spv.username} role="SPV" count={visibleDocs.filter((d) => d.owner_id === spv.id).length} open={open[`spv:${spv.id}`]} onToggle={() => toggle(`spv:${spv.id}`)} depth={1} />
                      {open[`spv:${spv.id}`] && (
                        <div className="px-6 py-1 space-y-1">
                          {visibleDocs.filter((d) => d.owner_id === spv.id).map((doc) => <DocRow key={doc.id} doc={doc} onClick={() => onLoadDoc?.(doc)} />)}
                          {getReports(spv.id).map((sales) => (
                            <div key={sales.id}>
                              <TreeNode label={sales.username} role="Sales" count={visibleDocs.filter((d) => d.owner_id === sales.id).length} open={open[`sales:${sales.id}`]} onToggle={() => toggle(`sales:${sales.id}`)} depth={2} />
                              {open[`sales:${sales.id}`] && (
                                <div className="px-9 py-1 space-y-1">
                                  {visibleDocs.filter((d) => d.owner_id === sales.id).map((doc) => <DocRow key={doc.id} doc={doc} onClick={() => onLoadDoc?.(doc)} />)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Fallback: no hierarchy set up yet, show by salesman
            Object.entries(bySalesman).map(([salesman, docs]) => {
              const smOpen = open[`bm:${salesman}`];
              return (
                <div key={salesman}>
                  <TreeNode label={salesman} role="BM" count={docs.length} open={smOpen} onToggle={() => toggle(`bm:${salesman}`)} depth={0} />
                  {smOpen && (
                    <div className="px-3 py-1 space-y-1">
                      {docs.map((doc) => <DocRow key={doc.id} doc={doc} onClick={() => onLoadDoc?.(doc)} />)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {totalDocs === 0 && <p className="subtitle text-center py-8">Belum ada dokumen. Klik "Tambah Dokumen" untuk mulai.</p>}
      </section>
    </>
  );
}
