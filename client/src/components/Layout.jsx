import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Box, Flex, Span, Text, IconButton } from '@chakra-ui/react';
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

// Sidebar gradient (raw stops — kept as CSS, see App.css/print parity)
const SIDEBAR_BG = 'linear-gradient(to-b, #eef7f3, #f3f6f8, #eef2f6)';

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
    <Span
      display={{ base: 'none', sm: 'inline-flex' }}
      alignItems="center"
      gap={1.5}
      whiteSpace="nowrap"
      rounded="full"
      bg="gray.100"
      px={3}
      py={1}
      fontSize="12px"
      fontWeight="semibold"
      fontVariantNumeric="tabular-nums"
      color="fg.muted"
      aria-label={`Waktu sekarang ${tanggal} ${jam}`}
    >
      <Clock size={14} style={{ flexShrink: 0, color: '#9ca3af' }} />
      <Span display={{ base: 'none', md: 'inline' }}>{tanggal} · </Span>
      <Span fontWeight="bold" color="fg.default">{jam}</Span>
    </Span>
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
      <Flex alignItems="center" gap={2.5} px={2}>
        <Flex h={10} w={10} alignItems="center" justifyContent="center" rounded="xl" bg="brand.600">
          <Database size={18} color="#fff" />
        </Flex>
        <Box lineHeight="tight">
          <Text fontSize="13.5px" fontWeight="800" letterSpacing="-0.02em" color="fg.default">Insetive Tracking</Text>
          <Text fontSize="11px" color="fg.muted">Insentif Sales</Text>
        </Box>
      </Flex>

      <Box as="nav" mt={6} display="flex" flexDirection="column" gap={1.25}>
        <Text px={3} pb={1} fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="fg.subtle">Menu Utama</Text>
        {NAV.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => {
          const Icon = item.icon;
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <NavLink key={item.label} to={item.to} className={itemClass(active)} onClick={onNavigate}>
              <Icon size={17} color="#6b7280" />
              <Span flex="1">{item.label}</Span>
            </NavLink>
          );
        })}

        {/* Dokumen: tree-level parent with Sales / SPV / BM children */}
        <Box>
          <button
            type="button"
            className={`nav-item w-full ${docActive ? 'nav-item-active' : ''}`}
            onClick={() => setDocOpen((o) => !o)}
          >
            <FileText size={17} color="#6b7280" />
            <span className="flex-1 text-left">Dokumen</span>
            <ChevronDown
              size={15}
              color="#9ca3af"
              style={{ transform: docExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            />
          </button>
          {docExpanded && (
            <Box ml={4} mt={1} display="flex" flexDirection="column" gap={0.5} borderLeftWidth={2} borderLeftColor="gray.200" pl={3}>
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
                    <ChildIcon size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span className="flex-1 text-left">{child.label}</span>
                  </NavLink>
                );
              })}
            </Box>
          )}
        </Box>

        {isSuper && (
          <NavLink to="/master" className={itemClass(location.pathname.startsWith('/master'))} onClick={onNavigate}>
            <Database size={17} color="#6b7280" />
            <Span flex="1">Data Master</Span>
          </NavLink>
        )}
      </Box>

      <Box mt="auto" pt={4}>
        <Box rounded="2xl" bg="rgba(255,255,255,0.8)" p={3} boxShadow="0 1px 2px rgba(16,24,40,.06), 0 8px 24px -12px rgba(16,24,40,.12)" style={{ backdropFilter: 'blur(8px)' }}>
          <Flex alignItems="center" gap={3}>
            <Avatar name={user?.name} color={user?.avatar_color} emoji={user?.avatar_key} size="md" />
            <Box minW={0} flex="1">
              <Text truncate fontSize="13px" fontWeight="700" color="fg.default">{user?.name}</Text>
              <Text truncate fontSize="11.5px" color="fg.muted">{user?.role}</Text>
            </Box>
            <IconButton
              aria-label="Keluar"
              title="Keluar"
              size="sm"
              variant="ghost"
              onClick={() => { logout(); navigate('/login'); }}
              icon={<LogOut size={16} />}
              color="fg.muted"
              _hover={{ bg: 'rgba(0,0,0,0.06)', color: '#e11d48' }}
            />
          </Flex>
          <Span mt={2.5} display="inline-block" rounded="md" bg="brand.100" px={2} py={0.5} fontSize="10.5px" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" color="brand.800">
            {user?.role}
          </Span>
        </Box>
      </Box>
    </>
  );
}

