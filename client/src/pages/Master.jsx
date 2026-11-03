import { useRef, useState } from 'react';
import {
  createDivision, updateDivision, deleteDivision,
  createPrincipal, updatePrincipal, deletePrincipal,
  createBrand, updateBrand, deleteBrand,
  createRegion, updateRegion, deleteRegion,
  createBranch, updateBranch, deleteBranch,
  createUser, updateUser, deleteUser, updateCriteria,
} from '../api';
import Icon from '../components/Icon';

const EMPTY_MASTER = { divisions: [], principals: [], brands: [], regions: [], branches: [] };

export default function Master({ data, onRefresh, user }) {
  const [tab, setTab] = useState('division');
  const [masterForm, setMasterForm] = useState(null);
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterSearch, setMasterSearch] = useState('');
  const [masterPage, setMasterPage] = useState(1);
  const [masterLimit, setMasterLimit] = useState(10);

  // Pengguna tab state
  const [form, setForm] = useState({ username: '', password: '', role: 'officer', parent_id: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [userError, setUserError] = useState('');
  const usernameRef = useRef(null);

  const masterData = data?.masterData || EMPTY_MASTER;

  const masterTabs = [
    { key: 'division', label: 'Divisi', icon: <Icon><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></Icon> },
    { key: 'principal', label: 'Principal', icon: <Icon><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/></Icon> },
    { key: 'brand', label: 'Brand', icon: <Icon><path d="M4 5h16v14H4z"/><path d="M8 10h8M8 14h5"/></Icon> },
    { key: 'region', label: 'Region', icon: <Icon><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></Icon> },
    { key: 'branch', label: 'Cabang', icon: <Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Icon> },
    { key: 'users', label: 'Pengguna', icon: <Icon><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></Icon> },
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
      branch: { name: '', code: '', address: '', region_id: '', division_id: '' },
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
        if (_isNew) await createBranch({ name: payload.name.trim(), code: payload.code?.trim() || null, address: payload.address?.trim() || null, region_id: payload.region_id ? Number(payload.region_id) : null, division_id: payload.division_id ? Number(payload.division_id) : null });
        else await updateBranch(id, { name: payload.name.trim(), code: payload.code?.trim() || null, address: payload.address?.trim() || null, region_id: payload.region_id ? Number(payload.region_id) : null, division_id: payload.division_id ? Number(payload.division_id) : null, is_active: payload.is_active ? 1 : 0 });
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

  // ---------- Pengguna tab ----------
  const resetUserForm = () => setForm({ username: '', password: '', role: 'officer', parent_id: '' });

  const cancelEdit = () => {
    setEditingUser(null);
    resetUserForm();
    setUserError('');
    usernameRef.current?.blur();
  };

  const submitUser = async (event) => {
    event.preventDefault();
    if (masterBusy) return;
    setMasterBusy(true);
    setUserError('');
    try {
      const payload = { username: form.username.trim(), role: form.role, parent_id: form.parent_id ? Number(form.parent_id) : null };
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
    setForm({ username: target.username, password: '', role: target.role, parent_id: target.parent_id || '' });
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
    if (!window.confirm(`Hapus pengguna ${target?.username}?`)) return;
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

  // ---------- Master list rendering ----------
  const activeItems = {
    division: getActiveItems('division'),
    principal: getActiveItems('principal'),
    brand: getActiveItems('brand'),
    region: getActiveItems('region'),
    branch: getActiveItems('branch'),
  };

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
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => handleMasterFormChange('is_active', e.target.checked)} />
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
              {activeItems.division.map((d) => <option key={d.id} value={d.id}>{d.code ? `${d.code} — ${d.name}` : d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Alamat</label>
            <input className="input" value={form.address || ''} onChange={(e) => handleMasterFormChange('address', e.target.value)} />
          </div>
          {form._isNew ? null : (
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => handleMasterFormChange('is_active', e.target.checked)} />
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
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => handleMasterFormChange('is_active', e.target.checked)} />
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
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => handleMasterFormChange('is_active', e.target.checked)} />
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
          <div>
            <label className="label">Divisi</label>
            <select className="input" value={form.division_id || ''} onChange={(e) => handleMasterFormChange('division_id', e.target.value)}>
              <option value="">- Tanpa Divisi -</option>
              {activeItems.division.map((d) => <option key={d.id} value={d.id}>{d.code ? `${d.code} — ${d.name}` : d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Area / Region</label>
            <select className="input" value={form.region_id || ''} onChange={(e) => handleMasterFormChange('region_id', e.target.value)}>
              <option value="">- Tanpa Area -</option>
              {activeItems.region.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Kode</label>
            <input className="input" value={form.code || ''} onChange={(e) => handleMasterFormChange('code', e.target.value)} />
          </div>
          <div>
            <label className="label">Alamat</label>
            <input className="input" value={form.address || ''} onChange={(e) => handleMasterFormChange('address', e.target.value)} />
          </div>
          {form._isNew ? null : (
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => handleMasterFormChange('is_active', e.target.checked)} />
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
    const statusColor = isActive ? 'text-emerald-600' : 'text-slate-400';
    const statusText = isActive ? 'Aktif' : 'Nonaktif';

    let subtitle = '';
    if (tab === 'division') {
      subtitle = item.code || '';
    } else if (tab === 'principal') {
      const division = activeItems.division.find((d) => d.id === item.division_id);
      subtitle = [item.code, item.address, division?.name].filter(Boolean).join(' · ');
    } else if (tab === 'brand') {
      const principal = activeItems.principal.find((p) => p.id === item.principal_id);
      subtitle = principal?.name || '';
    } else if (tab === 'branch') {
      const region = activeItems.region.find((r) => r.id === item.region_id);
      const division = activeItems.division.find((d) => d.id === item.division_id);
      subtitle = [item.code, item.address, region?.name, division?.name].filter(Boolean).join(' · ');
    }

    return (
      <li key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-ink-900">{item.name}</p>
          {subtitle && <p className="truncate text-[12px] text-ink-400">{subtitle}</p>}
        </div>
        <span className={`text-[12px] font-medium ${statusColor}`}>{statusText}</span>
        <button className="rounded-lg p-2 text-ink-400 hover:bg-slate-100 hover:text-ink-800" onClick={() => openEditForm(item, tab)} aria-label={`Edit ${item.name}`}>
          <Icon size={15}><path d="M12 20h9M19.5 14.5L16 11l7-7M21 3a2 2 0 0 1 2 2v9M5 15l4 4 9-9"/></Icon>
        </button>
        <button className="rounded-lg p-2 text-ink-400 hover:bg-slate-100 hover:text-ink-800" onClick={() => toggleActive(item, tab)} aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${item.name}`}>
          <Icon size={15}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m15 9-6 6M9 9l6 6"/></Icon>
        </button>
        <button className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => deleteMasterItem(item.id, tab)} aria-label={`Hapus ${item.name}`}>
          <Icon size={15}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Icon>
        </button>
      </li>
    );
  };

  // ---------- Pengguna section ----------
  const renderUserSection = () => (
    <>
      <section className="content-card info-card">
        <div className="section-heading">
          <div>
            <h2>{editingUser ? 'Edit Pengguna' : 'Tambah Pengguna'}</h2>
            <p>{editingUser ? `Mengubah ${editingUser.username}.` : 'Berikan akses sesuai peran kerja.'}</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={submitUser}>
          <label>Username<input ref={usernameRef} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} pattern="[a-z ]*" title="Username harus huruf kecil" required /></label>
          <label>Password<input type="password" minLength={editingUser ? undefined : 6} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editingUser ? 'Biarkan kosong jika tidak diubah' : undefined} required={!editingUser} /></label>
          <label>Peran<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="officer">Officer</option><option value="observer">Observer</option><option value="superadmin">Super Admin</option></select></label>
          <label>Atasan (BM/SPV)<select value={form.parent_id} onChange={(event) => setForm({ ...form, parent_id: event.target.value })}><option value="">- Tanpa Atasan -</option>{data.users.filter((u) => u.id !== editingUser?.id).map((u) => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}</select></label>
          <button className="button primary" type="submit" disabled={masterBusy}>{masterBusy ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Tambah Pengguna'}</button>
          {editingUser && <button className="text-button" type="button" onClick={cancelEdit}>Batal</button>}
        </form>
      </section>
      {userError && <p className="form-error" role="alert">{userError}</p>}
      <section className="content-card info-card">
        <div className="section-heading">
          <div>
            <h2>Pengguna</h2>
            <p>Akun aktif dan nonaktif.</p>
          </div>
        </div>
        <div className="admin-list">
          {data.users.map((row) => {
            const parent = data.users.find((u) => u.id === row.parent_id);
            return (
              <div className="admin-row" key={row.id}>
                <strong>{row.username}</strong>
                <span>{row.role}</span>
                <span className="text-[11px] text-ink-400">{parent ? `← ${parent.username}` : '—'}</span>
                <span>{row.active ? 'Aktif' : 'Nonaktif'}</span>
                <button className="icon-button" type="button" aria-label={`Edit ${row.username}`} onClick={() => startEdit(row)}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                <button className="icon-button" type="button" aria-label={`Hapus ${row.username}`} onClick={() => removeUser(row.id)}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1-14H6L5 6"/></svg></button>
              </div>
            );
          })}
        </div>
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
            <h2>{config ? config.title : (tab === 'users' ? 'Pengguna' : 'Kriteria Dokumen')}</h2>
            <p>{config ? config.desc : tab === 'users' ? 'Berikan akses sesuai peran kerja.' : 'Label tersimpan sebagai snapshot saat Draft dibuat.'}</p>
          </div>
        </div>

        {isMasterTab && (
          <div className="master-tabs" aria-label="Sub-tab data master">
            {masterTabs.map((t) => (
              <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => { setTab(t.key); closeMasterForm(); }}>{t.icon} {t.label}</button>
            ))}
          </div>
        )}

        {!isMasterTab && (
          <div className="master-tabs" aria-label="Sub-tab data master">
            {masterTabs.map((t) => (
              <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => { setTab(t.key); closeMasterForm(); }}>{t.icon} {t.label}</button>
            ))}
          </div>
        )}

        {tab === 'users' ? renderUserSection() : tab === 'criteria' ? renderCriteriaSection() : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" className="input flex-1 min-w-[200px]" placeholder="Cari nama, kode, alamat…" value={masterSearch} onChange={(e) => { setMasterSearch(e.target.value); setMasterPage(1); }} />
              <button className="button primary whitespace-nowrap" onClick={() => openCreateForm(tab)}>
                <Icon size={15}><path d="M12 5v14M5 12h14"/></Icon> {config.createLabel}
              </button>
            </div>

            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {items.length ? items.map(renderItem) : (
                <li className="px-4 py-8 text-center text-[13px] text-ink-400">
                  {masterSearch ? 'Tidak ada data yang cocok dengan pencarian.' : 'Belum ada data.'}
                </li>
              )}
            </ul>

            <div className="flex items-center justify-between text-sm text-ink-500">
              <span>Halaman {masterPage} dari {totalPages} · Total {filteredItems.length} data</span>
              <div className="flex items-center gap-2">
                <select className="input text-[12px] w-auto" value={masterLimit} onChange={(e) => { setMasterLimit(Number(e.target.value)); setMasterPage(1); }}>
                  <option value={10}>10 per halaman</option>
                  <option value={25}>25 per halaman</option>
                  <option value={50}>50 per halaman</option>
                </select>
                <button className="button" disabled={masterPage <= 1} onClick={() => setMasterPage((p) => Math.max(1, p - 1))}>Sebelumnya</button>
                <button className="button" disabled={masterPage >= totalPages} onClick={() => setMasterPage((p) => Math.min(totalPages, p + 1))}>Selanjutnya</button>
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
                      <button type="button" className="button" onClick={closeMasterForm}>Batal</button>
                      <button type="submit" className="button primary" disabled={masterBusy}>{masterBusy ? 'Menyimpan...' : 'Simpan'}</button>
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

