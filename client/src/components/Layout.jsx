import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  LayoutDashboard,
  Database,
  FileText,
  ClipboardList,
  Crown,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/insetif', label: 'Insetif', icon: FileText, end: true },
];

const DOC_CHILDREN = [
  { to: '/documents/sales', label: 'Sales', icon: FileText },
  { to: '/documents/spv', label: 'SPV', icon: ClipboardList },
  { to: '/documents/bm', label: 'BM', icon: Crown },
];

// Sidebar + top bar share the canvas ground so the white panels carry the structure.
const GROUND = '#f4f8f6';

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tanggal = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <span
      className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#e8efec] px-3 py-1 text-[12.5px] font-semibold tabular-nums text-ink-500"
      aria-label={`Waktu sekarang ${tanggal} ${jam}`}
    >
      <Clock size={13} style={{ flexShrink: 0, color: '#7e8c85' }} />
      <span className="hidden md:inline">{tanggal} · </span>
      <span className="font-bold text-ink-900">{jam}</span>
    </span>
  );
}

function SideNav({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuper = user?.role === 'superadmin';
  const itemClass = (active) => `nav-item ${active ? 'nav-item-active' : ''}`;

  const docActive = location.pathname.startsWith('/documents');
  const [docOpen, setDocOpen] = useState(false);
  const docExpanded = docActive || docOpen;

  return (
    <>
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-600">
          <Database size={17} color="#fff" />
        </div>
        <div className="leading-tight">
          <p className="text-[13.5px] font-extrabold tracking-[-0.015em] text-ink-900">Insetive Tracking</p>
          <p className="mt-[2px] text-[11px] font-semibold text-ink-400">Insentif Sales</p>
        </div>
      </div>

      <nav className="mt-7 flex flex-col gap-1">
        <p className="px-3 pb-2 text-[11px] font-bold text-ink-400">Menu utama</p>
        {NAV.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => {
          const Icon = item.icon;
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <NavLink key={item.label} to={item.to} className={itemClass(active)} onClick={onNavigate}>
              <Icon size={17} color={active ? '#0c5848' : '#6c7a73'} />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          );
        })}

        {/* Dokumen: tree-level parent with Sales / SPV / BM children */}
        <div>
          <button
            type="button"
            className={`nav-item w-full ${docActive ? 'nav-item-active' : ''}`}
            onClick={() => setDocOpen((o) => !o)}
            aria-expanded={docExpanded}
          >
            <FileText size={17} color={docExpanded ? '#0c5848' : '#6c7a73'} />
            <span className="flex-1 text-left">Dokumen</span>
            <ChevronDown
              size={15}
              color="#7e8c85"
              style={{ transform: docExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            />
          </button>
          {docExpanded && (
            <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-l-[#dbe6e1] pl-3">
              {DOC_CHILDREN.map((child) => {
                const ChildIcon = child.icon;
                return (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition ${
                        isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-white hover:text-ink-900'
                      }`
                    }
                  >
                    <ChildIcon size={15} style={{ flexShrink: 0, opacity: 0.72 }} />
                    <span className="flex-1 text-left">{child.label}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {isSuper && (
          <NavLink to="/master" className={itemClass(location.pathname.startsWith('/master'))} onClick={onNavigate}>
            <Database size={17} color={location.pathname.startsWith('/master') ? '#0c5848' : '#6c7a73'} />
            <span className="flex-1">Data Master</span>
          </NavLink>
        )}
      </nav>

      <div className="mt-auto pt-4">
        <div className="rounded-lg border border-border bg-white p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name || user?.username} color={user?.avatar_color} emoji={user?.avatar_key} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink-900">{user?.name}</p>
              <p className="truncate text-[11.5px] text-ink-500">{user?.role}</p>
            </div>
            <Button
              aria-label="Keluar"
              title="Keluar"
              size="icon"
              variant="ghost"
              onClick={() => { logout(); navigate('/login'); }}
              className="text-ink-500 hover:bg-black/5 hover:text-[#e11d48]"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Layout({ title, breadcrumb = [], actions, children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <a className="skip-link" href="#main-content">Lewati ke konten</a>
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col border-r border-border px-3 py-4"
        style={{ width: '240px', backgroundColor: GROUND }}
      >
        <SideNav />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(17,24,39,0.4)]" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <aside data-ui className="absolute inset-y-0 left-0 flex flex-col px-3 py-4 shadow-[0_12px_40px_-12px_rgba(16,24,40,.25)]" style={{ width: 'min(86vw,300px)', backgroundColor: GROUND }}>
            <Button
              aria-label="Tutup"
              className="absolute right-3 top-3 text-ink-500 hover:bg-white/80"
              size="icon"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </Button>
            <SideNav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 min-w-0 max-w-full flex-col ml-0 lg:ml-[240px]">
        <header
          className="sticky top-0 z-20 border-b border-border"
          style={{ backgroundColor: GROUND }}
        >
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                aria-label="Buka menu"
                className="lg:hidden text-ink-900 hover:bg-black/5"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(true)}
              >
                <Menu size={20} />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-ink-500">
                  <span className="font-semibold">Insetive Tracking</span>
                  {breadcrumb.map((c) => (
                    <span key={c}>
                      <span className="mx-1 text-ink-400">›</span>
                      <span className="font-bold text-ink-900">{c}</span>
                    </span>
                  ))}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <LiveClock />
              <div className="hidden sm:block text-right leading-tight">
                <p className="max-w-[160px] truncate text-[12.5px] font-bold text-ink-900">
                  {user?.name || user?.username}
                </p>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                  {user?.role}
                </p>
              </div>
              <Avatar name={user?.name || user?.username} color={user?.avatar_color} emoji={user?.avatar_key} size="sm" ring />
            </div>
          </div>
        </header>

        <main id="main-content" className="min-w-0 w-full max-w-full flex-1 overflow-x-hidden px-4 lg:px-8 py-4 lg:py-7 pb-24 lg:pb-7">
          <div className="mx-auto w-full max-w-[1440px]">
            {/* Title row lives on the canvas (taste sheet), not in the top bar */}
            {(title || actions) && (
              <div
                className="flex flex-col lg:flex-row lg:items-end flex-wrap justify-between gap-3 mt-1 mb-5"
              >
                <h1 className="text-[22px] lg:text-[24px] font-bold tracking-[-0.028em] text-ink-900">
                  {title}
                </h1>
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              </div>
            )}
            {children}
          </div>
        </main>

        <footer className="hidden lg:block px-8 pb-5 text-center text-[11.5px] text-ink-400">
          © 2026 Insetive Tracking · Insentif Sales Management
        </footer>
      </div>
    </div>
  );
}