export default function Layout({ title, breadcrumb = [], actions, children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  return (
    <Flex minH="100vh" overflowX="hidden">
      <Box
        as="aside"
        position="fixed"
        top={0}
        bottom={0}
        left={0}
        zIndex={30}
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        w="256px"
        px={3}
        py={4}
        borderRightWidth={1}
        borderRightColor="rgba(226,232,240,0.7)"
        style={{ backgroundImage: SIDEBAR_BG }}
      >
        <SideNav />
      </Box>

      {open && (
        <Box position="fixed" inset={0} zIndex={40} display={{ base: 'block', lg: 'none' }}>
          <Box position="absolute" inset={0} bg="rgba(17,24,39,0.4)" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <Box as="aside" position="absolute" top={0} bottom={0} left={0} display="flex" flexDirection="column" w="min(86vw,300px)" px={3} py={4} boxShadow="0 12px 40px -12px rgba(16,24,40,.25)" style={{ backgroundImage: SIDEBAR_BG }}>
            <IconButton
              aria-label="Tutup"
              position="absolute"
              right={3}
              top={3}
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              icon={<X size={18} />}
              color="fg.muted"
              _hover={{ bg: 'rgba(255,255,255,0.8)' }}
            />
            <SideNav onNavigate={() => setOpen(false)} />
          </Box>
        </Box>
      )}

      <Box flex="1" minW={0} maxW="full" minH="100vh" display="flex" flexDirection="column" ml={{ base: 0, lg: '256px' }}>
        <Box
          as="header"
          position="sticky"
          top={0}
          zIndex={20}
          borderBottomWidth={1}
          borderBottomColor="rgba(226,232,240,0.7)"
          bg="rgba(255,255,255,0.9)"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <Flex alignItems="center" justifyContent="space-between" gap={3} px={{ base: 4, lg: 6 }} py={3}>
            <Flex minW={0} alignItems="center" gap={2}>
              <IconButton
                aria-label="Buka menu"
                display={{ base: 'inline-flex', lg: 'none' }}
                variant="ghost"
                size="sm"
                rounded="xl"
                onClick={() => setOpen(true)}
                icon={<Menu size={20} />}
                color="fg.default"
                _hover={{ bg: 'rgba(0,0,0,0.06)' }}
              />
              <Box minW={0}>
                <Text truncate fontSize={{ base: '12.5px', lg: '13px' }} color="fg.muted">
                  <Span fontWeight="600">Insetive Tracking</Span>
                  {breadcrumb.map((c) => (
                    <Span key={c}>
                      <Span mx={1} color="fg.subtle">›</Span>
                      <Span fontWeight="700" color="fg.default">{c}</Span>
                    </Span>
                  ))}
                </Text>
                {title && (
                  <Box as="h1" truncate fontSize="16px" fontWeight="800" letterSpacing="-0.02em" color="fg.default" display={{ base: 'block', lg: 'none' }}>
                    {title}
                  </Box>
                )}
              </Box>
            </Flex>
            <Flex shrink={0} alignItems="center" gap={2}>
              <LiveClock />
              <Span display={{ base: 'none', sm: 'block' }} rounded="full" bg="gray.100" px={3} py={1} fontSize="12px" fontWeight="600" color="fg.muted">{user?.role}</Span>
              <Avatar name={user?.name} color={user?.avatar_color} emoji={user?.avatar_key} size="sm" ring />
            </Flex>
          </Flex>

          {(title || actions) && (
            <Flex
              display={{ base: 'none', lg: 'flex' }}
              flexWrap="wrap"
              alignItems="flex-end"
              justifyContent="space-between"
              gap={3}
              borderTopWidth={1}
              borderTopColor="gray.100"
              bg="white"
              px={6}
              py={5}
            >
              <Box as="h1" fontSize="19px" fontWeight="800" letterSpacing="-0.02em" color="fg.default">{title}</Box>
              <Flex flexWrap="wrap" alignItems="center" gap={2}>{actions}</Flex>
            </Flex>
          )}
          {actions && (
            <Flex flexWrap="wrap" gap={2} borderTopWidth={1} borderTopColor="gray.100" px={4} py={3} display={{ base: 'flex', lg: 'none' }}>
              {actions}
            </Flex>
          )}
        </Box>

        <Box as="main" minW={0} w="full" maxW="full" flex="1" overflowX="hidden" px={{ base: 4, lg: 6 }} py={{ base: 4, lg: 6 }} pb={{ base: 24, lg: 6 }}>
          <Box mx="auto" w="full" maxW="1440px">{children}</Box>
        </Box>

        <Box as="footer" display={{ base: 'none', lg: 'block' }} px={6} pb={5} textAlign="center" fontSize="11.5px" color="fg.subtle">
          © 2026 Insetive Tracking · Insentif Sales Management
        </Box>
      </Box>
    </Flex>
  );
}
