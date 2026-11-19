#!/usr/bin/env node
/**
 * Seed production database with standard incentive documents.
 * Usage: node scripts/seed-production-docs.js
 * 
 * Creates:
 * - 5 Sales documents per active SALES position
 * - 2 SPV documents per active SPV position
 * All documents are Draft status with full criteria rows.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.INCENTIVE_DB || path.join(__dirname, '..', 'data', 'incentive.sqlite');

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database tidak ditemukan: ${DB_PATH}`);
  console.error('Set environment variable INCENTIVE_DB jika path berbeda.');
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

try {
  console.log('📦 Memulai seed database production...');
  console.log(`📍 Database: ${DB_PATH}`);

  // ===== AMBIL DATA MASTER =====
  const formats = {
    sales: db.prepare("SELECT id FROM document_formats WHERE name = 'Sales' AND active = 1").get()?.id,
    spv: db.prepare("SELECT id FROM document_formats WHERE name = 'SPV' AND active = 1").get()?.id,
  };

  if (!formats.sales || !formats.spv) {
    throw new Error('Format dokumen Sales/SPV tidak ditemukan. Jalankan migrasi database dulu.');
  }

  const criteria = db.prepare('SELECT id, label, sort_order FROM criteria_definitions WHERE active = 1 ORDER BY sort_order').all();
  if (!criteria.length) throw new Error('Criteria definitions kosong.');

  const salesPositions = db.prepare("SELECT id, name FROM positions WHERE position_type = 'SALES' AND active = 1 ORDER BY name").all();
  const spvPositions = db.prepare("SELECT id, name FROM positions WHERE position_type = 'SPV' AND active = 1 ORDER BY name").all();

  const ownerId = db.prepare("SELECT id FROM users WHERE role = 'superadmin' ORDER BY id LIMIT 1").get()?.id || 1;

  const periods = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06'];
  const products = ['PASEO', 'NICE', 'CERES', 'GROUP PASEO', 'UNIVENUS', 'PHILIPS', 'SOVEL', 'FOCUS', 'SASA', 'JOLLY'];

  console.log(`\n📋 Data master:`);
  console.log(`   Sales positions: ${salesPositions.length}`);
  console.log(`   SPV positions: ${spvPositions.length}`);
  console.log(`   Criteria: ${criteria.length}`);
  console.log(`   Periods: ${periods.length}`);
  console.log(`   Owner (superadmin): ${ownerId}`);

  // ===== BERSIHKAN DATA LAMA =====
  console.log('\n🧹 Menghapus dokumen lama...');
  db.prepare('DELETE FROM document_criteria_rows').run();
  db.prepare('DELETE FROM golongan_rows').run();
  db.prepare('DELETE FROM incentive_documents').run();
  db.prepare('DELETE FROM audit_logs').run();
  console.log('   ✅ Bersih');

  // ===== BUAT DOKUMEN SALES =====
  console.log('\n📝 Membuat dokumen Sales (5 per sales)...');
  
  const usedLowerNames = new Set();
  let salesDocCount = 0;

  const insertSalesDoc = db.prepare(`
    INSERT INTO incentive_documents (owner_id, format_id, salesman, salesman_position_id, product, period, doc_kind, status, wilayah, insentif_total)
    VALUES (?, ?, ?, ?, ?, ?, 'sales', 'Draft', NULL, NULL)
  `);

  const insertCriteria = db.prepare(`
    INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, target_value, achievement_value, percentage, percentage_value, status, incentive_amount, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const sp of salesPositions) {
    const lowerName = sp.name.toLowerCase().trim();
    const isConflict = usedLowerNames.has(lowerName);
    usedLowerNames.add(lowerName);
    const periodStart = isConflict ? 5 : 0;

    for (let i = 0; i < 5; i++) {
      const period = periods[periodStart + i];
      const product = products[i % products.length];

      const result = insertSalesDoc.run(ownerId, formats.sales, sp.name, sp.id, product, period);
      const docId = result.lastInsertRowid;
      salesDocCount++;

      // Criteria rows
      criteria.forEach((c, idx) => {
        const target = idx === 3 ? 100000000 : (idx === 4 ? 300 : (idx === 6 ? 350 : 200 + idx * 25));
        const achievement = Math.floor(target * (0.8 + Math.random() * 0.4));
        const pct = target > 0 ? (achievement / target) * 100 : 0;
        const status = pct >= 100 ? 'Tercapai' : 'Gugur';
        const incentive = c.label === 'CALL COMPLIANCE' ? 0 : (status === 'Tercapai' ? 1000000 + idx * 500000 : 0);
        insertCriteria.run(docId, c.id, c.label, c.target_unit, c.formula, target, achievement, pct, pct.toFixed(1), status, incentive, c.sort_order);
      });
    }
  }

  console.log(`   ✅ ${salesDocCount} dokumen Sales dibuat`);

  // ===== BUAT DOKUMEN SPV =====
  console.log('\n📝 Membuat dokumen SPV (2 per SPV)...');
  
  let spvDocCount = 0;
  const spvPeriodPairs = [
    { period: '2026-09', periodEnd: '2026-10' },
    { period: '2026-11', periodEnd: '2026-12' },
  ];

  const insertSpvDoc = db.prepare(`
    INSERT INTO incentive_documents (owner_id, format_id, salesman, position_id, product, period, period_end, doc_kind, status, wilayah, insentif_total)
    VALUES (?, ?, ?, ?, NULL, ?, ?, 'spv', 'Draft', NULL, NULL)
  `);

  const insertSpvCriteria = db.prepare(`
    INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, target_value, achievement_value, percentage, percentage_value, status, incentive_amount, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const sp of spvPositions) {
    for (let i = 0; i < 2; i++) {
      const { period, periodEnd } = spvPeriodPairs[i];

      const result = insertSpvDoc.run(ownerId, formats.spv, sp.name, sp.id, period, periodEnd);
      const docId = result.lastInsertRowid;
      spvDocCount++;

      // SPV criteria rows (simplified - server will compute from sales docs)
      criteria.forEach((c, idx) => {
        const target = idx === 3 ? 100000000 : (idx === 4 ? 300 : (idx === 6 ? 350 : 200 + idx * 25));
        const achievement = Math.floor(target * (0.8 + Math.random() * 0.4));
        const pct = target > 0 ? (achievement / target) * 100 : 0;
        const status = pct >= 100 ? 'Tercapai' : 'Gugur';
        const incentive = c.label === 'CALL COMPLIANCE' ? 0 : (status === 'Tercapai' ? 1000000 + idx * 500000 : 0);
        insertSpvCriteria.run(docId, c.id, c.label, c.target_unit, c.formula, target, achievement, pct, pct.toFixed(1), status, incentive, c.sort_order);
      });
    }
  }

  console.log(`   ✅ ${spvDocCount} dokumen SPV dibuat`);

  // ===== VERIFIKASI =====
  console.log('\n✅ Verifikasi:');
  const counts = db.prepare('SELECT doc_kind, status, COUNT(*) c FROM incentive_documents GROUP BY doc_kind, status').all();
  counts.forEach(c => console.log(`   ${c.doc_kind} (${c.status}): ${c.c}`));

  const totalSales = db.prepare("SELECT COUNT(*) c FROM incentive_documents WHERE doc_kind = 'sales'").get().c;
  const totalSpv = db.prepare("SELECT COUNT(*) c FROM incentive_documents WHERE doc_kind = 'spv'").get().c;

  console.log(`\n🎉 Seed selesai!`);
  console.log(`   Total Sales dokumen: ${totalSales}`);
  console.log(`   Total SPV dokumen: ${totalSpv}`);
  console.log(`   Grand total: ${totalSales + totalSpv}`);

} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
} finally {
  db.close();
}