import { useEffect, useMemo, useState } from 'react'
import {
  PRINCIPAL_OPTIONS,
  calculateRow,
  calculateTotals,
  createEmptyRow,
  getDashboardMetrics,
  loadRows,
  saveRows,
} from './incentive'
import './App.css'

const initialSales = {
  name: 'Rina Kusuma',
  branch: 'Cabang Jakarta Selatan',
  division: 'General Trade',
  period: 'Oktober 2026',
}

function Icon({ children, size = 18 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}

function App() {
  const [rows, setRows] = useState(() => loadRows())
  const [sales, setSales] = useState(initialSales)
  const [mode, setMode] = useState('table')
  const [view, setView] = useState('dashboard')
  const [period, setPeriod] = useState('Oktober 2026')
  const [saved, setSaved] = useState(false)
  const totals = useMemo(() => calculateTotals(rows), [rows])
  const metrics = useMemo(() => getDashboardMetrics(rows), [rows])

  useEffect(() => {
    saveRows(rows)
  }, [rows])

  const updateSales = (field, value) => setSales((current) => ({ ...current, [field]: value }))

  const updateRow = (id, field, value) => {
    setRows((current) => {
      const next = current.map((row) => row.id === id ? calculateRow({ ...row, [field]: value }) : row)
      const last = next[next.length - 1]
      if (last.principal && last.brand && !last.target && !last.achievement) next.push(createEmptyRow())
      return next
    })
    setSaved(false)
  }

  const removeRow = (id) => {
    setRows((current) => {
      const next = current.filter((row) => row.id !== id)
      return next.length ? next : [createEmptyRow()]
    })
    setSaved(false)
  }

  const saveDraft = () => {
    saveRows(rows)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2400)
  }

  const openDocument = () => setView('document')

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigate={setView} />
      <main className="main-content">
        {view === 'dashboard' ? <Dashboard metrics={metrics} rows={rows} period={period} onPeriodChange={setPeriod} onCreateDocument={openDocument} onOpenDocuments={openDocument} /> : <DocumentView sales={sales} updateSales={updateSales} rows={rows} mode={mode} setMode={setMode} updateRow={updateRow} removeRow={removeRow} totals={totals} saved={saved} saveDraft={saveDraft} onBack={() => setView('dashboard')} onReset={() => setRows(loadRows())} />}
      </main>
    </div>
  )
}

function Sidebar({ view, onNavigate }) {
  return <aside className="sidebar"><div className="brand-mark"><span>IT</span><div><strong>Incentive</strong><small>Tracking System</small></div></div><nav aria-label="Navigasi utama" className="nav-list"><button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}><Icon><path d="M4 13h5V4H4zM15 20h5v-9h-5zM4 20h5v-3H4zM15 8h5V4h-5z"/></Icon>Dashboard</button><button className={`nav-item ${view === 'document' ? 'active' : ''}`} onClick={() => onNavigate('document')}><Icon><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></Icon>Dokumen Insentif</button><button className="nav-item" disabled title="Belum tersedia"><Icon><circle cx="12" cy="8" r="3"/><path d="M5 20c.5-3.5 2.8-5 7-5s6.5 1.5 7 5"/></Icon>Master Sales</button><button className="nav-item" disabled title="Belum tersedia"><Icon><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3"/></Icon>Pengaturan</button></nav><div className="sidebar-footer"><span className="avatar">SA</span><div><strong>Super Admin</strong><small>Administrator</small></div><button aria-label="Buka menu akun" className="icon-button"><Icon><path d="m6 9 6 6 6-6"/></Icon></button></div></aside>
}

