const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS = Object.fromEntries(MONTH_NAMES.map((name, index) => [name, String(index + 1).padStart(2, '0')])); /* taste-skill-ignore: month part of YYYY-MM date contract */

// Realtime current month label, e.g. "November 2026"
export function currentPeriodLabel(date = new Date()) {
  const name = Object.keys(MONTHS).find((n) => MONTHS[n] === String(date.getMonth() + 1).padStart(2, '0')); /* taste-skill-ignore: date value, not a label */
  return `${name} ${date.getFullYear()}`;
}

// All 12 month labels without year (Bulan dropdown — the year is typed manually)
export function monthNames() {
  return Object.keys(MONTHS);
}

// Dynamic: previous, current and next month (generated once at module load)
export const PERIOD_OPTIONS = [-1, 0, 1].map((off) => currentPeriodLabel(new Date(new Date().getFullYear(), new Date().getMonth() + off, 1)));

// 'Oktober 2026' -> '2026-10' (server contract: YYYY-MM)
export function toApiPeriod(period) {
  const match = /^(\w+) (\d{4})$/.exec(period || '');
  return match && MONTHS[match[1]] ? `${match[2]}-${MONTHS[match[1]]}` : period;
}

// '2026-10' -> 'Oktober 2026' (select display)
export function fromApiPeriod(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!match) return value || '';
  const month = Object.keys(MONTHS).find((name) => MONTHS[name] === match[2]);
  return month ? `${month} ${match[1]}` : value;
}
