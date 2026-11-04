import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
];

const DOC_CHILDREN = [
  { to: '/documents/sales', label: 'Sales', icon: FileText },
  { to: '/documents/spv', label: 'SPV', icon: ClipboardList },
  { to: '/documents/bm', label: 'BM', icon: Crown },
];

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
    <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold tabular-nums text-ink-600 sm:inline-flex" aria-label={`Waktu sekarang ${tanggal} ${jam}`}>
      <Clock size={14} className="shrink-0 text-ink-400" />
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
          <Database size={18} className="text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-[13.5px] font-extrabold tracking-tight text-ink-900">Insetive Tracking</p>
          <p className="text-[11px] text-ink-500">Insentif Sales</p>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">Menu Utama</p>
        {NAV.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => {
          const Icon = item.icon;
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <NavLink key={item.label} to={item.to} className={itemClass(active)} onClick={onNavigate}>
              <Icon size={17} className="text-ink-500" />
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
          >
            <FileText size={17} className="text-ink-500" />
            <span className="flex-1 text-left">Dokumen</span>
            <ChevronDown size={15} className={`text-ink-400 transition-transform ${docExpanded ? 'rotate-180' : ''}`} />
          </button>
          {docExpanded && (
            <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-200 pl-3">
              {DOC_CHILDREN.map((child) => {
                const ChildIcon = child.icon;
                return (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition ${
                        isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-slate-50 hover:text-ink-900'
                      }`
                    }
                  >
                    <ChildIcon size={15} className="shrink-0 opacity-70" />
                    <span className="flex-1 text-left">{child.label}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {isSuper && (
          <NavLink to="/master" className={itemClass(location.pathname.startsWith('/master'))} onClick={onNavigate}>
            <Database size={17} className="text-ink-500" />
            <span className="flex-1">Data Master</span>
          </NavLink>
        )}
      </nav>

      <div className="mt-auto pt-4">
        <div className="rounded-2xl bg-white/80 p-3 shadow-card backdrop-blur">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name} color={user?.avatar_color} emoji={user?.avatar_key} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink-900">{user?.name}</p>
              <p className="truncate text-[11.5px] text-ink-500">{user?.role}</p>
            </div>
            <button title="Keluar" onClick={() => { logout(); navigate('/login'); }} className="rounded-lg p-2 text-ink-400 hover:bg-slate-100 hover:text-rose-600">
              <LogOut size={16} />
            </button>
          </div>
          <span className="mt-2.5 inline-block rounded-md bg-brand-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brand-800">
            {user?.role}
          </span>
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] flex-col border-r border-slate-200/70 bg-gradient-to-b from-[#eef7f3] via-[#f3f6f8] to-[#eef2f6] px-3 py-4 lg:flex">
        <SideNav />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-ink-900/40" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,300px)] flex-col bg-gradient-to-b from-[#eef7f3] via-[#f3f6f8] to-[#eef2f6] px-3 py-4 shadow-pop">
            <button className="absolute right-3 top-3 rounded-lg p-2 text-ink-500 hover:bg-white" onClick={() => setOpen(false)} aria-label="Tutup">
              <X size={18} />
            </button>
            <SideNav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 max-w-full flex-1 flex-col lg:ml-[256px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button className="rounded-xl p-2 text-ink-700 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] text-ink-500 lg:text-[13px]">
                  <span className="font-semibold">Insetive Tracking</span>
                  {breadcrumb.map((c) => (
                    <span key={c}>
                      <span className="mx-1 text-ink-400">›</span>
                      <span className="font-bold text-ink-900">{c}</span>
                    </span>
                  ))}
                </p>
                {title && <h1 className="truncate text-[16px] font-extrabold tracking-tight text-ink-900 lg:hidden">{title}</h1>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LiveClock />
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-ink-500 sm:block">{user?.role}</span>
              <Avatar name={user?.name} color={user?.avatar_color} emoji={user?.avatar_key} size="sm" ring />
            </div>
          </div>

          {(title || actions) && (
            <div className="hidden flex-wrap items-end justify-between gap-3 border-t border-slate-100 bg-white px-6 py-5 lg:flex">
              <h1 className="text-[19px] font-extrabold tracking-tight text-ink-900">{title}</h1>
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            </div>
          )}
          {actions && <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 lg:hidden">{actions}</div>}
        </header>

        <main className="min-w-0 w-full max-w-full flex-1 overflow-x-hidden px-4 py-4 pb-24 lg:px-6 lg:py-6 lg:pb-6">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>

        <footer className="hidden px-6 pb-5 text-center text-[11.5px] text-ink-400 lg:block">
          © 2026 Insetive Tracking · Insentif Sales Management
        </footer>
      </div>
    </div>
  );
}