function Dashboard({ metrics, rows, period, onPeriodChange, onCreateDocument, onOpenDocuments }) {
  const hasData = metrics.documentCount > 0
  const maxValue = Math.max(...metrics.monthly.map((item) => Math.max(item.target, item.achievement)), 1)
  const recentRows = rows.filter((row) => row.principal && row.brand).slice(-4).reverse()

  return <><header className="dashboard-header"><div><p className="eyebrow">OVERVIEW / INSENTIF SALES</p><h1>Selamat datang, Admin</h1><p className="subtitle">Pantau performa penjualan dan dokumen insentif dalam satu tampilan.</p></div><div className="topbar-actions"><label className="period-control">Periode<select value={period} onChange={(event) => onPeriodChange(event.target.value)}><option>Oktober 2026</option><option>September 2026</option><option>Agustus 2026</option></select></label><button className="icon-button notification-button" aria-label="Notifikasi"><Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Icon><span/></button><span className="user-chip"><span className="avatar">SA</span><span><strong>Super Admin</strong><small>Administrator</small></span><Icon size={15}><path d="m6 9 6 6 6-6"/></Icon></span></div></header><div className="dashboard-toolbar"><div><h2>Ringkasan Performa</h2><p>Data pencapaian periode {period}</p></div><button className="button primary" onClick={onCreateDocument}><Icon size={17}><path d="M12 5v14M5 12h14"/></Icon>Buat Dokumen</button></div><section className="kpi-grid"><KpiCard icon="chart" label="Total Capaian" value={metrics.totalAchievement.toLocaleString('id-ID')} helper="Unit terealisasi" tone="blue"/><KpiCard icon="target" label="Total Target" value={metrics.totalTarget.toLocaleString('id-ID')} helper="Unit penjualan" tone="purple"/><KpiCard icon="trend" label="Tingkat Tercapai" value={`${metrics.percentage.toFixed(1)}%`} helper={metrics.percentage >= 100 ? 'Di atas target' : 'Perlu perhatian'} tone="green"/><KpiCard icon="document" label="Dokumen Sales" value={metrics.documentCount.toString().padStart(2, '0')} helper="Dokumen tersimpan" tone="orange"/></section><section className="dashboard-grid"><PerformanceChart metrics={metrics} maxValue={maxValue} hasData={hasData}/><StatusPanel metrics={metrics} hasData={hasData}/></section><section className="dashboard-grid lower-grid"><RecentDocuments rows={recentRows} hasData={hasData} onOpenDocuments={onOpenDocuments}/><QuickAction onCreateDocument={onCreateDocument}/></section></>
}

function KpiCard({ icon, label, value, helper, tone }) {
  const icons = { chart: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>, target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></>, trend: <path d="m4 16 5-5 3 3 7-8M15 6h4v4"/>, document: <><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/></> }
  return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon>{icons[icon]}</Icon></div><div className="kpi-body"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div><span className={`kpi-trend ${tone}`}>●</span></article>
}

function PerformanceChart({ metrics, maxValue, hasData }) {
  return <article className="dashboard-card chart-card"><div className="card-heading"><div><h2>Performa Penjualan</h2><p>Perbandingan target dan capaian</p></div><span className="chart-period">4 bulan terakhir <Icon size={14}><path d="m6 9 6 6 6-6"/></Icon></span></div>{hasData ? <div className="chart-area"><div className="chart-y-axis"><span>{maxValue.toLocaleString('id-ID')}</span><span>{Math.round(maxValue * .75).toLocaleString('id-ID')}</span><span>{Math.round(maxValue * .5).toLocaleString('id-ID')}</span><span>{Math.round(maxValue * .25).toLocaleString('id-ID')}</span><span>0</span></div><div className="bars-area"><div className="chart-grid-lines"><i/><i/><i/><i/><i/></div>{metrics.monthly.map((item) => <div className="bar-group" key={item.label}><div className="bar-pair"><span className="bar target" style={{ height: `${Math.max((item.target / maxValue) * 100, item.target ? 4 : 0)}%` }} title={`Target ${item.target}`}/><span className="bar achievement" style={{ height: `${Math.max((item.achievement / maxValue) * 100, item.achievement ? 4 : 0)}%` }} title={`Capaian ${item.achievement}`}/></div><small>{item.label}</small></div>)}</div></div> : <EmptyState compact title="Belum ada data performa" copy="Buat dokumen pertama untuk melihat grafik pencapaian."/>}<div className="chart-legend"><span><i className="legend-dot target"/>Target</span><span><i className="legend-dot achievement"/>Capaian</span></div></article>
}

