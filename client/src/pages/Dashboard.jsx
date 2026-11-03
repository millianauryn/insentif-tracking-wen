import { useState } from 'react';
import Icon from '../components/Icon';
import { fromApiPeriod } from '../lib/period';

function KpiCard({ icon, label, value, helper, tone }) {
  const icons = { chart: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>, target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></>, trend: <path d="m4 16 5-5 3 3 7-8M15 6h4v4"/>, document: <><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/></> };
  return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon>{icons[icon]}</Icon></div><div className="kpi-body"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div><span className={`kpi-trend ${tone}`}>●</span></article>;
}

const PERIOD_OPTIONS = ['Oktober 2026', 'November 2026', 'Desember 2026'];

// Tree: BM (Salesman) -> SPV -> Document (Sales)
function TreeNode({ label, count, amount, open, onToggle, depth }) {
  return (
    <div className={depth === 0 ? 'overflow-hidden rounded-xl border border-slate-200 bg-white' : ''}>
      <button onClick={onToggle} className={`flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left ${depth === 0 ? 'bg-slate-50/70' : 'hover:bg-slate-50'}`}>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink-900">{label}</span>
        <span className="hidden whitespace-nowrap text-[11.5px] text-ink-400 sm:inline">{count} dokumen · Rp {amount}</span>
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-ink-400 ${open ? 'bg-ink-900 text-white' : 'bg-slate-100'}`}>
          {open ? <Icon size={12}><path d="M5 12h14"/></Icon> : <Icon size={12}><path d="M12 5v14M5 12h14"/></Icon>}
        </span>
      </button>
    </div>
  );
}

function DocRow({ doc }) {
  const statusColor = doc.status === 'Final' ? 'text-emerald-600' : 'text-slate-400';
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 hover:bg-slate-50">
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { }}>
        <p className="truncate text-[12.5px] font-bold leading-none text-ink-900">{doc.salesman || 'Tanpa nama'}</p>
        <p className="mt-0.5 truncate text-[10.5px] text-ink-400">{fromApiPeriod(doc.period)} · {doc.status}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`whitespace-nowrap text-[11.5px] font-bold ${statusColor}`}>{doc.status}</span>
        <button className="icon-button" onClick={(e) => { e.stopPropagation(); }}><Icon size="15"><path d="M4 5h16v14H4z"/><path d="M8 10h8M8 14h5"/></Icon></button>
      </div>
    </div>
  );
}

export default function Dashboard({ documents, user, period, setPeriod, onNewDoc }) {
  const [open, setOpen] = useState({});

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // Tree: BM (Salesman) -> SPV -> Documents
  const bySalesman = documents.reduce((acc, doc) => {
    const sm = doc.salesman || 'Tanpa Nama';
    if (!acc[sm]) acc[sm] = [];
    acc[sm].push(doc);
    return acc;
  }, {});

  const totalDocs = documents.length;

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
        <KpiCard icon="target" label="Draft" value={documents.filter((d) => d.status === 'Draft').length} helper="Belum dikirim" tone="purple" />
        <KpiCard icon="trend" label="Final" value={documents.filter((d) => d.status === 'Final').length} helper="Sudah disetujui" tone="green" />
        <KpiCard icon="document" label="Total Sales" value={documents.length.toString().padStart(2, '0')} helper="Dokumen tersimpan" tone="orange" />
      </section>
      <section className="content-card info-card">
        <div className="section-heading">
          <div className="section-icon orange"><Icon><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h4"/></Icon></div>
          <div><h2>Hierarki Dokumen</h2><p>BM (Salesman) → Dokumen (Sales)</p></div>
        </div>
        <div className="space-y-1">
          {Object.entries(bySalesman).map(([salesman, docs]) => {
            const salesmanOpen = open[`bm:${salesman}`];
            return (
              <div key={salesman}>
                <TreeNode label={salesman} count={docs.length} amount={docs.length} open={salesmanOpen} onToggle={() => toggle(`bm:${salesman}`)} depth={0} />
                {salesmanOpen && (
                  <div className="px-3 py-1.5 space-y-1">
                    {docs.map((doc) => <DocRow key={doc.id} doc={doc} canEdit={user.role !== 'observer'} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {totalDocs === 0 && <p className="subtitle text-center py-8">Belum ada dokumen. Klik "Tambah Dokumen" untuk mulai.</p>}
      </section>
    </>
  );
}
