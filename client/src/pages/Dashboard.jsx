import { useState, useEffect } from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { fromApiPeriod, PERIOD_OPTIONS } from '../lib/period';
import { listHierarchy } from '../api';

// Period options come from lib/period (realtime: prev/current/next month)

function TreeNode({ label, role, count, open, onToggle, depth }) {
  const depthClass = depth === 0 ? 'bg-slate-50/70' : depth === 1 ? 'bg-white hover:bg-slate-50' : 'hover:bg-slate-50';
  return (
    <button onClick={onToggle} className={`flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left ${depthClass}`}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{role}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink-900">{label}</span>
      <span className="hidden whitespace-nowrap text-[11.5px] text-ink-400 sm:inline">{count} dokumen</span>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-ink-400 ${open ? 'bg-ink-900 text-white' : 'bg-slate-100'}`}>
        {open ? <Icon size={12}><path d="M5 12h14"/></Icon> : <Icon size={12}><path d="M12 5v14M5 12h14"/></Icon>}
      </span>
    </button>
  );
}

function DocRow({ doc, onClick }) {
  const statusColor = doc.status === 'Final' ? 'text-emerald-700' : 'text-slate-500';
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
  const totalSales = bmReports.length + bmReports.reduce((sum, spv) => sum + getReports(spv.id).length, 0);

  const kpis = [
    { label: 'Total Dokumen', value: totalDocs, caption: 'Dokumen tersimpan' },
    { label: 'Draft', value: draftCount, caption: 'Belum dikirim' },
    { label: 'Final', value: finalCount, caption: 'Sudah disetujui' },
    { label: 'Total Sales', value: totalSales, caption: 'Sales aktif' },
  ];

  const recentDocs = [...visibleDocs].sort((a, b) => b.id - a.id).slice(0, 5);

  return (
    <>
      {/* Title row: noun + grey line, the one primary action right */}
      <Flex direction={{ base: 'column', lg: 'row' }} justify="space-between" align={{ lg: 'flex-end' }} gap={3}>
        <Box minW={0}>
          <Text as="h1" fontSize="24px" fontWeight="700" letterSpacing="-0.02em" color="fg.default" lineHeight="1.2">
            Dashboard
          </Text>
          <Text mt={1.5} fontSize="15px" color="fg.muted">
            Pantau performa penjualan dan dokumen insentif periode {period}.
          </Text>
        </Box>
        <button
          className="button primary"
          onClick={onNewDoc}
          disabled={user.role === 'observer'}
          style={{ flexShrink: 0 }}
        >
          <Icon size={17}><path d="M12 5v14M5 12h14"/></Icon>Tambah Dokumen
        </button>
      </Flex>

      {/* Scope row: the period control */}
      <label className="period-control" style={{ marginTop: 20 }}>
        Periode<select value={period} onChange={(event) => setPeriod(event.target.value)}>{PERIOD_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select>
      </label>

      <Flex direction={{ base: 'column', lg: 'row' }} gap={6} alignItems="flex-start" mt={6}>
        <Box flex="1" minW={0}>
          {/* KPI strip: one container split by 1px dividers */}
          <Box
            display="grid"
            gridTemplateColumns={{ base: '1fr 1fr', md: 'repeat(4, 1fr)' }}
            gap="1px"
            bg="border.default"
            borderWidth={1}
            borderColor="border.default"
            rounded="lg"
            overflow="hidden"
            mb={4}
          >
            {kpis.map((kpi) => (
              <Box key={kpi.label} bg="white" px={5} py={4}>
                <Text fontSize="14px" color="fg.muted">{kpi.label}</Text>
                <Text mt={1} fontSize="24px" fontWeight="500" lineHeight="1.2" fontVariantNumeric="tabular-nums" color="fg.default">
                  {kpi.value}
                </Text>
                <Text mt={1} fontSize="13px" color="fg.subtle">{kpi.caption}</Text>
              </Box>
            ))}
          </Box>

          {/* Hierarchy tree: BM → SPV → Sales */}
          <section className="content-card info-card">
            <div className="section-heading">
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
        </Box>

        {/* Rail: recent documents on a 45px pitch, closed by an outlined View all */}
        <Box w={{ base: '100%', lg: '384px' }} flexShrink={0}>
          <Text as="h2" fontSize="16px" fontWeight="700" color="fg.default" mb={4}>
            Dokumen terbaru
          </Text>
          {recentDocs.length === 0 && (
            <Text fontSize="13px" color="fg.subtle" py={3}>Belum ada dokumen.</Text>
          )}
          {recentDocs.map((doc) => (
            <Box
              key={doc.id}
              as="button"
              type="button"
              onClick={() => onLoadDoc?.(doc)}
              w="100%"
              h="45px"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap={2}
              px={1}
              borderBottomWidth={1}
              borderBottomColor="border.default"
              bg="transparent"
              textAlign="left"
              _hover={{ bg: 'white' }}
            >
              <Box minW={0}>
                <Text truncate fontSize="13px" fontWeight="600" color="fg.default">{doc.salesman || 'Tanpa nama'}</Text>
                <Text truncate fontSize="11px" color="fg.subtle">{fromApiPeriod(doc.period)} · {doc.product || '–'}</Text>
              </Box>
              <Text
                shrink={0}
                fontSize="11.5px"
                fontWeight="600"
                color={doc.status === 'Final' ? 'brand.700' : 'fg.subtle'}
              >
                {doc.status}
              </Text>
            </Box>
          ))}
          {recentDocs.length > 0 && (
            <Button
              as={Link}
              to="/documents/sales"
              variant="outline"
              size="sm"
              w="100%"
              h="30px"
              mt={3}
              fontSize="12px"
              fontWeight="600"
            >
              Lihat semua
            </Button>
          )}
        </Box>
      </Flex>
    </>
  );
}
