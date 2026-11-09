import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';
import { Button, buttonVariants } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from 'cn';
import Icon from '../components/Icon';
import { fromApiPeriod } from '../lib/period';

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

function OrgNode({ position, childrenOf, depth, collapsed, onToggle, documentsFinal, userByPosition }) {
  const kids = childrenOf(position.id);
  const hasKids = kids.length > 0 && depth < 2;
  const open = !collapsed.has(position.id);
  const docFinal = documentsFinal[position.name] || 0;
  const displayName = position.position_type === 'SALES' && position.sales_code
    ? `${position.sales_code} ${position.name}`
    : position.name;
  return (
    <div className="org-node">
      <div className="org-row">
        <span className="org-role">{position.position_type}</span>
        <Link className="org-name" to={`/insetif?name=${encodeURIComponent(position.name)}`}>{displayName}</Link>
        <span className="org-tenure">{tenureLabel(position.join_date)}</span>
        {hasKids && (
          <button
            type="button"
            className={`org-toggle${open ? ' open' : ''}`}
            onClick={() => onToggle(position.id)}
            aria-expanded={open}
            aria-label={open ? `Tutup ${position.name}` : `Buka ${position.name}`}
          >
            {open ? <Minus size={13} /> : <Plus size={13} />}
          </button>
        )}
      </div>
      <div className="org-summary">
        <span className="org-summary-item">Insentif yang diterima: <span className="org-summary-value">{docFinal}</span></span>
      </div>
      {hasKids && open && (
        <div className="org-children">
          {kids.map((child) => (
            <OrgNode
              key={child.id}
              position={child}
              childrenOf={childrenOf}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              documentsFinal={documentsFinal}
              userByPosition={userByPosition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ documents = [], user, positions = [], users = [], onNewDoc, onLoadDoc }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const navigate = useNavigate();

  const toggleNode = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const activePositions = useMemo(() => positions.filter((p) => p.active !== 0), [positions]);

  const childrenOf = (id) => activePositions.filter((p) => p.parent_position_id === id);
  const roots = activePositions.filter((p) => !p.parent_position_id);
  const totalSales = activePositions.filter((p) => p.position_type === 'SALES').length;
  const recentDocs = [...documents].sort((a, b) => b.id - a.id).slice(0, 5);

  const userByPosition = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.position_id) map[u.position_id] = u;
    });
    return map;
  }, [users]);

  const documentsFinal = useMemo(() => {
    const counts = {};
    documents.forEach((d) => {
      if (String(d.status).toLowerCase() === 'final') counts[d.salesman] = (counts[d.salesman] || 0) + 1;
    });
    return counts;
  }, [documents]);

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
                <h2 className="card-title">Struktur Tim</h2>
                <p className="card-sub">BM, SPV, dan sales beserta lama kerja</p>
              </div>
              <span className="card-note">{totalSales} sales</span>
            </div>
            {roots.length ? (
              <div className="org-tree">
                {roots.map((bm) => (
                  <OrgNode
                    key={bm.id}
                    position={bm}
                    childrenOf={childrenOf}
                    depth={0}
                    collapsed={collapsed}
                    onToggle={toggleNode}
                    documentsFinal={documentsFinal}
                    userByPosition={userByPosition}
                  />
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
                    onClick={() => {
                      onLoadDoc?.(doc);
                      navigate(`/insetif?openDoc=${doc.id}`);
                    }}
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
              <Link className={cn(buttonVariants({ variant: 'outline' }), 'h-8 w-full')} to="/insetif">Lihat semua</Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
