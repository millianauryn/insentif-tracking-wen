import { fromApiPeriod, periodRangeLabel } from './period';

// Label periode di kartu dokumen: SPV menampilkan rentang, sales satu bulan.
export function docPeriodLabel(doc) {
  if (!doc) return '';
  if (doc.doc_kind === 'spv') return periodRangeLabel(doc.period, doc.period_end);
  return fromApiPeriod(doc.period);
}

// Filter bulan: SPV tampil di setiap bulan yang dinaungi rentangnya.
export function docMatchesPeriode(doc, periode) {
  if (!periode) return true;
  if (doc.doc_kind === 'spv') {
    const end = doc.period_end || doc.period;
    return doc.period <= periode && end >= periode;
  }
  return doc.period === periode;
}

// Filter tahun: dokumen yang periodenya (atau rentang SPV) menyentuh tahun itu.
export function docMatchesYear(doc, year) {
  if (!year) return true;
  const target = String(year);
  const start = String(doc.period || '').slice(0, 4);
  const end = String(doc.period_end || doc.period || '').slice(0, 4);
  return start <= target && end >= target;
}

// Filter SPV: dokumen milik SPV itu sendiri + dokumen sales anak-anaknya.
export function docMatchesSpv(doc, spvId, childNames = []) {
  if (!spvId) return true;
  if (doc.doc_kind === 'spv') return doc.position_id === Number(spvId);
  return childNames.includes(doc.salesman);
}