function StatusPanel({ metrics, hasData }) {
  const total = metrics.achievedCount + metrics.failedCount
  const achievedRate = total ? (metrics.achievedCount / total) * 100 : 0
  return <article className="dashboard-card status-card"><div className="card-heading"><div><h2>Status Dokumen</h2><p>Ringkasan status pencapaian</p></div><button className="more-button" aria-label="Pilihan status"><Icon><path d="M12 6h.01M12 12h.01M12 18h.01"/></Icon></button></div>{hasData ? <><div className="status-visual"><div className="status-ring" style={{ '--progress': `${achievedRate}%` }}><div><strong>{Math.round(achievedRate)}%</strong><small>Tercapai</small></div></div><div className="status-list"><StatusLine label="Tercapai" value={metrics.achievedCount} tone="success"/><StatusLine label="Gugur" value={metrics.failedCount} tone="warning"/></div></div><div className="status-total"><span>Total dokumen</span><strong>{total}</strong></div></> : <EmptyState compact title="Belum ada dokumen" copy="Status akan muncul setelah input tersimpan."/>}</article>
}

function StatusLine({ label, value, tone }) {
  return <div className="status-line"><span><i className={`legend-dot ${tone}`}/>{label}</span><strong>{value.toString().padStart(2, '0')}</strong></div>
}

function RecentDocuments({ rows, hasData, onOpenDocuments }) {
  return <article className="dashboard-card recent-card"><div className="card-heading"><div><h2>Dokumen Terbaru</h2><p>Input insentif terakhir</p></div><button className="text-button" onClick={onOpenDocuments}>Lihat semua <Icon size={14}><path d="M5 12h14M13 6l6 6-6 6"/></Icon></button></div>{hasData ? <div className="recent-list">{rows.map((row) => <div className="recent-item" key={row.id}><span className="recent-avatar">{row.brand.slice(0, 2).toUpperCase()}</span><div><strong>{row.brand}</strong><small>{row.principal} · Sales</small></div><span className={`result-badge ${calculateRow(row).status === 'Tercapai' ? 'success' : 'warning'}`}>{calculateRow(row).status}</span></div>)}</div> : <EmptyState compact title="Belum ada dokumen terbaru" copy="Dokumen baru akan tampil di sini."/>}</article>
}

function QuickAction({ onCreateDocument }) {
  return <article className="quick-action"><div className="quick-art"><span/><span/><span/></div><div><span className="eyebrow">AKSI CEPAT</span><h2>Mulai pencatatan insentif</h2><p>Input target dan capaian sales untuk membuat dokumen baru.</p><button className="button light" onClick={onCreateDocument}>Input Sekarang <Icon size={15}><path d="M5 12h14M13 6l6 6-6 6"/></Icon></button></div></article>
}

function EmptyState({ title, copy, compact = false }) {
  return <div className={`empty-state ${compact ? 'compact' : ''}`} role="status"><div className="empty-icon"><Icon size={18}><path d="M4 5h16v14H4z"/><path d="M8 10h8M8 14h5"/></Icon></div><strong>{title}</strong><p>{copy}</p></div>
}

