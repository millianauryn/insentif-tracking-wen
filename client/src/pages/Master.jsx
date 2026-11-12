import { useRef, useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import {
  createDivision, updateDivision, deleteDivision,
  createPrincipal, updatePrincipal, deletePrincipal,
  createBrand, updateBrand, deleteBrand,
  createRegion, updateRegion, deleteRegion,
  createBranch, updateBranch, deleteBranch,
  createUser, updateUser, deleteUser, updateCriteria,
  listPositions, createPosition, updatePosition, deletePosition, listCriteria,
} from '../api';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import PickerChips from '../components/PickerChips';
import { useConfirm } from '../components/Confirm';

const EMPTY_MASTER = { divisions: [], principals: [], brands: [], regions: [], branches: [] };

// Pilihan icon akun (superadmin pilih saat buat/edit akun): emoji; kosong → inisial nama
const AVATAR_EMOJIS = ['😀', '😎', '🤠', '🥳', '😇', '🐱', '🐰', '🦊', '🐻', '🐼', '🐸', '🦁', '🐯', '🐮', '🐵', '🐶', '🦉', '🦄', '🐙', '🦋', '🌸', '⭐', '🔥', '💚'];
const AVATAR_COLORS = ['#5C786C', '#0C5848', '#7EA796', '#E11D48', '#F59E0B', '#3B82F6', '#8B5CF6', '#111827'];

function InlinePrincipalForm({ division, draft, busy, existing, onChange, onSubmit }) {
  const pick = existing.find((p) => p.name === draft.name);
  return (
    <form
      className="mt-3 px-1 space-y-2"
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
    >
      <div>
        <label className="label">Principal (pilih yg sudah ada atau ketik baru) *</label>
        <input className="input" value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={`Principal untuk ${division.name}`} required list={`principals-${division.id}`} />
        <datalist id={`principals-${division.id}`}>
          {existing.map((p) => <option key={p.id} value={p.name}>{p.code ? `${p.code} · ${p.address || ''}` : (p.address || '')}</option>)}
        </datalist>
        {pick && <p className="text-[11px] text-ink-400 mt-1">Tautan: {pick.name}{pick.code ? ` · ${pick.code}` : ''} → divisi {division.name}</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <label className="label">Kode</label>
          <input className="input" value={draft.code} onChange={(e) => onChange({ code: e.target.value })} placeholder="Kode" />
        </div>
        <Button type="submit" size="sm" disabled={busy || !draft.name.trim()}>
          {busy ? 'Menyimpan…' : `+ Principal`}
        </Button>
      </div>
    </form>
  );
}

export default function Master({ data, onRefresh, user }) {
  const confirm = useConfirm();
  const [tab, setTab] = useState('division');
  const [masterForm, setMasterForm] = useState(null);
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterSearch, setMasterSearch] = useState('');
  const [masterPage, setMasterPage] = useState(1);
  const [masterLimit, setMasterLimit] = useState(10);
  const [expandedDivisions, setExpandedDivisions] = useState(new Set());
  const [expandedBranches, setExpandedBranches] = useState(new Set());
  const [inlinePrincipal, setInlinePrincipal] = useState({}); // divisionId -> {name, code, busy}

  // Akun tab state
  const [form, setForm] = useState({ username: '', password: '', role: 'officer', branch_ids: [], avatar_key: '', avatar_color: AVATAR_COLORS[0] });
  const [editingUser, setEditingUser] = useState(null);
const [createUserOpen, setCreateUserOpen] = useState(false);
  const [userError, setUserError] = useState('');
  const usernameRef = useRef(null);

  // Jabatan User tab state
  const [positions, setPositions] = useState([]);
  const [posForm, setPosForm] = useState(null); // null = closed, { _isNew, id, name, position_type, join_date, parent_position_id, branch_ids, criteria_ids }
  const [posError, setPosError] = useState('');
  const [posBusy, setPosBusy] = useState(false);
  const [criteria, setCriteria] = useState([]); // criteria_definitions for position assignment

  const masterData = data?.masterData || EMPTY_MASTER;

  // Load positions + criteria when tab is active
  useEffect(() => {
    if (tab === 'positions') {
      Promise.all([listPositions(), listCriteria()])
        .then(([r, c]) => { setPositions(r.positions || []); setCriteria(c.criteria || []); })
        .catch(() => { setPositions([]); setCriteria([]); });
    }
    if (tab === 'users') {
      listPositions().then((r) => setPositions(r.positions || [])).catch(() => setPositions([]));
    }
  }, [tab]);

  const masterTabs = [
    { key: 'division', label: 'Divisi', icon: <Icon><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></Icon> },
    { key: 'principal', label: 'Principal', icon: <Icon><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/></Icon> },
    { key: 'brand', label: 'Brand', icon: <Icon><path d="M4 5h16v14H4z"/><path d="M8 10h8M8 14h5"/></Icon> },
    { key: 'region', label: 'Region', icon: <Icon><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></Icon> },
    { key: 'branch', label: 'Cabang', icon: <Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Icon> },
    { key: 'positions', label: 'Jabatan User', icon: <Icon><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></Icon> },
    { key: 'users', label: 'Akun', icon: <Icon><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></Icon> },
    { key: 'criteria', label: 'Kriteria Dokumen', icon: <Icon><path d="M4 5h16v14H4z"/><path d="M8 10h8M8 14h5"/></Icon> },
  ];

  const plural = { division: 'divisions', principal: 'principals', brand: 'brands', region: 'regions', branch: 'branches' };
  const getItems = (key) => masterData[plural[key] ?? `${key}s`] || [];
  const getActiveItems = (key) => getItems(key).filter((item) => item.is_active !== 0 && item.active !== 0);

  const isMasterTab = ['division', 'principal', 'brand', 'region', 'branch'].includes(tab);

  const filteredItems = getItems(tab).filter((item) =>
    item.name.toLowerCase().includes(masterSearch.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(masterSearch.toLowerCase()))
  );
  const totalPages = Math.ceil(filteredItems.length / masterLimit) || 1;
  const pagedItems = filteredItems.slice((masterPage - 1) * masterLimit, masterPage * masterLimit);

  const openCreateForm = (key) => {
    const defaults = {
      division: { name: '', code: '' },
      principal: { name: '', code: '', address: '', division_id: '' },
      brand: { principal_id: '', name: '' },
      region: { name: '' },
      branch: { name: '', code: '', address: '', city: '', region_id: '', division_id: '' },
    };
    setMasterForm({ ...defaults[key], _tab: key, _isNew: true });
    setMasterPage(1);
    setMasterSearch('');
  };

  const openEditForm = (item, key) => {
    setMasterForm({ ...item, _tab: key, _isNew: false });
    setMasterPage(1);
    setMasterSearch('');
  };

  const closeMasterForm = () => setMasterForm(null);

  const handleMasterFormChange = (field, value) => {
    setMasterForm((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const saveMasterForm = async (e) => {
    e.preventDefault();
    if (!masterForm || masterBusy) return;
    setMasterBusy(true);
    setUserError('');
    try {
      const { _tab, _isNew, id, ...payload } = masterForm;
      if (_tab === 'division') {
        if (_isNew) await createDivision({ name: payload.name.trim(), code: payload.code?.trim() || null });
        else await updateDivision(id, { name: payload.name.trim(), code: payload.code?.trim() || null, is_active: payload.is_active ? 1 : 0 });
      } else if (_tab === 'principal') {
        if (_isNew) await createPrincipal({ name: payload.name.trim(), code: payload.code?.trim() || null, address: payload.address?.trim() || null, division_id: payload.division_id ? Number(payload.division_id) : null });
        else await updatePrincipal(id, { name: payload.name.trim(), code: payload.code?.trim() || null, address: payload.address?.trim() || null, division_id: payload.division_id ? Number(payload.division_id) : null, is_active: payload.is_active ? 1 : 0 });
      } else if (_tab === 'brand') {
        if (_isNew) await createBrand({ principal_id: Number(payload.principal_id), name: payload.name.trim() });
        else await updateBrand(id, { principal_id: Number(payload.principal_id), name: payload.name.trim(), is_active: payload.is_active ? 1 : 0 });
      } else if (_tab === 'region') {
        if (_isNew) await createRegion({ name: payload.name.trim() });
        else await updateRegion(id, { name: payload.name.trim(), is_active: payload.is_active ? 1 : 0 });
      } else if (_tab === 'branch') {
        const divisionIds = (payload.division_ids || []).map(Number);
        const regionIds = (payload.region_ids || []).map(Number);
        if (_isNew) await createBranch({ name: payload.name.trim(), code: payload.code?.trim() || null, address: payload.address?.trim() || null, city: payload.city?.trim() || null, division_ids: divisionIds, region_ids: regionIds });
        else await updateBranch(id, { name: payload.name.trim(), code: payload.code?.trim() || null, address: payload.address?.trim() || null, city: payload.city?.trim() || null, division_ids: divisionIds, region_ids: regionIds, is_active: payload.is_active ? 1 : 0 });
      }
      closeMasterForm();
      await onRefresh();
    } catch (requestError) {
      setUserError(requestError.message);
    } finally {
      setMasterBusy(false);
    }
  };

  const deleteMasterItem = async (id, key) => {
    if (!window.confirm('Hapus data ini?')) return;
    setUserError('');
    try {
      if (key === 'division') await deleteDivision(id);
      else if (key === 'principal') await deletePrincipal(id);
      else if (key === 'brand') await deleteBrand(id);
      else if (key === 'region') await deleteRegion(id);
      else if (key === 'branch') await deleteBranch(id);
      await onRefresh();
    } catch (requestError) {
      setUserError(requestError.message);
    }
  };

  const toggleActive = async (item, key) => {
    setUserError('');
    try {
      const nextActive = item.is_active ? 0 : 1;
      if (key === 'division') await updateDivision(item.id, { is_active: nextActive });
      else if (key === 'principal') await updatePrincipal(item.id, { is_active: nextActive });
      else if (key === 'brand') await updateBrand(item.id, { is_active: nextActive });
      else if (key === 'region') await updateRegion(item.id, { is_active: nextActive });
      else if (key === 'branch') await updateBranch(item.id, { is_active: nextActive });
      await onRefresh();
    } catch (requestError) {
      setUserError(requestError.message);
    }
  };

  // ---------- Akun tab ----------
  const resetUserForm = () => setForm({ username: '', password: '', role: 'officer', branch_ids: [], avatar_key: '', avatar_color: AVATAR_COLORS[0] });

  const cancelEdit = () => {
    setEditingUser(null);
    setCreateUserOpen(false);
    resetUserForm();
    setUserError('');
    usernameRef.current?.blur();
  };

  const submitUser = async (event) => {
    event.preventDefault();
    if (masterBusy) return;
    if (form.role === 'officer' && form.branch_ids.length === 0) {
      setUserError('Wajib pilih minimal satu cabang untuk Officer.');
      return;
    }
    setMasterBusy(true);
    setUserError('');
    try {
      const payload = {
        username: form.username.trim().toLowerCase(),
        role: form.role,
        branch_ids: form.branch_ids.map(Number),
        avatar_key: form.avatar_key || null,
        avatar_color: form.avatar_color || AVATAR_COLORS[0]
      };
      if (editingUser) {
        await updateUser(editingUser.id, { ...payload, password: form.password || undefined });
        setEditingUser(null);
      } else {
        await createUser({ ...payload, password: form.password });
      }
      resetUserForm();
      await onRefresh();
    } catch (requestError) {
      setUserError(requestError.message);
    } finally {
      setMasterBusy(false);
    }
  };

  const startEdit = (target) => {
    setEditingUser({ id: target.id, username: target.username, role: target.role });
    setForm({
      username: target.username,
      password: '',
      role: target.role,
      branch_ids: (target.branch_ids || []).map(Number),
      avatar_key: target.avatar_key || '',
      avatar_color: target.avatar_color || AVATAR_COLORS[0]
    });
    setUserError('');
    usernameRef.current?.focus();
    usernameRef.current?.scrollIntoView({ block: 'center' });
  };

  const removeUser = async (id) => {
    setUserError('');
    if (id === user.id) {
      setUserError('Tidak bisa menghapus akun sendiri.');
      return;
    }
    const target = data.users.find((u) => u.id === id);
    const ok = await confirm({
      title: 'Hapus akun',
      message: `Hapus akun ${target?.username}? Akun yang dihapus tidak bisa dikembalikan.`,
      confirmLabel: 'Hapus',
      cancelLabel: 'Batal',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteUser(id);
      await onRefresh();
      if (editingUser?.id === id) cancelEdit();
    } catch (requestError) {
      setUserError(requestError.message);
    }
  };

  const saveCriteria = async (criterion, label) => {
    try {
      await updateCriteria(criterion.id, { label });
      await onRefresh();
    } catch (requestError) {
      setUserError(requestError.message);
    }
  };

  // ---------- Jabatan User (positions) ----------
  const openPosForm = (item = null) => {
    setPosError('');
    if (item) {
      setPosForm({ _isNew: false, id: item.id, name: item.name, sales_code: item.sales_code || '', position_type: item.position_type, join_date: item.join_date || '', parent_position_id: item.parent_position_id || '', branch_ids: item.branch_ids || [], criteria_ids: item.criteria_ids || [] });
    } else {
      setPosForm({ _isNew: true, name: '', sales_code: '', position_type: 'BM', join_date: '', parent_position_id: '', branch_ids: [], criteria_ids: [] });
    }
  };

  const closePosForm = () => setPosForm(null);

  const savePosForm = async (e) => {
    e.preventDefault();
    if (!posForm || posBusy) return;
    setPosBusy(true);
    setPosError('');
    try {
      const payload = {
        name: posForm.name.trim(),
        sales_code: posForm.sales_code.trim() || undefined,
        position_type: posForm.position_type,
        join_date: posForm.join_date || null,
        parent_position_id: posForm.parent_position_id ? Number(posForm.parent_position_id) : null,
        branch_ids: posForm.branch_ids.map(Number),
        criteria_ids: posForm.criteria_ids.map(Number),
      };
      if (posForm._isNew) await createPosition(payload);
      else await updatePosition(posForm.id, payload);
      closePosForm();
      const r = await listPositions();
      setPositions(r.positions || []);
    } catch (requestError) {
      setPosError(requestError.message);
    } finally {
      setPosBusy(false);
    }
  };

  const removePosition = async (id) => {
    setPosError('');
    if (!window.confirm('Hapus jabatan ini?')) return;
    try {
      await deletePosition(id);
      const r = await listPositions();
      setPositions(r.positions || []);
    } catch (requestError) {
      setPosError(requestError.message);
    }
  };

  // Get filtered parent options based on position_type
  const getParentOptions = (type) => {
    if (type === 'SPV') return positions.filter((p) => p.position_type === 'BM' && p.active);
    if (type === 'SALES') return positions.filter((p) => p.position_type === 'SPV' && p.active);
    return [];
  };

  // ---------- Master list rendering ----------
  const activeItems = {
    division: getActiveItems('division'),
    principal: getActiveItems('principal'),
    brand: getActiveItems('brand'),
    region: getActiveItems('region'),
    branch: getActiveItems('branch'),
  };

  const branchItems = masterData.branches
    .filter((b) => b.is_active !== 0 && b.active !== 0)
    .map((b) => ({ id: b.id, name: b.name, subtitle: masterData.regions.find((r) => r.id === b.region_id)?.name || '' }));

  const tabConfig = {
    division: {
      title: 'Divisi',
      desc: 'Kelola divisi untuk pengelompokan cabang dan principal.',
      createLabel: 'Tambah Divisi',
      fields: (form) => (
        <>
          <div>
            <label className="label">Nama Divisi *</label>
            <input className="input" value={form.name} onChange={(e) => handleMasterFormChange('name', e.target.value)} required placeholder="Contoh: Pulau Baru" />
          </div>
          <div>
            <label className="label">Kode</label>
            <input className="input" value={form.code || ''} onChange={(e) => handleMasterFormChange('code', e.target.value)} placeholder="Contoh: PB" maxLength={10} />
          </div>
          {form._isNew ? null : (
            <label className="akun-toggle flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <Checkbox checked={!!form.is_active} onCheckedChange={(value) => handleMasterFormChange('is_active', value)} />
              Aktif
            </label>
          )}
        </>
      ),
    },
    principal: {
      title: 'Principal / Pabrik',
      desc: 'Daftar prinsipal/pabrik yang muncul di dropdown saat input program.',
      createLabel: 'Tambah Principal',
      fields: (form) => (
        <>
          <div>
            <label className="label">Nama *</label>
            <input className="input" value={form.name} onChange={(e) => handleMasterFormChange('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Kode</label>
            <input className="input" value={form.code || ''} onChange={(e) => handleMasterFormChange('code', e.target.value)} />
          </div>
          <div>
            <label className="label">Divisi</label>
            <select className="input" value={form.division_id || ''} onChange={(e) => handleMasterFormChange('division_id', e.target.value)}>
              <option value="">- Tanpa Divisi -</option>
              {activeItems.division.map((d) => <option key={d.id} value={d.id}>{d.code ? `${d.code} · ${d.name}` : d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Alamat</label>
            <input className="input" value={form.address || ''} onChange={(e) => handleMasterFormChange('address', e.target.value)} />
          </div>
          {form._isNew ? null : (
            <label className="akun-toggle flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <Checkbox checked={!!form.is_active} onCheckedChange={(value) => handleMasterFormChange('is_active', value)} />
              Aktif (muncul di dropdown)
            </label>
          )}
        </>
      ),
    },
    brand: {
      title: 'Brand',
      desc: 'Brand per principal untuk detail dokumen insentif.',
      createLabel: 'Tambah Brand',
      fields: (form) => (
        <>
          <div>
            <label className="label">Principal *</label>
            <select className="input" value={form.principal_id || ''} onChange={(e) => handleMasterFormChange('principal_id', e.target.value)} required>
              <option value="">Pilih principal</option>
              {activeItems.principal.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nama Brand *</label>
            <input className="input" value={form.name} onChange={(e) => handleMasterFormChange('name', e.target.value)} required />
          </div>
          {form._isNew ? null : (
            <label className="akun-toggle flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <Checkbox checked={!!form.is_active} onCheckedChange={(value) => handleMasterFormChange('is_active', value)} />
              Aktif
            </label>
          )}
        </>
      ),
    },
    region: {
      title: 'Area / Region',
      desc: 'Daftar Parent Area / Region.',
      createLabel: 'Tambah Area',
      fields: (form) => (
        <>
          <div>
            <label className="label">Nama Area *</label>
            <input className="input" value={form.name} onChange={(e) => handleMasterFormChange('name', e.target.value)} required />
          </div>
          {form._isNew ? null : (
            <label className="akun-toggle flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <Checkbox checked={!!form.is_active} onCheckedChange={(value) => handleMasterFormChange('is_active', value)} />
              Aktif
            </label>
          )}
        </>
      ),
    },
    branch: {
      title: 'Cabang / Distribusi',
      desc: 'Daftar Cabang / Distribusi per Area.',
      createLabel: 'Tambah Cabang',
      fields: (form) => (
        <>
          <div>
            <label className="label">Nama Cabang *</label>
            <input className="input" value={form.name} onChange={(e) => handleMasterFormChange('name', e.target.value)} required />
          </div>
          <div className="col-span-2">
            <PickerChips
              label="Divisi"
              hint="(opsional)"
              variant="inline"
              searchPlaceholder="Cari divisi..."
              items={activeItems.division.map((d) => ({ id: d.id, name: d.code ? `${d.code} · ${d.name}` : d.name }))}
              selected={form.division_ids || (form.division_id ? [form.division_id] : [])}
              onChange={(ids) => handleMasterFormChange('division_ids', ids)}
            />
          </div>
          <div className="col-span-2">
            <PickerChips
              label="Area / Region"
              hint="(opsional)"
              variant="inline"
              searchPlaceholder="Cari area..."
              items={activeItems.region.map((r) => ({ id: r.id, name: r.name }))}
              selected={form.region_ids || (form.region_id ? [form.region_id] : [])}
              onChange={(ids) => handleMasterFormChange('region_ids', ids)}
            />
          </div>
          <div>
            <label className="label">Kode</label>
            <input className="input" value={form.code || ''} onChange={(e) => handleMasterFormChange('code', e.target.value)} />
          </div>
          <div>
            <label className="label">Kota / Wilayah</label>
            <input className="input" value={form.city || ''} onChange={(e) => handleMasterFormChange('city', e.target.value)} placeholder="Contoh: Kotabaru" />
          </div>
          <div>
            <label className="label">Alamat</label>
            <input className="input" value={form.address || ''} onChange={(e) => handleMasterFormChange('address', e.target.value)} />
          </div>
          {form._isNew ? null : (
            <label className="akun-toggle flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <Checkbox checked={!!form.is_active} onCheckedChange={(value) => handleMasterFormChange('is_active', value)} />
              Aktif
            </label>
          )}
        </>
      ),
    },
  };

  const config = tabConfig[tab];
  const items = pagedItems;

  const renderItem = (item) => {
    const isActive = item.is_active !== 0 && item.active !== 0;
    const statusText = isActive ? 'Aktif' : 'Nonaktif';
    const isDivisionExpanded = expandedDivisions.has(item.id);
    const isBranchExpanded = expandedBranches.has(item.id);

    let subtitle = '';
    let divisionPrincipals = [];
    let branchDivisions = item.divisions || [];
    let branchRegions = item.regions || [];

    if (tab === 'division') {
      divisionPrincipals = activeItems.principal.filter((p) => p.division_id === item.id);
      subtitle = `${item.code || ''}${divisionPrincipals.length ? ` · ${divisionPrincipals.length} Principal` : ''}`;
    } else if (tab === 'principal') {
      const division = activeItems.division.find((d) => d.id === item.division_id);
      subtitle = [item.code, item.address, division?.name].filter(Boolean).join(' · ');
    } else if (tab === 'brand') {
      const principal = activeItems.principal.find((p) => p.id === item.principal_id);
      subtitle = principal?.name || '';
    } else if (tab === 'branch') {
      const regionNames = branchRegions.map(r => r.name).join(', ');
      const divisionNames = branchDivisions.map(d => d.code ? `${d.code} · ${d.name}` : d.name).join(', ');
      subtitle = [item.code, item.city, item.address, regionNames || '—', divisionNames || '—'].filter(Boolean).join(' · ');
    }

    const hasDivisionPrincipals = tab === 'division' && divisionPrincipals.length > 0;
    const hasBranchRelations = tab === 'branch' && (branchDivisions.length > 0 || branchRegions.length > 0);

    return (
      <>
        <li
          key={item.id}
          className={`master-row-item ${hasDivisionPrincipals || hasBranchRelations ? 'clickable' : ''}`}
          onClick={(hasDivisionPrincipals || hasBranchRelations) ? () => {
            if (tab === 'division') {
              setExpandedDivisions((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                return next;
              });
            } else if (tab === 'branch') {
              setExpandedBranches((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                return next;
              });
            }
          } : undefined}
        >
          <span className={`master-dot ${isActive ? 'on' : ''}`} aria-hidden="true" />
          <div className="master-main">
            <p className="master-name">{item.name}</p>
            {subtitle && <p className="master-sub">{subtitle}</p>}
          </div>
          <Badge className={`status-pill ${isActive ? 'success' : 'muted'}`}>{statusText}</Badge>
          <div className="master-actions">
            {(hasDivisionPrincipals || hasBranchRelations) && (
              <span className="expand-icon" aria-hidden="true">
                <Icon size={16}>
                  <path d={ (tab === 'division' ? isDivisionExpanded : isBranchExpanded) ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6" }/>
                </Icon>
              </span>
            )}
            <button className="icon-action" onClick={(e) => { e.stopPropagation(); openEditForm(item, tab); }} aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`}>
              <Icon size={15}><path d="M12 20h9M19.5 14.5L16 11l7-7M21 3a2 2 0 0 1 2 2v9M5 15l4 4 9-9"/></Icon>
            </button>
            <button className="icon-action" onClick={(e) => { e.stopPropagation(); toggleActive(item, tab); }} aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${item.name}`} title={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${item.name}`}>
              <Icon size={15}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m15 9-6 6M9 9l6 6"/></Icon>
            </button>
            <button className="icon-action danger" onClick={(e) => { e.stopPropagation(); deleteMasterItem(item.id, tab); }} aria-label={`Hapus ${item.name}`} title={`Hapus ${item.name}`}>
              <Icon size={15}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Icon>
            </button>
          </div>
        </li>
        {tab === 'division' && isDivisionExpanded && divisionPrincipals.length > 0 && (
          <li key={`expand-${item.id}`} className="master-expand-row">
            <div className="master-expand-content">
              <div className="principal-mini-list">
                {divisionPrincipals.map((p) => {
                  const pActive = p.is_active !== 0 && p.active !== 0;
                  return (
                    <div key={p.id} className="principal-mini-item">
                      <span className={`mini-dot ${pActive ? 'on' : ''}`} aria-hidden="true" />
                      <div className="mini-main">
                        <span className="mini-name">{p.name}</span>
                        <span className="mini-meta">{p.code || ''}{p.address ? ` · ${p.address}` : ''}</span>
                      </div>
                      <Badge className={`status-pill ${pActive ? 'success' : 'muted'}`} size="sm">{pActive ? 'Aktif' : 'Nonaktif'}</Badge>
                    </div>
                  );
                })}
              </div>
              <InlinePrincipalForm
                division={item}
                existing={activeItems.principal}
                draft={inlinePrincipal[item.id] || { name: '', code: '' }}
                busy={inlinePrincipal[item.id]?.busy}
                onChange={(patch) => setInlinePrincipal((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || { name: '', code: '' }), ...patch } }))}
                onSubmit={async () => {
                  const draft = inlinePrincipal[item.id] || { name: '', code: '' };
                  if (!draft.name.trim()) return;
                  setInlinePrincipal((prev) => ({ ...prev, [item.id]: { ...draft, busy: true } }));
                  try {
                    const name = draft.name.trim();
                    const linked = activeItems.principal.find((p) => p.name.toLowerCase() === name.toLowerCase());
                    if (linked) {
                      // Tautan ke principal lama: perbarui division_id-nya (status aktif/nonaktif dibiarkan)
                      await updatePrincipal(linked.id, { name: linked.name, code: linked.code || draft.code?.trim() || null, address: linked.address || null, division_id: item.id });
                    } else {
                      await createPrincipal({ name, code: draft.code?.trim() || null, address: null, division_id: item.id });
                    }
                    setInlinePrincipal((prev) => ({ ...prev, [item.id]: { name: '', code: '' } }));
                    await onRefresh();
                  } catch (e) {
                    setUserError(e.message);
                  } finally {
                    setInlinePrincipal((prev) => ({ ...prev, [item.id]: { name: prev[item.id]?.name || '', code: prev[item.id]?.code || '', busy: false } }));
                  }
                }}
              />
            </div>
          </li>
        )}
        {tab === 'branch' && isBranchExpanded && (branchDivisions.length > 0 || branchRegions.length > 0) && (
          <li key={`expand-${item.id}`} className="master-expand-row">
            <div className="master-expand-content">
              {branchDivisions.length > 0 && (
                <div className="principal-mini-list">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1.5 px-1">Divisi</p>
                  {branchDivisions.map((d) => (
                    <div key={d.id} className="principal-mini-item">
                      <span className="mini-dot on" aria-hidden="true" />
                      <div className="mini-main">
                        <span className="mini-name">{d.code ? `${d.code} · ${d.name}` : d.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {branchRegions.length > 0 && (
                <div className="principal-mini-list">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1.5 px-1">Area / Region</p>
                  {branchRegions.map((r) => (
                    <div key={r.id} className="principal-mini-item">
                      <span className="mini-dot on" aria-hidden="true" />
                      <div className="mini-main">
                        <span className="mini-name">{r.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        )}
      </>
    );
  };

  // ---------- Akun section ----------
  const renderUserSection = () => (
    <>
      <section className="content-card info-card">
        <div className="section-heading heading-with-action">
          <div>
            <h2>Akun</h2>
            <p>Daftar akun aktif dan nonaktif.</p>
          </div>
          {!editingUser && !createUserOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" className="input flex-1 min-w-[200px]" placeholder="Cari username, role…" value={masterSearch} onChange={(e) => { setMasterSearch(e.target.value); setMasterPage(1); }} />
              <Button onClick={() => setCreateUserOpen(true)}>Tambah Akun</Button>
            </div>
          )}
        </div>
        {(createUserOpen || editingUser) && (
          <div className="modal-overlay" onClick={cancelEdit}>
            <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingUser ? 'Edit Akun' : 'Tambah Akun'}</h3>
                <button className="icon-button" onClick={cancelEdit} aria-label="Tutup"><Icon size={18}><path d="M18 6L6 18M6 6l12 12"/></Icon></button>
              </div>
              <form className="form-grid" onSubmit={submitUser}>
                <label>Username<input ref={usernameRef} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} pattern="[a-z ]*" title="Username harus huruf kecil" required /></label>
                <label>Password<input type="password" minLength={editingUser ? undefined : 6} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editingUser ? 'Biarkan kosong jika tidak diubah' : undefined} required={!editingUser} /></label>
                <label>Role *<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="officer">Officer</option><option value="observer">Observer</option><option value="superadmin">Super Admin</option></select></label>

                {/* Branch multi-select (searchable) */}
                <div className="col-span-2">
                  <PickerChips
                    label="Cabang yang diurus"
                    hint={form.role === 'officer' ? '(minimal 1)' : ''}
                    required={form.role === 'officer'}
                    variant="inline"
                    searchPlaceholder="Cari cabang... (mis. Banjarmasin, Kapuas)"
                    items={branchItems}
                    selected={form.branch_ids}
                    onChange={(ids) => setForm({ ...form, branch_ids: ids })}
                  />
                  {form.role === 'officer' && form.branch_ids.length === 0 && (
                    <p className="text-[12px] text-rose-600 mt-1 font-semibold">Wajib pilih minimal satu cabang untuk Officer.</p>
                  )}
                </div>

                {/* Icon akun: superadmin pilih emoji + warna; kosong → inisial nama */}
                <div className="col-span-2">
                  <span className="text-[13px] font-semibold">Icon Akun</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5" role="group" aria-label="Pilih emoji">
                    {AVATAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={`Icon ${emoji}`}
                        aria-pressed={form.avatar_key === emoji}
                        onClick={() => setForm({ ...form, avatar_key: form.avatar_key === emoji ? '' : emoji })}
                        className={`h-8 w-8 rounded-full text-[15px] leading-none border transition ${form.avatar_key === emoji ? 'border-ink-900 ring-2 ring-ink-900/30' : 'border-black/10 hover:border-ink-400'}`}
                        style={{ background: form.avatar_color || AVATAR_COLORS[0] }}
                      >{emoji}</button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Warna ${color}`}
                        aria-pressed={(form.avatar_color || AVATAR_COLORS[0]) === color}
                        onClick={() => setForm({ ...form, avatar_color: color })}
                        className={`h-6 w-6 rounded-full border-2 ${(form.avatar_color || AVATAR_COLORS[0]) === color ? 'border-ink-900' : 'border-white'}`}
                        style={{ background: color, boxShadow: '0 0 0 1px var(--line, #e5e7eb)' }}
                      />
                    ))}
                  </div>
                  <p className="text-[12px] text-ink-400 mt-1">Tanpa emoji → tampil inisial nama otomatis (mis. "admin fb" → AF).</p>
                </div>

                {userError && <p className="form-error" role="alert">{userError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button className="text-button" type="button" onClick={cancelEdit}>Batal</button>
                  <Button className="button primary" type="submit" disabled={masterBusy}>{masterBusy ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Tambah Akun'}</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
      {userError && <p className="form-error" role="alert">{userError}</p>}
      <section className="content-card info-card">
        <div className="section-heading">
          <div>
            <h2>Akun</h2>
            <p>Daftar akun aktif dan nonaktif.</p>
          </div>
        </div>
        <div className="admin-list">
          {data.users.map((row) => (
            <div className="admin-row" key={row.id}>
              <Avatar name={row.username} color={row.avatar_color} emoji={row.avatar_key} size="sm" />
              <strong>{row.username}</strong>
              <span>{row.role}</span>
              <span className="text-[11px] text-ink-400">{(row.branch_ids || []).length} cabang</span>
              <span>{row.active ? 'Aktif' : 'Nonaktif'}</span>
              <button className="icon-button" type="button" aria-label={`Edit ${row.username}`} onClick={() => startEdit(row)}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button className="icon-button" type="button" aria-label={`Hapus ${row.username}`} onClick={() => removeUser(row.id)}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1-14H6L5 6"/></svg></button>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  // ---------- Jabatan User (positions) section ----------
  const renderPositionsSection = () => (
    <>
      <section className="content-card info-card">
        <div className="section-heading heading-with-action">
          <div>
            <h2>Jabatan User</h2>
            <p>Kelola jabatan BM, SPV, dan SALES dengan hierarki dan cabang.</p>
          </div>
          {!posForm && (
            <Button className="button primary" onClick={() => openPosForm()}>
              <Icon size={15}><path d="M12 5v14M5 12h14"/></Icon> Tambah Jabatan
            </Button>
          )}
        </div>

        {!posForm && (
          <div className="pos-branches">
            {positions.length ? (
              <>
                {(() => {
                  const shown = new Set();
                  const byBranchName = new Map();
                  positions.forEach((p) => {
                    if (shown.has(p.id)) return;
                    shown.add(p.id);
                    const branchIds = p.branch_ids || [];
                    const branch = branchIds.length > 0
                      ? masterData.branches.find((b) => b.id === branchIds[0]) || null
                      : null;
                    const name = branch ? branch.name : 'Tanpa Cabang';
                    if (!byBranchName.has(name)) byBranchName.set(name, []);
                    byBranchName.get(name).push({ p, branch });
                  });
                  return Array.from(byBranchName.entries()).map(([branchName, branchPositions]) => {
                    const collapsed = !expandedBranches.has(branchName);
                    const toggleBranch = () => {
                      const next = new Set(expandedBranches);
                      if (next.has(branchName)) next.delete(branchName);
                      else next.add(branchName);
                      setExpandedBranches(next);
                    };
                    return (
                      <div key={branchName} className={`pos-branch${collapsed ? '' : ' open'}`}>
                        <button type="button" className="pos-branch-head" onClick={toggleBranch} aria-expanded={!collapsed}>
                          <span className="pos-branch-chevron"><Icon size={16}><path d="M9 18l6-6-6-6" /></Icon></span>
                          <span className="pos-branch-name">{branchName}</span>
                          <span className="pos-branch-count">{branchPositions.length} jabatan</span>
                        </button>
                        {!collapsed && (
                          <div className="pos-branch-body">
                            {branchPositions.map(({ p, branch }) => {
                              const parent = positions.find((x) => x.id === p.parent_position_id);
                              return (
                                <div className="admin-row" key={p.id}>
                                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${p.position_type === 'BM' ? 'bg-blue-100 text-blue-700' : p.position_type === 'SPV' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.position_type}</span>
                                  <div className="min-w-0 flex-1">
                                    <strong>{p.sales_code ? `${p.sales_code} ${p.name}` : p.name}</strong>
                                    <p className="text-[11px] text-ink-400">{p.join_date ? `Masuk: ${new Date(p.join_date).toLocaleDateString('id-ID')}` : '–'}{parent ? ` · ← ${parent.name}` : ''}</p>
                                  </div>
                                  <button className="icon-button" type="button" aria-label={`Edit ${p.name}`} onClick={() => openPosForm(p)}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                                  <button className="icon-button" type="button" aria-label={`Hapus ${p.name}`} onClick={() => removePosition(p.id)}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1-14H6L5 6"/></svg></button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </>
            ) : <p className="text-center py-8 text-[13px] text-ink-400">Belum ada jabatan. Klik "Tambah Jabatan" untuk mulai.</p>}
          </div>
        )}
        {posForm && (
          <div className="modal-overlay" onClick={closePosForm}>
            <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{posForm._isNew ? 'Tambah Jabatan' : 'Edit Jabatan'}</h3>
                <button className="icon-button" onClick={closePosForm} aria-label="Tutup"><Icon size={18}><path d="M18 6L6 18M6 6l12 12"/></Icon></button>
              </div>
              <form onSubmit={savePosForm} className="space-y-3 p-4">
                <div>
                  <label className="text-[13px] font-semibold">Jabatan *</label>
                  <select className="input w-full mt-1" value={posForm.position_type} onChange={(e) => setPosForm({ ...posForm, position_type: e.target.value, parent_position_id: '' })} required>
                    <option value="BM">BM (Bisnis Manager)</option>
                    <option value="SPV">SPV (Supervisor)</option>
                    <option value="SALES">SALES</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-semibold">Nama *</label>
                  <input className="input w-full mt-1" value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} required placeholder="Nama lengkap" />
                </div>
                <div>
                  <label className="text-[13px] font-semibold">Tanggal Masuk *</label>
                  <input className="input w-full mt-1" type="date" value={posForm.join_date} onChange={(e) => setPosForm({ ...posForm, join_date: e.target.value })} required />
                </div>
                <div>
                  <label className="text-[13px] font-semibold">Kode Sales</label>
                  <input className="input w-full mt-1" value={posForm.sales_code || ''} onChange={(e) => setPosForm({ ...posForm, sales_code: e.target.value })} placeholder="Contoh: 11111" />
                </div>
                {posForm.position_type !== 'BM' && (
                  <div>
                    <label className="text-[13px] font-semibold">{posForm.position_type === 'SPV' ? 'Atasan BM' : 'Atasan SPV'} *</label>
                    <select className="input w-full mt-1" value={posForm.parent_position_id} onChange={(e) => setPosForm({ ...posForm, parent_position_id: e.target.value })} required>
                      <option value="">Pilih {posForm.position_type === 'SPV' ? 'BM' : 'SPV'}</option>
                      {getParentOptions(posForm.position_type).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.position_type})</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Branch multi-select for position (searchable) */}
                <div>
                  <PickerChips
                    label="Cabang / Distributor"
                    variant="inline"
                    searchPlaceholder="Cari cabang... (mis. Banjarmasin, Kapuas)"
                    items={branchItems}
                    selected={posForm.branch_ids}
                    onChange={(ids) => setPosForm({ ...posForm, branch_ids: ids })}
                  />
                </div>
                {/* Kriteria multi-select for position */}
                <div>
                  <label className="text-[13px] font-semibold">Kriteria Dokumen *</label>
                  <div className="flex gap-1.5 mt-1 mb-2">
                    <Button type="button" className="button secondary text-[11px] px-2 py-1" onClick={() => setPosForm({ ...posForm, criteria_ids: criteria.map((c) => c.id) })}>Semua</Button>
                    <Button type="button" className="button secondary text-[11px] px-2 py-1" onClick={() => setPosForm({ ...posForm, criteria_ids: [] })}>Kosongkan</Button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-2">
                    {criteria.map((c) => {
                      const checked = posForm.criteria_ids.includes(c.id);
                      return (
                        <label key={c.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] cursor-pointer transition ${checked ? 'bg-brand-50 border-brand-600 text-brand-800 font-semibold' : 'bg-white border-slate-200 text-ink-700 hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setPosForm({ ...posForm, criteria_ids: [...posForm.criteria_ids, c.id] }); else setPosForm({ ...posForm, criteria_ids: posForm.criteria_ids.filter((id) => id !== c.id) }); }} className="sr-only" />
                          {c.label} {c.target_unit ? <span className="text-[11px] text-ink-500">({c.target_unit})</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
                {posError && <p className="form-error" role="alert">{posError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" className="button" onClick={closePosForm}>Batal</Button>
                  <Button type="submit" className="button primary" disabled={posBusy}>{posBusy ? 'Menyimpan...' : 'Simpan'}</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </>
  );

  // ---------- Kriteria section ----------
  const renderCriteriaSection = () => (
    <section className="content-card info-card">
      <div className="section-heading">
        <div>
          <h2>Kriteria Dokumen</h2>
          <p>Label tersimpan sebagai snapshot saat Draft dibuat.</p>
        </div>
      </div>
      <div className="admin-list">
        {data.criteria.map((criterion) => (
          <div className="admin-row" key={criterion.id}>
            <input defaultValue={criterion.label} onBlur={(event) => event.target.value !== criterion.label && saveCriteria(criterion, event.target.value)} />
            <span>{criterion.target_unit || 'Unit'}</span>
            <span>{criterion.active ? 'Aktif' : 'Nonaktif'}</span>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <>
      {isMasterTab && !masterForm && userError && <p className="form-error" role="alert">{userError}</p>}

      <section className="content-card info-card">
        <div className="section-heading">
          <div>
            <h2>{config ? config.title : tab === 'users' ? 'Akun' : tab === 'positions' ? 'Jabatan User' : 'Kriteria Dokumen'}</h2>
            <p>{config ? config.desc : tab === 'users' ? 'Buat akun officer atau observer dengan akses cabang.' : tab === 'positions' ? 'Kelola jabatan BM, SPV, dan SALES.' : 'Label tersimpan sebagai snapshot saat Draft dibuat.'}</p>
          </div>
        </div>

        {isMasterTab && (
          <Tabs value={tab} onValueChange={(v) => { setTab(v); closeMasterForm(); }}>
            <TabsList className="master-tabs" aria-label="Sub-tab data master">
              {masterTabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className={tab === t.key ? 'active' : ''}>{t.icon} {t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {!isMasterTab && (
          <Tabs value={tab} onValueChange={(v) => { setTab(v); closeMasterForm(); }}>
            <TabsList className="master-tabs" aria-label="Sub-tab data master">
              {masterTabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className={tab === t.key ? 'active' : ''}>{t.icon} {t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {tab === 'users' ? renderUserSection() : tab === 'positions' ? renderPositionsSection() : tab === 'criteria' ? renderCriteriaSection() : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" className="input flex-1 min-w-[200px]" placeholder="Cari nama, kode, alamat…" value={masterSearch} onChange={(e) => { setMasterSearch(e.target.value); setMasterPage(1); }} />
              <Button className="button primary whitespace-nowrap" onClick={() => openCreateForm(tab)}>
                <Icon size={15}><path d="M12 5v14M5 12h14"/></Icon> {config.createLabel}
              </Button>
            </div>

            <ul className="master-table">
              <li className="master-table-head" aria-hidden="true">
                <span />
                <span>Nama</span>
                <span>Status</span>
                <span>Aksi</span>
              </li>
              {items.length ? items.map(renderItem) : (
                <li className="px-4 py-10 text-center text-[13px] text-ink-400">
                  {masterSearch ? 'Tidak ada data yang cocok dengan pencarian.' : 'Belum ada data.'}
                </li>
              )}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-500">
              <span>Halaman {masterPage} dari {totalPages} · Total {filteredItems.length} data</span>
              <div className="flex flex-wrap items-center gap-2">
                <select className="input w-auto" value={masterLimit} onChange={(e) => { setMasterLimit(Number(e.target.value)); setMasterPage(1); }}>
                  <option value={10}>10 per halaman</option>
                  <option value={25}>25 per halaman</option>
                  <option value={50}>50 per halaman</option>
                </select>
                <Button className="button pager-btn" disabled={masterPage <= 1} onClick={() => setMasterPage((p) => Math.max(1, p - 1))}>Sebelumnya</Button>
                <Button className="button pager-btn" disabled={masterPage >= totalPages} onClick={() => setMasterPage((p) => Math.min(totalPages, p + 1))}>Selanjutnya</Button>
              </div>
            </div>

            {masterForm && masterForm._tab === tab && (
              <div className="modal-overlay" onClick={closeMasterForm}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{masterForm._isNew ? `Tambah ${config.title}` : `Edit ${config.title}`}</h3>
                    <button className="icon-button" onClick={closeMasterForm} aria-label="Tutup"><Icon size={18}><path d="M18 6L6 18M6 6l12 12"/></Icon></button>
                  </div>
                  <form onSubmit={saveMasterForm} className="space-y-3 p-4">
                    {config.fields(masterForm)}
                    {userError && <p className="form-error" role="alert">{userError}</p>}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" className="button" onClick={closeMasterForm}>Batal</Button>
                      <Button type="submit" className="button primary" disabled={masterBusy}>{masterBusy ? 'Menyimpan...' : 'Simpan'}</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

