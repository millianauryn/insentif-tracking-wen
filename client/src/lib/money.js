// Parser uang ketat — satu-satunya aturan format angka di klien.
// Sesuai server (routes/documents.js parseMoney): hanya "-123", "123", "123.45".
// Nilai kosong/sampah -> null (tampil '-' / tidak ikut jumlah), bukan NaN/0 diam-diam.
export function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
