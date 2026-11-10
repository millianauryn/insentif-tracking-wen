// Terbilang (angka -> kata) untuk kwitansi — satu-satunya implementasi.
// Dipakai Documents.jsx (input Terbilang Rp.) — diuji di terbilang.test.js.
const TERBILANG_UNITS = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

function terbilangWords(n) {
  if (n === 0) return 'nol';
  if (n < 12) return TERBILANG_UNITS[n];
  if (n < 20) return `${terbilangWords(n - 10)} belas`;
  if (n < 100) return `${terbilangWords(Math.floor(n / 10))} puluh ${n % 10 ? terbilangWords(n % 10) : ''}`.trim();
  if (n < 200) return `seratus ${n - 100 ? terbilangWords(n - 100) : ''}`.trim();
  if (n < 1000) return `${terbilangWords(Math.floor(n / 100))} ratus ${n % 100 ? terbilangWords(n % 100) : ''}`.trim();
  if (n < 2000) return `seribu ${n - 1000 ? terbilangWords(n - 1000) : ''}`.trim();
  if (n < 1_000_000) return `${terbilangWords(Math.floor(n / 1000))} ribu ${n % 1000 ? terbilangWords(n % 1000) : ''}`.trim();
  if (n < 1_000_000_000) return `${terbilangWords(Math.floor(n / 1_000_000))} juta ${n % 1_000_000 ? terbilangWords(n % 1_000_000) : ''}`.trim();
  if (n < 1_000_000_000_000) return `${terbilangWords(Math.floor(n / 1_000_000_000))} miliar ${n % 1_000_000_000 ? terbilangWords(n % 1_000_000_000) : ''}`.trim();
  return `${terbilangWords(Math.floor(n / 1_000_000_000_000))} triliun ${n % 1_000_000_000_000 ? terbilangWords(n % 1_000_000_000_000) : ''}`.trim();
}

export function terbilang(n) {
  const num = Math.trunc(Number(n) || 0);
  if (!num) return 'Nol rupiah';
  const words = terbilangWords(Math.abs(num));
  const cap = words.charAt(0).toUpperCase() + words.slice(1);
  return `${num < 0 ? 'Minus ' : ''}${cap} rupiah`;
}
