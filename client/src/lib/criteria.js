import { parseMoney } from './money';

// Baris dengan aturan sendiri (tidak dihitung sebagai Gugur biasa).
const OWN_RULE_LABELS = ['GOL YG GUGUR KURANG DARI 50%', 'CALL COMPLIANCE'];

// Gugur: target > 0 dan pencapaian < 100%. TOTAL OMZET memakai target tetap 100%.
export function isGugurCriteria(row) {
  if (OWN_RULE_LABELS.includes(row.label)) return false;
  const target = row.label === 'TOTAL OMZET' ? 100 : (parseMoney(row.target_value) ?? 0);
  const achievement = parseMoney(row.achievement_value) ?? 0;
  return target > 0 && (achievement / target) * 100 < 100;
}
