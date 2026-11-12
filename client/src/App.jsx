import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { createDocument, updateDocument, finalizeDocument, deleteDocument, getDocument, listCriteria, listDocumentFormats, listDocuments, listUsers, listMasterData, listPositions, errMsg } from './api';
import { canManageAdmin } from './access';
import { useAuth } from './context/AuthContext';
import { useToast } from './components/Toast';
import { reorder } from './lib/reorder';
import { toApiPeriod, fromApiPeriod, currentPeriodLabel } from './lib/period';
import { parseMoney } from './lib/money';
import Layout from './components/Layout';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Insetif = lazy(() => import('./pages/Insetif'));
const Documents = lazy(() => import('./pages/Documents'));
const SpvDocument = lazy(() => import('./pages/SpvDocument'));
const Master = lazy(() => import('./pages/Master'));
import './App.css';
import './auth.css';

const INITIAL_SALES = {
  name: '',
  region: '',
  product: '',
  branch: 'Cabang Jakarta Selatan',
  division: 'General Trade',
  divisi: '',
  period: currentPeriodLabel(),
};

let nextRowId = 1;
const makeRow = (props = {}) => ({ id: `r${nextRowId++}`, ...props });

function App() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [golonganRows, setGolonganRows] = useState(() => [makeRow({ label: '', target: '', achievement: '', type: 'brand', isGroup: false })]);
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [sales, setSales] = useState(INITIAL_SALES);
  const [documentId, setDocumentId] = useState(null);
  const [documentFormatId, setDocumentFormatId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [spvTargetId, setSpvTargetId] = useState(null);
  const [documentStatus, setDocumentStatus] = useState('Draft');
  const [adminData, setAdminData] = useState({ users: [], criteria: [], masterData: { divisions: [], principals: [], brands: [], regions: [], branches: [] } });
  const [positions, setPositions] = useState([]);
  const [period, setPeriod] = useState(currentPeriodLabel());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [insentifTotal, setInsentifTotal] = useState(null); // null = auto-sum of kriteria incentives
  const [kwitansi, setKwitansi] = useState({
    penerima: 'PT. BINTANG SINAR JAYA',
    jumlahUang: '',
    keterangan: '',
    terbilang: '',
    nominal: '',
  });

  // Refresh setelah edit di Data Master: users + kriteria + master + posisi (agar props ke halaman lain tidak basi).
  const reloadAdminData = useCallback(async () => {
    if (!user) return;
    try {
      const [{ users }, { criteria: crit }, { divisions, principals, brands, regions, branches }, pos] = await Promise.all([listUsers(), listCriteria(), listMasterData(), listPositions()]);
      setAdminData({ users, criteria: crit, masterData: { divisions, principals, brands, regions, branches } });
      setPositions(pos.positions || []);
    } catch (err) {
      toast('error', errMsg(err));
    }
  }, [user, toast]);

  // Satu muat untuk semua role: formats, dokumen, kriteria, master data, posisi (tak diulang tiap buka halaman).
  useEffect(() => {
    if (!user) return;
    const admin = canManageAdmin(user);
    Promise.all([
      listDocumentFormats(),
      listDocuments(),
      listCriteria(),
      listMasterData(),
      listPositions(),
      admin ? listUsers() : Promise.resolve(null),
    ])
      .then(([{ formats }, { documents: next }, { criteria: crit }, master, pos, usersRes]) => {
        setDocumentFormatId(formats[0]?.id ?? null);
        setDocuments(next);
        setCriteria(crit);
        setCriteriaRows(crit.map((c) => ({ criteria_id: c.id, label: c.label, target_value: '', achievement_value: '', percentage_value: '', incentive_amount: '' })));
        setPositions(pos.positions || []);
        setAdminData((prev) => ({
          users: usersRes ? usersRes.users : prev.users,
          criteria: crit,
          masterData: {
            divisions: master.divisions,
            principals: master.principals,
            brands: master.brands,
            regions: master.regions,
            branches: master.branches,
          },
        }));
      })
      .catch((err) => toast('error', errMsg(err)));
  }, [user, toast]);

  const updateSales = (field, value) => {
    if (user?.role === 'observer') return;
    setSales((current) => ({ ...current, [field]: value }));
  };

  const updateGolonganRow = (id, field, value) => {
    if (user?.role === 'observer') return;
    setGolonganRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setSaved(false);
  };

  const removeGolonganRow = (id) => {
    if (user?.role === 'observer') return;
    setGolonganRows((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length ? next : [makeRow({ label: '', target: '', achievement: '', type: 'brand', isGroup: false })];
    });
    setSaved(false);
  };

  const addGolonganRow = (type = 'brand') => {
    if (user?.role === 'observer') return;
    const isGroup = type === 'principal' || type === 'total-divisi' || type === 'total' || type === 'divisi';
    const label = type === 'total-divisi' ? 'TOTAL DIVISI' : type === 'total' ? 'TOTAL' : '';
    const row = makeRow({ label, isGroup, type, divisi: '', target: '', achievement: '' });
    setGolonganRows((current) => [...current, row]);
    setSaved(false);
  };

  // Drag-to-reorder: urutan array = sort_order saat disimpan, parent_index dihitung ulang dari urutan
  const reorderGolonganRow = (fromIndex, toIndex) => {
    if (user?.role === 'observer') return;
    setGolonganRows((current) => reorder(current, fromIndex, toIndex));
    setSaved(false);
  };

  const updateCriteriaRow = (criteriaId, field, value) => {
    if (user?.role === 'observer') return;
    setCriteriaRows((current) => current.map((row) => row.criteria_id === criteriaId ? { ...row, [field]: value } : row));
    setSaved(false);
  };

  const buildGolonganRows = () => {
    // shortcut: Divisi stored as label prefix "DIVISI:<nama>", Total Divisi as "TOTALDIVISI:<nama>" — edit DB directly to change format
    const filtered = golonganRows.filter((row) => row.label || row.target || row.achievement || row.divisi);
    let lastPrincipalIndex;
    return filtered.map((row, index) => {
      const result = {
        label: row.type === 'divisi' ? `DIVISI:${row.divisi || ''}` : row.type === 'total-divisi' ? (row.divisi ? `TOTALDIVISI:${row.divisi}` : row.label || 'TOTAL DIVISI') : row.label || null,
        is_group: row.isGroup || false,
        target: row.target !== undefined && row.target !== '' ? Number(row.target) : null,
        achievement: row.achievement !== undefined && row.achievement !== '' ? Number(row.achievement) : null,
        sort_order: index,
      };
      // Divisi/total rows start a new section and never take a parent
      if (row.type === 'divisi' || row.type === 'total-divisi' || row.type === 'total') {
        lastPrincipalIndex = undefined;
        return result;
      }
      if (row.type === 'principal') lastPrincipalIndex = index;
      else if (lastPrincipalIndex !== undefined) result.parent_index = lastPrincipalIndex;
      return result;
    });
  };

  const buildCriteriaRows = () =>
    criteriaRows
      .filter(
        (row) =>
          row.target_value != null ||
          row.achievement_value != null ||
          row.incentive_amount != null ||
          row.percentage_value != null
      )
      .map((row) => ({
        criteria_id: row.criteria_id,
        target_value: parseMoney(row.target_value),
        achievement_value: parseMoney(row.achievement_value),
        percentage_value: parseMoney(row.percentage_value),
        incentive_amount: parseMoney(row.incentive_amount),
      }));

  const saveDraft = async () => {
    if (user?.role === 'observer') return;
    if (saving) return;
    if (!documentFormatId) {
      toast('error', 'Format dokumen belum tersedia.');
      return;
    }
    setSaving(true);
    try {
      const result = await createDocument({
        format_id: documentFormatId,
        salesman: sales.name,
        product: sales.product || '',
        period: toApiPeriod(period),
        wilayah: sales.region || null,
        divisi: sales.divisi || null,
        insentif_total: insentifTotal,
        golongan_rows: buildGolonganRows(),
        criteria_rows: buildCriteriaRows(),
        kwitansi,
      });
      setDocumentId(result.document.id);
      setDocuments((current) => [result.document, ...current.filter((d) => d.id !== result.document.id)]);
      setSaved(true);
      toast('success', 'Dokumen Draft tersimpan.');
    } catch (err) {
      toast('error', errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = async () => {
    if (user?.role === 'observer') return;
    if (saving) return;
    if (!documentId) return;
    setSaving(true);
    try {
      const result = await updateDocument(documentId, {
        salesman: sales.name,
        product: sales.product || '',
        period: toApiPeriod(period),
        wilayah: sales.region || null,
        divisi: sales.divisi || null,
        insentif_total: insentifTotal,
        golongan_rows: buildGolonganRows(),
        criteria_rows: buildCriteriaRows(),
        kwitansi,
      });
      setDocuments((current) => current.map((d) => d.id === result.document.id ? result.document : d));
      setSaved(true);
      toast('success', 'Dokumen terupdate.');
    } catch (err) {
      toast('error', errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const submitForApproval = async () => {
    if (!['observer', 'superadmin'].includes(user?.role)) return;
    if (!documentId) return;
    try {
      const result = await finalizeDocument(documentId);
      setDocumentStatus(result.document.status);
      setDocuments((current) => current.map((d) => d.id === result.document.id ? { ...d, status: result.document.status } : d));
      toast('success', 'Dokumen dikirim untuk approval.');
    } catch (err) {
      toast('error', errMsg(err));
    }
  };

  const removeDocument = async (id) => {
    try {
      await deleteDocument(id);
      setDocuments((current) => current.filter((d) => String(d.id) !== String(id)));
      if (String(documentId) === String(id)) cancelEdit();
      toast('success', 'Dokumen dihapus.');
    } catch (err) {
      toast('error', errMsg(err));
    }
  };

  const loadDocument = async (doc) => {
    // Dokumen SPV punya halamannya sendiri (/documents/spv).
    if (doc.doc_kind === 'spv') { setSpvTargetId(doc.id); navigate('/documents/spv'); return; }
    try {
      const { document: full } = await getDocument(doc.id);
      setDocumentId(full.id);
      setDocumentStatus(full.status);
      setDocumentFormatId(full.format_id);
      setGolonganRows(
        full.golongan_rows?.length
          ? full.golongan_rows.map((row) => {
              let type = 'brand';
              let divisi = '';
              if (row.is_group) {
                const label = (row.label || '').toUpperCase();
                if (label.startsWith('TOTALDIVISI:')) {
                  type = 'total-divisi';
                  divisi = (row.label || '').slice(12);
                }
                else if (label.startsWith('DIVISI:')) {
                  type = 'divisi';
                  divisi = (row.label || '').slice(7);
                }
                else if (label.includes('TOTAL DIVISI')) type = 'total-divisi';
                else if (label === 'TOTAL') type = 'total';
                else type = 'principal';
              }
              return makeRow({
                label: row.label || '',
                divisi,
                isGroup: !!row.is_group,
                type,
                target: row.target ?? '',
                achievement: row.achievement ?? '',
              });
            })
          : [makeRow({ label: '', target: '', achievement: '', type: 'brand', isGroup: false })]
      );
      setCriteriaRows(
        full.criteria_rows?.length
          ? full.criteria_rows.map((row) => ({
              criteria_id: row.criteria_id,
              label: row.label,
              target_value: row.target_value ?? '',
              achievement_value: row.achievement_value ?? '',
              percentage_value: row.percentage_value ?? '',
              incentive_amount: row.incentive_amount ?? '',
            }))
          : criteria.map((c) => ({ criteria_id: c.id, label: c.label, target_value: '', achievement_value: '', percentage_value: '', incentive_amount: '' }))
      );
      setSales({ ...INITIAL_SALES, name: full.salesman || '', product: full.product || '', region: full.wilayah || '', divisi: full.divisi || '' });
      setPeriod(fromApiPeriod(full.period));
      setInsentifTotal(full.insentif_total ?? null);
      setKwitansi({
        penerima: full.kwitansi?.penerima || 'PT. BINTANG SINAR JAYA',
        jumlahUang: full.kwitansi?.jumlahUang || '',
        keterangan: full.kwitansi?.keterangan || '',
        terbilang: full.kwitansi?.terbilang || '',
        nominal: full.kwitansi?.nominal || '',
      });
      setSaved(true);
    } catch (err) {
      toast('error', errMsg(err));
    }
  };

  const cancelEdit = () => {
    setDocumentId(null);
    setDocumentStatus('Draft');
    setGolonganRows([makeRow({ label: '', target: '', achievement: '', type: 'brand', isGroup: false })]);
    setCriteriaRows(criteria.map((c) => ({ criteria_id: c.id, label: c.label, target_value: '', achievement_value: '', percentage_value: '', incentive_amount: '' })));
    setSales(INITIAL_SALES);
    setPeriod(currentPeriodLabel());
    setInsentifTotal(null);
    setKwitansi({ penerima: 'PT. BINTANG SINAR JAYA', jumlahUang: '', keterangan: '', terbilang: '', nominal: '' });
    setSaved(false);
  };

  const renderDocuments = (type) => (
    <Layout breadcrumb={['Dokumen', type === 'sales' ? 'Sales' : type.toUpperCase()]}>
      <Suspense fallback={<div className="auth-shell" role="status">Memuat…</div>}>
      <Documents
        docType={type}
        user={user}
        documents={documents}
        onRefresh={listDocuments}
        setDocuments={setDocuments}
        onCreate={saveDraft}
        onUpdate={updateDraft}
        onSubmit={submitForApproval}
        onLoad={loadDocument}
        onCancel={cancelEdit}
        documentId={documentId}
        golonganRows={golonganRows}
        updateGolonganRow={updateGolonganRow}
        removeGolonganRow={removeGolonganRow}
        addGolonganRow={addGolonganRow}
        reorderGolonganRow={reorderGolonganRow}
        criteria={criteria}
        criteriaRows={criteriaRows}
        updateCriteriaRow={updateCriteriaRow}
        updateSales={updateSales}
        sales={sales}
        period={period}
        setPeriod={setPeriod}
        kwitansi={kwitansi}
        setKwitansi={setKwitansi}
        insentifTotal={insentifTotal}
        setInsentifTotal={setInsentifTotal}
        documentStatus={documentStatus}
        saved={saved}
        salesDivisi={sales.divisi}
        setSalesDivisi={(v) => updateSales('divisi', v)}
        masterData={adminData.masterData}
        positions={positions}
      />
      </Suspense>
    </Layout>
  );

  if (authLoading) return <div className="auth-shell" role="status">Memuat sesi...</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          user ? (
            <Layout breadcrumb={['Dashboard']}>
              <Suspense fallback={<div className="auth-shell" role="status">Memuat…</div>}>
              <Dashboard
                documents={documents}
                user={user}
                positions={positions}
                users={adminData.users}
                period={period}
                setPeriod={setPeriod}
                onNewDoc={() => { cancelEdit(); navigate('/documents'); }}
                onLoadDoc={(doc) => { loadDocument(doc); navigate('/documents'); }}
              />
              </Suspense>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/insetif"
        element={
          user ? (
            <Layout title="Dokumen Tersimpan" breadcrumb={['Dokumen Tersimpan']}>
              <Suspense fallback={<div className="auth-shell" role="status">Memuat…</div>}>
              <Insetif
                documents={documents}
                setDocuments={setDocuments}
                onRefresh={listDocuments}
                positions={positions}
                onLoad={(doc) => { loadDocument(doc); navigate('/documents'); }}
                onDelete={removeDocument}
                onNewDoc={() => { cancelEdit(); navigate('/documents'); }}
              />
              </Suspense>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/documents"
        element={<Navigate to="/documents/sales" replace />}
      />
      <Route
        path="/documents/sales"
        element={user ? renderDocuments('sales') : <Navigate to="/login" replace />}
      />
      <Route
        path="/documents/spv"
        element={user ? (
          <Layout breadcrumb={['Dokumen', 'SPV']}>
            <Suspense fallback={<div className="auth-shell" role="status">Memuat…</div>}>
              <SpvDocument
                user={user}
                positions={positions}
                masterData={adminData.masterData}
                setDocuments={setDocuments}
                documentFormatId={documentFormatId}
                loadTargetId={spvTargetId}
                onLoadDone={() => setSpvTargetId(null)}
              />
            </Suspense>
          </Layout>
        ) : <Navigate to="/login" replace />}
      />
      <Route
        path="/documents/bm"
        element={user ? renderDocuments('bm') : <Navigate to="/login" replace />}
      />
      <Route
        path="/master"
        element={
          user && canManageAdmin(user) ? (
            <Layout title="Data Master" breadcrumb={['Data Master']}>
              <Suspense fallback={<div className="auth-shell" role="status">Memuat…</div>}>
              <Master data={adminData} onRefresh={reloadAdminData} user={user} />
              </Suspense>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/admin" element={<Navigate to="/master" replace />} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
