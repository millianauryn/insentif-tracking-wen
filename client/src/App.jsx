import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { createDocument, updateDocument, finalizeDocument, getDocument, listCriteria, listDocumentFormats, listDocuments, listUsers, listMasterData } from './api';
import { canManageAdmin } from './access';
import { useAuth } from './context/AuthContext';
import { useToast } from './components/Toast';
import { errMsg } from './lib/api';
import { reorder } from './lib/reorder';
import { toApiPeriod, fromApiPeriod, currentPeriodLabel } from './lib/period';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Insetif from './pages/Insetif';
import Documents from './pages/Documents';
import Master from './pages/Master';
import Login from './pages/Login';
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
  const [documentStatus, setDocumentStatus] = useState('Draft');
  const [adminData, setAdminData] = useState({ users: [], criteria: [], masterData: { divisions: [], principals: [], brands: [], regions: [], branches: [] } });
  const [period, setPeriod] = useState(currentPeriodLabel());
  const [saved, setSaved] = useState(false);
  const [insentifTotal, setInsentifTotal] = useState(null); // null = auto-sum of kriteria incentives
  const [kwitansi, setKwitansi] = useState({
    penerima: 'PT. BINTANG SINAR JAYA',
    jumlahUang: '',
    keterangan: '',
    terbilang: '',
    nominal: '',
  });

  const reloadAdminData = useCallback(async () => {
    if (!user) return;
    try {
      const [{ users }, { criteria: crit }, { divisions, principals, brands, regions, branches }] = await Promise.all([listUsers(), listCriteria(), listMasterData()]);
      setAdminData({ users, criteria: crit, masterData: { divisions, principals, brands, regions, branches } });
    } catch (err) {
      toast('error', errMsg(err));
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) return;
    Promise.all([listDocumentFormats(), listDocuments(), listCriteria()])
      .then(([{ formats }, { documents: next }, { criteria: crit }]) => {
        setDocumentFormatId(formats[0]?.id ?? null);
        setDocuments(next);
        setCriteria(crit);
        setCriteriaRows(crit.map((c) => ({ criteria_id: c.id, label: c.label, target_value: '', achievement_value: '', percentage_value: '', incentive_amount: '' })));
        if (canManageAdmin(user)) return reloadAdminData();
      })
      .catch((err) => toast('error', errMsg(err)));
  }, [user, toast, reloadAdminData]);

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
    const isGroup = type === 'principal' || type === 'total-divisi' || type === 'total';
    const label = type === 'total-divisi' ? 'TOTAL DIVISI' : type === 'total' ? 'TOTAL' : '';
    const row = makeRow({ label, isGroup, type, target: '', achievement: '' });
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
    const filtered = golonganRows.filter((row) => row.label || row.target || row.achievement);
    let lastPrincipalIndex;
    return filtered.map((row, index) => {
      const result = {
        label: row.label || null,
        is_group: row.isGroup || false,
        target: row.target !== undefined && row.target !== '' ? Number(row.target) : null,
        achievement: row.achievement !== undefined && row.achievement !== '' ? Number(row.achievement) : null,
        sort_order: index,
      };
      // Only principal rows act as parents (divisi type removed)
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
        target_value: row.target_value != null && row.target_value !== '' ? Number(row.target_value) : null,
        achievement_value: row.achievement_value != null && row.achievement_value !== '' ? Number(row.achievement_value) : null,
        percentage_value:
          row.percentage_value != null && row.percentage_value !== '' ? Number(row.percentage_value) : null,
        incentive_amount: row.incentive_amount != null && row.incentive_amount !== '' ? Number(row.incentive_amount) : null,
      }));

  const saveDraft = async () => {
    if (user?.role === 'observer') return;
    if (!documentFormatId) {
      toast('error', 'Format dokumen belum tersedia.');
      return;
    }
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
    }
  };

  const updateDraft = async () => {
    if (user?.role === 'observer') return;
    if (!documentId) return;
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
    }
  };

  const submitForApproval = async () => {
    if (user?.role === 'observer') return;
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

  const loadDocument = async (doc) => {
    try {
      const { document: full } = await getDocument(doc.id);
      setDocumentId(full.id);
      setDocumentStatus(full.status);
      setDocumentFormatId(full.format_id);
      setGolonganRows(
        full.golongan_rows?.length
          ? full.golongan_rows.map((row) => {
              let type = 'brand';
              if (row.is_group) {
                const label = (row.label || '').toUpperCase();
                if (label.includes('TOTAL DIVISI')) type = 'total-divisi';
                else if (label === 'TOTAL') type = 'total';
                else type = 'principal';
              }
              return makeRow({
                label: row.label || '',
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
      />
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
              <Dashboard
                documents={documents}
                user={user}
                period={period}
                setPeriod={setPeriod}
                onNewDoc={() => { cancelEdit(); navigate('/documents'); }}
                onLoadDoc={(doc) => { loadDocument(doc); navigate('/documents'); }}
              />
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
            <Layout title="Insetif" breadcrumb={['Insetif']}>
              <Insetif
                documents={documents}
                setDocuments={setDocuments}
                onRefresh={listDocuments}
                onLoad={(doc) => { loadDocument(doc); navigate('/documents'); }}
                onNewDoc={() => { cancelEdit(); navigate('/documents'); }}
              />
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
        element={user ? renderDocuments('spv') : <Navigate to="/login" replace />}
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
              <Master data={adminData} onRefresh={reloadAdminData} user={user} />
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
