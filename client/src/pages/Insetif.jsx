import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import SearchBox from '../components/SearchBox';
import { useToast } from '../components/Toast';
import { fromApiPeriod } from '../lib/period';
import { errMsg } from '../lib/api';
import { listPositions } from '../api';

const childrenOf = (positions, id) => positions.filter((p) => p.parent_position_id === id);
const descendantsOf = (positions, id) => {
  const out = [];
  const walk = (parentId) => childrenOf(positions, parentId).forEach((c) => { out.push(c); walk(c.id); });
  walk(id);
  return out;
};
const parentOf = (positions, p) => positions.find((x) => x.id === p.parent_position_id);

export default function Insetif({ documents, setDocuments, onRefresh, onLoad, onNewDoc }) {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const nameParam = searchParams.get('name') || '';

  const [search, setSearch] = useState(nameParam);
  const [positions, setPositions] = useState([]);
  const [bmId, setBmId] = useState('');
  const [spvId, setSpvId] = useState('');
  const [salesId, setSalesId] = useState('');
  const [periode, setPeriode] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    listPositions().then((r) => setPositions(r.positions || [])).catch(() => setPositions([]));
  }, []);

  // Klik nama di Dashboard → preselect hierarki sesuai nama tersebut
  useEffect(() => {
    if (!nameParam || !positions.length) return;
    const target = positions.find((p) => p.name === nameParam);
    if (!target) return;
    if (target.position_type === 'BM') {
      setBmId(String(target.id));
    } else if (target.position_type === 'SPV') {
      setSpvId(String(target.id));
      const bm = parentOf(positions, target);
      if (bm) setBmId(String(bm.id));
    } else {
      setSalesId(String(target.id));
      const spv = parentOf(positions, target);
      if (spv) {
        setSpvId(String(spv.id));
        const bm = parentOf(positions, spv);
        if (bm) setBmId(String(bm.id));
      }
    }
  }, [nameParam, positions]);

  const bms = positions.filter((p) => p.position_type === 'BM');
  const spvOptions = bmId
    ? childrenOf(positions, Number(bmId)).filter((p) => p.position_type === 'SPV')
    : positions.filter((p) => p.position_type === 'SPV');
  const salesScope = spvId
    ? childrenOf(positions, Number(spvId))
    : bmId
      ? descendantsOf(positions, Number(bmId))
      : positions;
  const salesOptions = salesScope.filter((p) => p.position_type === 'SALES');

  const periodeOptions = useMemo(
    () => [...new Set(documents.map((d) => d.period).filter(Boolean))].sort().reverse(),
    [documents],
  );

  const visibleDocs = useMemo(() => {
    let rows = documents;
    if (salesId) {
      const s = positions.find((p) => p.id === Number(salesId));
      if (s) rows = rows.filter((d) => d.salesman === s.name);
    } else if (spvId) {
      const names = childrenOf(positions, Number(spvId)).map((p) => p.name);
      rows = rows.filter((d) => names.includes(d.salesman));
    } else if (bmId) {
      const names = descendantsOf(positions, Number(bmId)).map((p) => p.name);
      rows = rows.filter((d) => names.includes(d.salesman));
    }
    if (periode) rows = rows.filter((d) => d.period === periode);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((d) =>
        `${d.salesman || ''} ${d.product || ''} ${fromApiPeriod(d.period)}`.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [documents, positions, salesId, spvId, bmId, periode, search]);

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

  return (
    <section className="content-card info-card">
      <div className="section-heading heading-with-action">
        <div>
          <h2>Dokumen Tersimpan</h2>
          <p>Cari, filter, dan buka dokumen lama untuk dilanjutkan.</p>
        </div>
        <div className="flex gap-2">
          <Button className="button secondary" type="button" onClick={refreshList} disabled={refreshing}>
            {refreshing ? 'Memuat...' : 'Muat Ulang'}
          </Button>
          <Button className="button primary" type="button" onClick={onNewDoc}>Dokumen Baru</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <SearchBox
          value={search}
          onSearch={setSearch}
          placeholder="Cari sales, produk, periode..."
          className="flex-1 min-w-[220px]"
        />
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-700">
          BM
          <select
            className="input min-w-[150px]"
            value={bmId}
            onChange={(e) => { setBmId(e.target.value); setSpvId(''); setSalesId(''); }}
          >
            <option value="">Semua BM</option>
            {bms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-700">
          SPV
          <select
            className="input min-w-[150px]"
            value={spvId}
            onChange={(e) => { setSpvId(e.target.value); setSalesId(''); }}
          >
            <option value="">Semua SPV</option>
            {spvOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-700">
          Sales
          <select className="input min-w-[150px]" value={salesId} onChange={(e) => setSalesId(e.target.value)}>
            <option value="">Semua sales</option>
            {salesOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-700">
          Periode
          <select className="input min-w-[150px]" value={periode} onChange={(e) => setPeriode(e.target.value)}>
            <option value="">Semua periode</option>
            {periodeOptions.map((key) => <option key={key} value={key}>{fromApiPeriod(key)}</option>)}
          </select>
        </label>
      </div>

      {visibleDocs.length ? (
        <div className="admin-list">
          {visibleDocs.map((doc) => (
            <div className="admin-row" key={doc.id}>
              <strong>{doc.salesman || 'Tanpa nama sales'}</strong>
              <span>{fromApiPeriod(doc.period)}</span>
              <span className={`status-pill ${doc.status === 'Final' ? 'final' : 'draft'}`}>{doc.status}</span>
              <button className="text-button" type="button" onClick={() => onLoad(doc)}>Buka</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>Tidak ada dokumen</strong>
          <p>Ubah filter atau simpan draft pertama Anda.</p>
        </div>
      )}
    </section>
  );
}
