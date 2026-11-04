import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from 'cn';
import Icon from '../components/Icon';
import { fromApiPeriod } from '../lib/period';

const MONTH_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function labelToDate(label) {
  const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(label || '');
  const index = match ? MONTH_LONG.indexOf(match[1]) : -1;
  if (!match || index < 0) return new Date();
  return new Date(Number(match[2]), index, 1);
}

function buildPeriodSeries(documents, periodLabel) {
  const anchor = labelToDate(periodLabel);
  return [-5, -4, -3, -2, -1, 0].map((offset) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; /* taste-skill-ignore: month part of YYYY-MM date contract */
    const docs = documents.filter((doc) => doc.period === key);
    const final = docs.filter((doc) => doc.status === 'Final').length;
    const draft = docs.filter((doc) => doc.status !== 'Final').length;
    return {
      key,
      label: MONTH_SHORT[date.getMonth()],
      longLabel: MONTH_LONG[date.getMonth()],
      final,
      draft,
      total: final + draft,
      now: offset === 0,
    };
  });
}

function EmptyState({ title, copy }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export default function Dashboard({ documents = [], user, period, onNewDoc, onLoadDoc }) {
  const visibleDocs = documents;

  const totalDocs = visibleDocs.length;
  const draftCount = visibleDocs.filter((d) => d.status === 'Draft').length;
  const finalCount = visibleDocs.filter((d) => d.status === 'Final').length;
  const completion = totalDocs ? Math.round((finalCount / totalDocs) * 100) : 0;

  const salesMap = visibleDocs.reduce((acc, doc) => {
    const name = (doc.salesman || '').trim() || 'Tanpa nama';
    if (!acc[name]) acc[name] = { name, total: 0, final: 0, draft: 0 };
    acc[name].total += 1;
    if (doc.status === 'Final') acc[name].final += 1;
    else acc[name].draft += 1;
    return acc;
  }, {});
  const salesRows = Object.values(salesMap).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const topSales = salesRows.slice(0, 5);
  const totalSales = salesRows.filter((row) => row.name !== 'Tanpa nama').length;

  const kpis = [
    { label: 'Total Dokumen', value: totalDocs, caption: 'Dokumen tersimpan', tone: '#9fb0a8' },
    { label: 'Draft', value: draftCount, caption: 'Belum difinalisasi', tone: '#c07818' },
    { label: 'Final', value: finalCount, caption: 'Sudah disetujui', tone: '#2f62c4' },
    { label: 'Total Sales', value: totalSales, caption: 'Sales dengan dokumen', tone: '#0f6b58' },
  ];

  const recentDocs = [...visibleDocs].sort((a, b) => b.id - a.id).slice(0, 5);
  const latestPeriod = visibleDocs.reduce((latest, doc) => (doc.period && doc.period > latest ? doc.period : latest), '');
  const chartAnchor = latestPeriod ? fromApiPeriod(latestPeriod) : period;
  const series = buildPeriodSeries(visibleDocs, chartAnchor);
  const seriesMax = Math.max(1, ...series.map((item) => item.total));
  const seriesTotal = series.reduce((sum, item) => sum + item.total, 0);
  const firstPeriod = series[0]?.label || '';
  const lastPeriod = series[series.length - 1]?.label || '';
  const donutRadius = 52;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const finalShare = totalDocs ? finalCount / totalDocs : 0;
  const salesMax = Math.max(1, ...topSales.map((row) => row.total));

  return (
    <>
      <div className="page-head">
        <div className="page-head-copy">
          <h1>Dashboard</h1>
          <p>Ringkasan dokumen dan status insentif tim.</p>
        </div>
        <div className="page-head-actions">
          <Link className={cn(buttonVariants({ variant: 'outline' }), 'h-9 px-4')} to="/documents/sales">Lihat semua dokumen</Link>
          <Button onClick={onNewDoc} disabled={user?.role === 'observer'} className="h-9 px-4">
            <Icon size={16}><path d="M12 5v14M5 12h14" /></Icon>Tambah Dokumen
          </Button>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="kpi-strip">
            {kpis.map((kpi) => (
              <div className="kpi-cell" key={kpi.label}>
                <div className="kpi-label">
                  <span className="kpi-dot" style={{ background: kpi.tone }} aria-hidden="true" />
                  {kpi.label}
                </div>
                <div className="kpi-value">{kpi.value}</div>
                <div className="kpi-caption">{kpi.caption}</div>
              </div>
            ))}
          </div>

          <div className="overview-grid">
            <article className="card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Status dokumen</h2>
                  <p className="card-sub">Komposisi draft dan final</p>
                </div>
                <span className="card-note">{totalDocs} total</span>
              </div>
              <div className="status-flex">
                <div className="donut-wrap">
                  <svg viewBox="0 0 128 128" width="150" height="150" role="img" aria-label={`${totalDocs} dokumen: ${finalCount} final dan ${draftCount} draft`}>
                    <circle cx="64" cy="64" r={donutRadius} fill="none" stroke="#edf2ef" strokeWidth="13" />
                    {finalCount > 0 && (
                      <circle
                        cx="64"
                        cy="64"
                        r={donutRadius}
                        fill="none"
                        stroke="var(--blue)"
                        strokeWidth="13"
                        strokeDasharray={`${finalShare * donutCircumference} ${donutCircumference}`}
                        transform="rotate(-90 64 64)"
                      />
                    )}
                  </svg>
                  <span className="donut-center" aria-hidden="true">
                    <strong>{totalDocs}</strong>
                    <span>Dokumen</span>
                  </span>
                </div>
                <div className="status-legend">
                  <div className="legend-row">
                    <span className="legend-swatch" style={{ background: 'var(--blue)' }} aria-hidden="true" />
                    <span>Final</span>
                    <strong>{finalCount}</strong>
                  </div>
                  <div className="legend-row">
                    <span className="legend-swatch" style={{ background: 'var(--blue-tint)' }} aria-hidden="true" />
                    <span>Draft</span>
                    <strong>{draftCount}</strong>
                  </div>
                  <div className="completion-row">
                    <span>Penyelesaian</span>
                    <strong>{completion}%</strong>
                  </div>
                </div>
              </div>
            </article>

            <article className="card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Dokumen per periode</h2>
                  <p className="card-sub">Enam bulan hingga periode terakhir</p>
                </div>
                <span className="card-note">{firstPeriod}–{lastPeriod}</span>
              </div>
              {seriesTotal === 0 ? (
                <EmptyState title="Belum ada dokumen" copy="Dokumen yang tersimpan akan muncul di sini per periode." />
              ) : (
                <div className="period-chart">
                  {series.map((item) => (
                    <div
                      className="period-col"
                      key={item.key}
                      role="img"
                      aria-label={`${item.longLabel}: ${item.total} dokumen, ${item.final} final, ${item.draft} draft`}
                      title={`${item.longLabel}: ${item.total} dokumen`}
                    >
                      <span className="period-count" aria-hidden="true">{item.total || ''}</span>
                      <span className="period-track" aria-hidden="true">
                        {item.draft > 0 && (
                          <span className="period-bar draft" style={{ height: `${(item.draft / seriesMax) * 100}%` }} />
                        )}
                        {item.final > 0 && (
                          <span className="period-bar final" style={{ height: `${(item.final / seriesMax) * 100}%` }} />
                        )}
                      </span>
                      <span className={`period-label${item.now ? ' now' : ''}`} aria-hidden="true">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="chart-legend">
                <span><i style={{ background: 'var(--blue)' }} aria-hidden="true" />Final</span>
                <span><i style={{ background: 'var(--blue-tint)' }} aria-hidden="true" />Draft</span>
              </div>
            </article>
          </div>

          <article className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Dokumen per sales</h2>
                <p className="card-sub">Berdasarkan salesman pada dokumen</p>
              </div>
              <span className="card-note">{totalSales} sales</span>
            </div>

            {topSales.length ? (
              <div className="sales-breakdown">
                {topSales.map((row) => (
                  <div className="sales-row" key={row.name} title={`${row.final} final, ${row.draft} draft`}>
                    <span className="sales-name">{row.name}</span>
                    <span className="sales-bar" aria-hidden="true">
                      {row.final > 0 && (
                        <span className="sales-bar-final" style={{ width: `${(row.final / salesMax) * 100}%` }} />
                      )}
                      {row.draft > 0 && (
                        <span className="sales-bar-draft" style={{ width: `${(row.draft / salesMax) * 100}%` }} />
                      )}
                    </span>
                    <span className="sales-count">{row.total}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Belum ada dokumen" copy='Klik "Tambah Dokumen" untuk mulai mencatat insentif.' />
            )}

            {salesRows.length > topSales.length && (
              <Link className="sales-more" to="/documents/sales">Lihat semua sales</Link>
            )}
          </article>
        </div>

        <aside className="dash-rail">
          <div className="card rail-card">
            <div className="rail-head">
              <h2 className="rail-title">Dokumen terbaru</h2>
              <Link className="rail-link" to="/documents/sales">Lihat semua</Link>
            </div>
            {recentDocs.length ? (
              <div className="recent-list">
                {recentDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className="recent-row"
                    onClick={() => onLoadDoc?.(doc)}
                  >
                    <span className="recent-main">
                      <span className="recent-name">{doc.salesman || 'Tanpa nama'}</span>
                      <span className="recent-meta">{fromApiPeriod(doc.period)} · {doc.product || '–'}</span>
                    </span>
                    <Badge className={doc.status === 'Final' ? 'bg-[var(--final-soft)] text-[var(--final)] hover:bg-[var(--final-soft)]' : 'bg-[var(--draft-soft)] text-[var(--draft)] hover:bg-[var(--draft-soft)]'}>{doc.status}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="Belum ada dokumen" copy="Dokumen terbaru akan muncul di sini." />
            )}
            {recentDocs.length > 0 && (
              <Link className={cn(buttonVariants({ variant: 'outline' }), 'h-8 w-full')} to="/documents/sales">Lihat semua</Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