function DocumentView({ sales, updateSales, rows, mode, setMode, updateRow, removeRow, totals, saved, saveDraft, onBack, onReset }) {
  return <><header className="topbar document-header"><div><button className="back-button" onClick={onBack}><Icon size={15}><path d="m15 18-6-6 6-6"/></Icon>Kembali ke Dashboard</button><p className="eyebrow">DOKUMEN INSENTIF / SALES</p><h1>Input Insentif Sales</h1><p className="subtitle">Lengkapi pencapaian penjualan untuk periode berjalan.</p></div><div className="topbar-actions"><span className="role-chip"><span className="status-dot"/>Mode Super Admin</span><button className="icon-button" aria-label="Notifikasi"><Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Icon></button></div></header><section className="stepper" aria-label="Progress dokumen"><div className="step done"><span>1</span><div><strong>Informasi Dokumen</strong><small>Data sales dan periode</small></div></div><div className="step-line done"/><div className="step current"><span>2</span><div><strong>Data Pencapaian</strong><small>Target dan realisasi</small></div></div><div className="step-line"/><div className="step"><span>3</span><div><strong>Review</strong><small>Validasi dokumen</small></div></div></section><section className="content-card info-card"><div className="section-heading"><div className="section-icon blue"><Icon><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></Icon></div><div><h2>Informasi Dokumen</h2><p>Data dasar dokumen insentif sales.</p></div><span className="draft-badge">Draft</span></div><div className="form-grid"><label>Nama Sales<input value={sales.name} onChange={(e) => updateSales('name', e.target.value)} /></label><label>Cabang<select value={sales.branch} onChange={(e) => updateSales('branch', e.target.value)}><option>Cabang Jakarta Selatan</option><option>Cabang Jakarta Pusat</option><option>Cabang Bandung</option></select></label><label>Divisi<select value={sales.division} onChange={(e) => updateSales('division', e.target.value)}><option>General Trade</option><option>Modern Trade</option><option>Pharmacy</option></select></label><label>Periode<select value={sales.period} onChange={(e) => updateSales('period', e.target.value)}><option>Oktober 2026</option><option>November 2026</option><option>Desember 2026</option></select></label></div></section><section className="content-card achievement-card"><div className="section-heading heading-with-action"><div className="section-icon orange"><Icon><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h4"/></Icon></div><div><h2>Tabel Pencapaian Penjualan</h2><p>Pilih principal dan brand, lalu masukkan target serta capaian sales.</p></div><div className="view-switcher" role="group" aria-label="Mode input"><button className={mode === 'form' ? 'switch active' : 'switch'} onClick={() => setMode('form')}><Icon size={15}><path d="M4 5h16M4 12h16M4 19h16"/></Icon>Form</button><button className={mode === 'table' ? 'switch active' : 'switch'} onClick={() => setMode('table')}><Icon size={15}><path d="M4 5h16v14H4zM4 10h16M10 5v14"/></Icon>Tabel</button></div></div>{mode === 'table' ? <AchievementTable rows={rows} onUpdate={updateRow} onRemove={removeRow} /> : <AchievementForm rows={rows} onUpdate={updateRow} onRemove={removeRow} />}<div className="table-hint"><Icon size={16}><path d="M12 8v4l2 2"/><circle cx="12" cy="12" r="9"/></Icon><span>Baris baru muncul otomatis setelah Principal dan Brand dipilih.</span></div></section><section className="summary-grid"><Summary label="Total Target" value={totals.target.toLocaleString('id-ID')} helper="Unit penjualan"/><Summary label="Total Capaian" value={totals.achievement.toLocaleString('id-ID')} helper="Unit terealisasi"/><Summary label="Persentase Total" value={`${totals.percentage.toFixed(1)}%`} helper="Dari target keseluruhan" accent/><div className={`summary-card status-summary ${totals.status === 'Tercapai' ? 'success' : 'warning'}`}><span className="summary-label">Status Keseluruhan</span><strong>{totals.status}</strong><span className="status-copy">{totals.status === 'Tercapai' ? 'Target penjualan terpenuhi' : 'Target penjualan belum terpenuhi'}</span></div></section><footer className="action-bar"><div className="autosave"><span className="save-dot"/>{saved ? 'Draft tersimpan' : 'Tersimpan otomatis di browser'}</div><div className="actions"><button className="button secondary" onClick={onReset}>Batal</button><button className="button primary" onClick={saveDraft}><Icon size={17}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>Simpan Draft</button></div></footer></>
}

