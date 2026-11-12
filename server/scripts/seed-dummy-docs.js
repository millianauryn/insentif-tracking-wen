// Seed dokumen dummy: setiap sales dapat N dokumen (default 3) pada bulan terakhir.
// Dokumen berstatus Final supaya ikut terakumulasi di dokumen SPV.
// Idempoten: pasangan (salesman, period) yang sudah ada dilewati.
// Pemakaian: node server/scripts/seed-dummy-docs.js [jumlahBulan=3] [periodeAkhir=YYYY-MM]
const { openDatabase } = require('../db.js');

const monthsCount = Number(process.argv[2] || 3);
const endArg = process.argv[3] || null;

function shiftMonth(period, delta) {
  const [y, m] = period.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

const db = openDatabase();

const format = db.prepare('SELECT id FROM document_formats WHERE active = 1 ORDER BY id LIMIT 1').get();
const criteria = db.prepare('SELECT id, label, target_unit, formula, sort_order FROM criteria_definitions WHERE active = 1 ORDER BY sort_order, id').all();
const brands = db.prepare('SELECT id, name, principal_id FROM brands WHERE is_active != 0 ORDER BY id').all();
const sales = db.prepare("SELECT id, name, branch_id FROM positions WHERE position_type = 'SALES' AND active = 1 ORDER BY id").all();
const owner = db.prepare("SELECT id FROM users WHERE role IN ('officer','superadmin') AND active = 1 ORDER BY role = 'officer' DESC LIMIT 1").get();
const cityOf = (branchId) => {
  if (!branchId) return null;
  const b = db.prepare('SELECT city FROM branches WHERE id = ?').get(branchId);
  return b ? b.city : null;
};

if (!format || !criteria.length || !brands.length || !sales.length || !owner) {
  console.error('Data master belum lengkap (format/kriteria/brand/sales/user) — tidak ada yang dibuat.');
  db.close();
  process.exitCode = 1;
} else {
  const now = new Date();
  const endPeriod = endArg || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periods = [];
  for (let i = monthsCount - 1; i >= 0; i--) periods.push(shiftMonth(endPeriod, -i));

  const insertDoc = db.prepare(`
    INSERT INTO incentive_documents (owner_id, format_id, salesman, product, period, status, doc_kind, wilayah, insentif_total)
    VALUES (?, ?, ?, ?, ?, 'Final', 'sales', ?, ?)
  `);
  const insertGolongan = db.prepare(`
    INSERT INTO golongan_rows (document_id, label, principal_id, brand_id, target, achievement, sort_order, is_group)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);
  const insertCriteria = db.prepare(`
    INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, target_value, achievement_value, percentage, status, incentive_amount, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const exists = db.prepare("SELECT id FROM incentive_documents WHERE doc_kind = 'sales' AND lower(trim(salesman)) = lower(trim(?)) AND period = ? LIMIT 1");

  let created = 0;
  let skipped = 0;
  const run = db.transaction(() => {
    sales.forEach((s, si) => {
      periods.forEach((period, pi) => {
        if (exists.get(s.name, period)) { skipped++; return; }
        // 2 brand per sales, bergantian tiap bulan supaya akumulasi lintas bulan terlihat.
        const picks = [brands[(si + pi) % brands.length], brands[(si + pi + 1) % brands.length]];
        const unique = [...new Map(picks.map((b) => [b.id, b])).values()];
        const docId = insertDoc.run(owner.id, format.id, s.name, unique.map((b) => b.name).join(', & '), period, cityOf(s.branch_id), 0).lastInsertRowid;

        let totalInsentif = 0;
        unique.forEach((b, bi) => {
          const target = 120_000_000 + (si * 7 + pi * 3 + bi) * 11_000_000;
          const achievement = Math.round(target * (0.85 + ((si + pi + bi) % 4) * 0.07));
          insertGolongan.run(docId, b.name, b.principal_id, b.id, target, achievement, bi);
        });
        criteria.forEach((c, ci) => {
          const target = 200 + ((si + pi + ci) % 9) * 25;
          const achievement = Math.round(target * (0.8 + ((si + pi * 2 + ci) % 5) * 0.06));
          const percentage = target > 0 ? (achievement / target) * 100 : 0;
          const incentive = Math.round(achievement * 25_000);
          totalInsentif += incentive;
          insertCriteria.run(docId, c.id, c.label, c.target_unit, c.formula, target, achievement, percentage, percentage >= 100 ? 'Tercapai' : 'Gugur', incentive, ci);
        });
        db.prepare('UPDATE incentive_documents SET insentif_total = ? WHERE id = ?').run(totalInsentif, docId);
        created++;
      });
    });
  });
  run();

  console.log(`dokumen dummy: ${created} dibuat, ${skipped} dilewati (sudah ada)`);
  console.log('per sales:', JSON.stringify(db.prepare(`
    SELECT salesman, COUNT(*) AS jumlah, MIN(period) AS dari, MAX(period) AS sampai
    FROM incentive_documents WHERE doc_kind = 'sales' AND salesman IS NOT NULL
    GROUP BY salesman ORDER BY salesman
  `).all()));
  db.close();
}
