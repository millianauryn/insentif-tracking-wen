import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from 'cn';
import Icon from '../components/Icon';
import { fromApiPeriod } from '../lib/period';
import { listPositions } from '../api';

function EmptyState({ title, copy }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

// Lama kerja dari tanggal masuk jabatan: "4 tahun" / "8 bulan" / "–"
function tenureLabel(joinDate) {
  if (!joinDate) return '–';
  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime())) return '–';
  const months = Math.max(0, (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(months / 12);
  if (years >= 1) return `${years} tahun`;
  return `${Math.max(1, Math.round(months))} bulan`;
}

function OrgNode({ position, childrenOf, depth }) {
  return (
    <div className="org-node">
      <div className="org-row">
        <span className="org-role">{position.position_type}</span>
        <span className="org-name">{position.name}</span>
        <span className="org-tenure">{tenureLabel(position.join_date)}</span>
      </div>
      {depth < 2 && (
        <div className="org-children">
          {childrenOf(position.id).map((child) => (
            <OrgNode key={child.id} position={child} childrenOf={childrenOf} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ documents = [], user, onNewDoc, onLoadDoc }) {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    listPositions()
      .then((res) => setPositions((res.positions || []).filter((p) => p.active !== 0)))
      .catch(() => setPositions([]));
  }, []);

  const childrenOf = (id) => positions.filter((p) => p.parent_position_id === id);
  const roots = positions.filter((p) => !p.parent_position_id);
  const totalSales = positions.filter((p) => p.position_type === 'SALES').length;
  const recentDocs = [...documents].sort((a, b) => b.id - a.id).slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div className="page-head-copy">
          <h1>Dashboard</h1>
          <p>Ringkasan dokumen dan struktur tim insentif.</p>
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
          <article className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Struktur Tim</h2>
                <p className="card-sub">BM, SPV, dan sales beserta lama kerja</p>
              </div>
              <span className="card-note">{totalSales} sales</span>
            </div>
            {roots.length ? (
              <div className="org-tree">
                {roots.map((bm) => (
                  <OrgNode key={bm.id} position={bm} childrenOf={childrenOf} depth={0} />
                ))}
              </div>
            ) : (
              <EmptyState title="Belum ada data jabatan" copy="Tambah jabatan BM, SPV, dan sales di Data Master." />
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
                    <Badge className={`status-pill ${doc.status === 'Final' ? 'final' : 'draft'}`}>{doc.status}</Badge>
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