function AchievementTable({ rows, onUpdate, onRemove }) {
  return <div className="table-wrap"><table><thead><tr><th className="number-cell">No.</th><th>Principal</th><th>Brand</th><th>Target <span className="unit">(Unit)</span></th><th>Capaian <span className="unit">(Unit)</span></th><th>Persentase</th><th>Keterangan</th><th aria-label="Aksi"/></tr></thead><tbody>{rows.map((row, index) => <Row key={row.id} row={row} index={index} onUpdate={onUpdate} onRemove={onRemove}/>)}</tbody></table></div>
}

function Row({ row, index, onUpdate, onRemove }) {
  const brands = PRINCIPAL_OPTIONS.find((option) => option.name === row.principal)?.brands ?? []
  const result = calculateRow(row)
  return <tr><td className="number-cell">{String(index + 1).padStart(2, '0')}</td><td><select aria-label={`Principal baris ${index + 1}`} value={row.principal} onChange={(e) => onUpdate(row.id, 'principal', e.target.value)}><option value="">Pilih principal</option>{PRINCIPAL_OPTIONS.map((option) => <option key={option.name}>{option.name}</option>)}</select></td><td><select aria-label={`Brand baris ${index + 1}`} value={row.brand} onChange={(e) => onUpdate(row.id, 'brand', e.target.value)} disabled={!row.principal}><option value="">Pilih brand</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></td><td><input aria-label={`Target baris ${index + 1}`} type="number" min="0" value={row.target} placeholder="0" onChange={(e) => onUpdate(row.id, 'target', e.target.value)}/></td><td><input aria-label={`Capaian baris ${index + 1}`} type="number" min="0" value={row.achievement} placeholder="0" onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)}/></td><td className="percentage">{result.percentage.toFixed(1)}%</td><td><span className={`result-badge ${result.status === 'Tercapai' ? 'success' : 'warning'}`}>{result.status}</span></td><td><button className="delete-button" onClick={() => onRemove(row.id)} aria-label={`Hapus baris ${index + 1}`}><Icon size={16}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></Icon></button></td></tr>
}

function AchievementForm({ rows, onUpdate, onRemove }) {
  return <div className="form-rows">{rows.map((row, index) => <div className="entry-form" key={row.id}><div className="entry-title"><span>Baris {String(index + 1).padStart(2, '0')}</span>{rows.length > 1 && <button className="delete-button" onClick={() => onRemove(row.id)} aria-label={`Hapus baris ${index + 1}`}><Icon size={16}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></Icon></button>}</div><div className="entry-grid"><label>Principal<select value={row.principal} onChange={(e) => onUpdate(row.id, 'principal', e.target.value)}><option value="">Pilih principal</option>{PRINCIPAL_OPTIONS.map((option) => <option key={option.name}>{option.name}</option>)}</select></label><label>Brand<select value={row.brand} onChange={(e) => onUpdate(row.id, 'brand', e.target.value)} disabled={!row.principal}><option value="">Pilih brand</option>{(PRINCIPAL_OPTIONS.find((option) => option.name === row.principal)?.brands ?? []).map((brand) => <option key={brand}>{brand}</option>)}</select></label><label>Target (Unit)<input type="number" min="0" value={row.target} placeholder="Masukkan target" onChange={(e) => onUpdate(row.id, 'target', e.target.value)}/></label><label>Capaian (Unit)<input type="number" min="0" value={row.achievement} placeholder="Masukkan capaian" onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)}/></label></div><div className="entry-result"><span>Persentase <strong>{calculateRow(row).percentage.toFixed(1)}%</strong></span><span className={`result-badge ${calculateRow(row).status === 'Tercapai' ? 'success' : 'warning'}`}>{calculateRow(row).status}</span></div></div>)}</div>
}

function Summary({ label, value, helper, accent = false }) {
  return <div className={`summary-card ${accent ? 'accent' : ''}`}><span className="summary-label">{label}</span><strong>{value}</strong><span className="summary-copy">{helper}</span></div>
}

export default App
