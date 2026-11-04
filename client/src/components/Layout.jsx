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
    <Span
      display={{ base: 'none', sm: 'inline-flex' }}
      alignItems="center"
      gap={1.5}
      whiteSpace="nowrap"
      rounded="full"
      bg="#e8efec"
      px={3}
      py={1}
      fontSize="12.5px"
      fontWeight="semibold"
      fontVariantNumeric="tabular-nums"
      color="fg.muted"
      aria-label={`Waktu sekarang ${tanggal} ${jam}`}
    >
      <Clock size={13} style={{ flexShrink: 0, color: '#7e8c85' }} />
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
        <Flex h={9} w={9} alignItems="center" justifyContent="center" rounded="10px" bg="brand.600">
          <Database size={17} color="#fff" />
        </Flex>
        <Box lineHeight="tight">
          <Text fontSize="13.5px" fontWeight="800" letterSpacing="-0.015em" color="fg.default">Insetive Tracking</Text>
          <Text mt="2px" fontSize="10px" fontWeight="600" letterSpacing="0.07em" textTransform="uppercase" color="fg.subtle">Insentif Sales</Text>
        </Box>
      </Flex>

      <Box as="nav" mt={7} display="flex" flexDirection="column" gap={1}>
        <Text px={3} pb={2} fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color="fg.subtle">Menu utama</Text>
        {NAV.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => {
          const Icon = item.icon;
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <NavLink key={item.label} to={item.to} className={itemClass(active)} onClick={onNavigate}>
              <Icon size={17} color={active ? '#0c5848' : '#6c7a73'} />
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
            <Box ml={4} mt={1} display="flex" flexDirection="column" gap={0.5} borderLeftWidth={1} borderLeftColor="#dbe6e1" pl={3}>
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
            </Box>
          )}
        </Box>

        {isSuper && (
          <NavLink to="/master" className={itemClass(location.pathname.startsWith('/master'))} onClick={onNavigate}>
            <Database size={17} color={location.pathname.startsWith('/master') ? '#0c5848' : '#6c7a73'} />
            <Span flex="1">Data Master</Span>
          </NavLink>
        )}
      </Box>

      <Box mt="auto" pt={4}>
        <Box rounded="lg" bg="white" borderWidth={1} borderColor="border.default" p={3}>
          <Flex alignItems="center" gap={3}>
            <Avatar name={user?.name || user?.username} color={user?.avatar_color} emoji={user?.avatar_key} size="md" />
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
              color="fg.muted"
              _hover={{ bg: 'rgba(0,0,0,0.06)', color: '#e11d48' }}
            >
              <LogOut size={16} />
            </IconButton>
          </Flex>
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
      <a className="skip-link" href="#main-content">Lewati ke konten</a>
      <Box
        as="aside"
        position="fixed"
        top={0}
        bottom={0}
        left={0}
        zIndex={30}
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        w="240px"
        px={3}
        py={4}
        borderRightWidth={1}
        borderRightColor="border.default"
        bg={GROUND}
      >
        <SideNav />
      </Box>

      {open && (
        <Box position="fixed" inset={0} zIndex={40} display={{ base: 'block', lg: 'none' }}>
          <Box position="absolute" inset={0} bg="rgba(17,24,39,0.4)" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <Box as="aside" position="absolute" top={0} bottom={0} left={0} display="flex" flexDirection="column" w="min(86vw,300px)" px={3} py={4} boxShadow="0 12px 40px -12px rgba(16,24,40,.25)" bg={GROUND}>
            <IconButton
              aria-label="Tutup"
              position="absolute"
              right={3}
              top={3}
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              color="fg.muted"
              _hover={{ bg: 'rgba(255,255,255,0.8)' }}
            >
              <X size={18} />
            </IconButton>
            <SideNav onNavigate={() => setOpen(false)} />
          </Box>
        </Box>
      )}

      <Box flex="1" minW={0} maxW="full" minH="100vh" display="flex" flexDirection="column" ml={{ base: 0, lg: '240px' }}>
        <Box
          as="header"
          position="sticky"
          top={0}
          zIndex={20}
          borderBottomWidth={1}
          borderBottomColor="border.default"
          bg={GROUND}
        >
          <Flex alignItems="center" justifyContent="space-between" gap={3} h="64px" px={{ base: 4, lg: 8 }}>
            <Flex minW={0} alignItems="center" gap={2}>
              <IconButton
                aria-label="Buka menu"
                display={{ base: 'inline-flex', lg: 'none' }}
                variant="ghost"
                size="sm"
                rounded="xl"
                onClick={() => setOpen(true)}
                color="fg.default"
                _hover={{ bg: 'rgba(0,0,0,0.06)' }}
              >
                <Menu size={20} />
              </IconButton>
              <Box minW={0}>
                <Text truncate fontSize="13px" color="fg.muted">
                  <Span fontWeight="600">Insetive Tracking</Span>
                  {breadcrumb.map((c) => (
                    <Span key={c}>
                      <Span mx={1} color="fg.subtle">›</Span>
                      <Span fontWeight="700" color="fg.default">{c}</Span>
                    </Span>
                  ))}
                </Text>
              </Box>
            </Flex>
            <Flex shrink={0} alignItems="center" gap={2.5}>
              <LiveClock />
              <Box display={{ base: 'none', sm: 'block' }} textAlign="right" lineHeight="1.25">
                <Text maxW="160px" truncate fontSize="12.5px" fontWeight="700" color="fg.default">
                  {user?.name || user?.username}
                </Text>
                <Text fontSize="10.5px" fontWeight="600" letterSpacing="0.04em" textTransform="uppercase" color="fg.subtle">
                  {user?.role}
                </Text>
              </Box>
              <Avatar name={user?.name || user?.username} color={user?.avatar_color} emoji={user?.avatar_key} size="sm" ring />
            </Flex>
          </Flex>
        </Box>

        <Box as="main" id="main-content" minW={0} w="full" maxW="full" flex="1" overflowX="hidden" px={{ base: 4, lg: 8 }} py={{ base: 4, lg: 7 }} pb={{ base: 24, lg: 7 }}>
          <Box mx="auto" w="full" maxW="1440px">
            {/* Title row lives on the canvas (taste sheet), not in the top bar */}
            {(title || actions) && (
              <Flex
                direction={{ base: 'column', lg: 'row' }}
                align={{ lg: 'flex-end' }}
                justify="space-between"
                flexWrap="wrap"
                gap={3}
                mt={1}
                mb={5}
              >
                <Box as="h1" fontSize={{ base: '22px', lg: '24px' }} fontWeight="700" letterSpacing="-0.028em" color="fg.default">
                  {title}
                </Box>
                <Flex flexWrap="wrap" alignItems="center" gap={2}>{actions}</Flex>
              </Flex>
            )}
            {children}
          </Box>
        </Box>

        <Box as="footer" display={{ base: 'none', lg: 'block' }} px={8} pb={5} textAlign="center" fontSize="11.5px" color="fg.subtle">
          © 2026 Insetive Tracking · Insentif Sales Management
        </Box>
      </Box>
    </Flex>
  );
}
