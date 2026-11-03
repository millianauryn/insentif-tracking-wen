import { useState } from 'react';
import { canFinalizeDocument } from '../access';
import { PERIOD_OPTIONS, fromApiPeriod } from '../lib/period';
import { useToast } from '../components/Toast';
import { errMsg } from '../lib/api';
import Icon from '../components/Icon';

function GolonganRow({ row, index, allRows, onUpdate, onRemove, canEdit }) {
  const isGroup = row.isGroup;
  const rowType = row.type || (isGroup ? 'group' : 'item');
  const cssClass = `golongan-${rowType === 'divisi' ? 'divisi' : rowType === 'principal' ? 'principal' : rowType === 'total-divisi' ? 'total-divisi' : rowType === 'total' ? 'total' : 'brand'}`;
  const indent = row.depth ? `golongan-indent-${Math.min(row.depth, 2)}` : '';

  const target = Number(row.target) || 0;
  const achievement = Number(row.achievement) || 0;
  const percentage = target > 0 ? (achievement / target) * 100 : 0;
  const status = target > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur';

  if (isGroup) {
    const isTotal = rowType === 'total-divisi' || rowType === 'total';
    let sumTarget = '';
    let sumAchievement = '';
    let totalPct = '';
    let totalStatus = '';
    if (isTotal) {
      const children = allRows.filter((r) => !r.isGroup && (rowType === 'total' || r.parentRowId === row.id));
      const t = children.reduce((s, r) => s + (Number(r.target) || 0), 0);
      const a = children.reduce((s, r) => s + (Number(r.achievement) || 0), 0);
      sumTarget = t ? t.toLocaleString('id-ID') : '';
      sumAchievement = a ? a.toLocaleString('id-ID') : '';
      totalPct = t > 0 ? ((a / t) * 100).toFixed(1) + '%' : '';
      totalStatus = t > 0 && a / t >= 1 ? 'Tercapai' : 'Gugur';
    }
    return (
      <tr className={`${cssClass} ${indent}`}>
        <td style={{ fontWeight: 600 }}>
          {row.label}
          {canEdit && (
            <button className="delete-button ml-2" onClick={() => onRemove(row.id)} aria-label={`Hapus ${row.label}`}>
              <Icon size={14}><path d="M3 6h18M8 6V4h8v2M19 6l1-14H6L5 6"/></Icon>
            </button>
          )}
        </td>
        <td>{sumTarget}</td>
        <td>{sumAchievement}</td>
        <td>{totalPct}</td>
        <td>{isTotal && totalStatus ? <span className={`result-badge ${totalStatus === 'Tercapai' ? 'success' : 'warning'}`}>{totalStatus}</span> : ''}</td>
      </tr>
    );
  }

  return (
    <tr className={`${cssClass} ${indent}`}>
      <td>
        <input
          value={row.label || ''}
          onChange={(e) => onUpdate(row.id, 'label', e.target.value)}
          disabled={!canEdit}
          placeholder="Nama golongan"
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          value={row.target ?? ''}
          onChange={(e) => onUpdate(row.id, 'target', e.target.value)}
          disabled={!canEdit}
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          value={row.achievement ?? ''}
          onChange={(e) => onUpdate(row.id, 'achievement', e.target.value)}
          disabled={!canEdit}
        />
      </td>
      <td>{target > 0 ? `${percentage.toFixed(1)}%` : ''}</td>
      <td>
        <span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{status}</span>
        {canEdit && (
          <button className="delete-button ml-1" onClick={() => onRemove(row.id)} aria-label={`Hapus baris ${index + 1}`}>
            <Icon size={14}><path d="M3 6h18M8 6V4h8v2M19 6l1-14H6L5 6"/></Icon>
          </button>
        )}
      </td>
    </tr>
  );
}

function GolonganTable({ rows, onUpdate, onRemove, onAdd, canEdit }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr className="golongan-header">
            <th>GOLONGAN</th>
            <th>TARGET</th>
            <th>TERCAPAI (Rp.)</th>
            <th>%</th>
            <th>KET</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <GolonganRow
              key={row.id}
              row={row}
              index={index}
              allRows={rows}
              onUpdate={onUpdate}
              onRemove={onRemove}
              canEdit={canEdit}
            />
          ))}
        </tbody>
      </table>
      {canEdit && (
        <div className="flex gap-2 mt-3">
          <button className="button secondary" onClick={() => onAdd('divisi')}>Tambah Divisi</button>
          <button className="button secondary" onClick={() => onAdd('principal')}>Tambah Principal</button>
          <button className="button secondary" onClick={() => onAdd('brand')}>Tambah Brand</button>
          <button className="button secondary" onClick={() => onAdd('total-divisi')}>Tambah Total Divisi</button>
          <button className="button secondary" onClick={() => onAdd('total')}>Tambah Total</button>
        </div>
      )}
    </div>
  );
}

function KriteriaRow({ row, onUpdate, canEdit }) {
  const target = Number(row.target_value) || 0;
  const achievement = Number(row.achievement_value) || 0;
  const percentage = target > 0 ? (achievement / target) * 100 : 0;
  const status = target > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur';

  return (
    <tr className="kriteria-row">
      <td>{row.label}</td>
      <td>
        <input
          type="number"
          min="0"
          value={row.target_value ?? ''}
          onChange={(e) => onUpdate(row.criteria_id, 'target_value', e.target.value)}
          disabled={!canEdit}
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          value={row.achievement_value ?? ''}
          onChange={(e) => onUpdate(row.criteria_id, 'achievement_value', e.target.value)}
          disabled={!canEdit}
        />
      </td>
      <td>{target > 0 ? `${percentage.toFixed(1)}%` : ''}</td>
      <td>
        <span className={`result-badge ${status === 'Tercapai' ? 'success' : 'warning'}`}>{status}</span>
      </td>
      <td>
        <input
          type="number"
          min="0"
          value={row.incentive_amount ?? ''}
          onChange={(e) => onUpdate(row.criteria_id, 'incentive_amount', e.target.value)}
          disabled={!canEdit}
        />
      </td>
    </tr>
  );
}

function KriteriaTable({ rows, onUpdate, canEdit }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr className="kriteria-header">
            <th>KRITERIA</th>
            <th>TARGET</th>
            <th>TERCAPAI (JUMLAH)</th>
            <th>%</th>
            <th>KET</th>
            <th>INSENTIVE YG DIBERI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <KriteriaRow key={row.criteria_id} row={row} onUpdate={onUpdate} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary({ label, value, helper, accent = false }) {
  return <div className={`summary-card ${accent ? 'accent' : ''}`}><span className="summary-label">{label}</span><strong>{value}</strong><span className="summary-copy">{helper}</span></div>;
}

export default function Documents({
  user, documents, onRefresh, setDocuments,
  onCreate, onUpdate, onSubmit, onLoad, onCancel,
  documentId, golonganRows, updateGolonganRow, removeGolonganRow, addGolonganRow,
  criteriaRows, updateCriteriaRow,
  updateSales, sales, period, setPeriod,
  documentStatus, saved,
}) {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const canEdit = ['superadmin', 'officer'].includes(user.role) && documentStatus === 'Draft';
  const canFinalize = canFinalizeDocument(user, documentStatus);

  const refreshList = async () => {
    setRefreshing(true);
    try {
      const { documents: next } = await onRefresh();
      setDocuments(next);
    } catch (err) {
      toast('error', errMsg(err));
    } finally {
      setRefreshing(false);
    }
  };

  const save = () => (documentId ? onUpdate() : onCreate());

  const totals = {
    target: golonganRows.filter(r => !r.isGroup).reduce((s, r) => s + (Number(r.target) || 0), 0),
    achievement: golonganRows.filter(r => !r.isGroup).reduce((s, r) => s + (Number(r.achievement) || 0), 0),
  };
  totals.percentage = totals.target > 0 ? (totals.achievement / totals.target) * 100 : 0;
  totals.status = totals.target > 0 && totals.percentage >= 100 ? 'Tercapai' : 'Gugur';

  return (
    <>
      <section className="content-card info-card">
        <div className="section-heading heading-with-action">
          <div>
            <h2>Dokumen Tersimpan</h2>
            <p>Buka dokumen lama untuk dilanjutkan, atau mulai draft baru.</p>
          </div>
          <div className="flex gap-2">
            <button className="button secondary" type="button" onClick={refreshList} disabled={refreshing}>{refreshing ? 'Memuat...' : 'Muat Ulang'}</button>
            <button className="button primary" type="button" onClick={onCancel}>Dokumen Baru</button>
          </div>
        </div>
        {documents.length ? (
          <div className="admin-list">
            {documents.map((doc) => (
              <div className="admin-row" key={doc.id}>
                <strong>{doc.salesman || 'Tanpa nama sales'}</strong>
                <span>{fromApiPeriod(doc.period)}</span>
                <span className={`result-badge ${doc.status === 'Final' ? 'success' : 'warning'}`}>{doc.status}</span>
                <button className="text-button" type="button" onClick={() => onLoad(doc)}>Buka</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtitle">Belum ada dokumen tersimpan.</p>
        )}
      </section>

      <section className="content-card info-card">
        <div className="section-heading">
          <div className="section-icon blue"><Icon><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></Icon></div>
          <div><h2>Informasi Dokumen</h2><p>Data dasar dokumen insentif sales.</p></div>
          <span className={`draft-badge ${documentStatus === 'Final' ? 'final-badge' : ''}`}>{documentStatus}</span>
        </div>
        <div className="form-grid">
          <label>Nama Sales<input value={sales.name} onChange={(e) => updateSales('name', e.target.value)} disabled={!canEdit} /></label>
          <label>Cabang<select value={sales.branch} onChange={(e) => updateSales('branch', e.target.value)} disabled={!canEdit}><option>Cabang Jakarta Selatan</option><option>Cabang Jakarta Pusat</option><option>Cabang Bandung</option></select></label>
          <label>Divisi<select value={sales.division} onChange={(e) => updateSales('division', e.target.value)} disabled={!canEdit}><option>General Trade</option><option>Modern Trade</option><option>Pharmacy</option></select></label>
          <label>Periode<select value={period} onChange={(e) => setPeriod(e.target.value)} disabled={!canEdit}>{PERIOD_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
        </div>
      </section>

      <section className="content-card achievement-card">
        <div className="section-heading">
          <div className="section-icon orange"><Icon><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h4"/></Icon></div>
          <div><h2>Tabel Golongan</h2><p>Input target dan capaian per golongan.</p></div>
        </div>
        <GolonganTable
          rows={golonganRows}
          onUpdate={updateGolonganRow}
          onRemove={removeGolonganRow}
          onAdd={addGolonganRow}
          canEdit={canEdit}
        />
      </section>

      <section className="content-card achievement-card">
        <div className="section-heading">
          <div className="section-icon blue"><Icon><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></Icon></div>
          <div><h2>Tabel Kriteria</h2><p>Input target, capaian, dan insentif per kriteria.</p></div>
        </div>
        <KriteriaTable
          rows={criteriaRows}
          onUpdate={updateCriteriaRow}
          canEdit={canEdit}
        />
      </section>

      <section className="summary-grid">
        <Summary label="Total Target" value={totals.target.toLocaleString('id-ID')} helper="Rp." />
        <Summary label="Total Capaian" value={totals.achievement.toLocaleString('id-ID')} helper="Rp." />
        <Summary label="Persentase Total" value={`${totals.percentage.toFixed(1)}%`} helper="Dari target keseluruhan" accent />
        <div className={`summary-card status-summary ${totals.status === 'Tercapai' ? 'success' : 'warning'}`}>
          <span className="summary-label">Status Keseluruhan</span>
          <strong>{totals.status}</strong>
          <span className="status-copy">{totals.status === 'Tercapai' ? 'Target terpenuhi' : 'Target belum terpenuhi'}</span>
        </div>
      </section>

      <footer className="action-bar">
        <div className="autosave"><span className="save-dot" />{saved ? 'Draft tersimpan' : 'Draft belum disimpan'}</div>
        <div className="actions">
          <button className="button secondary" onClick={onCancel}>Batal</button>
          <button className="button primary" onClick={save} disabled={!canEdit}>
            <Icon size={17}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></Icon>
            {documentId ? 'Simpan Perubahan' : 'Simpan Draft'}
          </button>
          {canFinalize && <button className="button secondary" onClick={onSubmit} disabled={!documentId}>Finalisasi</button>}
        </div>
      </footer>
    </>
  );
}
