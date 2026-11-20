#!/usr/bin/env node
/**
 * Clean database and seed with dummy data for testing history UI.
 * - Delete all documents (incentive_documents, golongan_rows, document_criteria_rows, audit_logs)
 * - Delete positions (jabatan user) but keep other master data
 * - Seed new positions, users, and documents with audit history
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { hashPassword } = require('../auth.js');

const DB_PATH = process.env.INCENTIVE_DB || path.join(__dirname, '..', 'data', 'incentive.sqlite');

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database tidak ditemukan: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

async function main() {
  try {
    console.log('📦 Membersihkan database...');
    console.log(`📍 Database: ${DB_PATH}`);

    // ===== 1. HAPUS SEMUA DOKUMEN DAN AUDIT LOGS =====
    console.log('\n🧹 Menghapus dokumen lama...');
    db.prepare('DELETE FROM document_criteria_rows').run();
    db.prepare('DELETE FROM golongan_rows').run();
    db.prepare('DELETE FROM incentive_documents').run();
    db.prepare('DELETE FROM audit_logs').run();
    console.log('   ✅ Dokumen & audit logs dibersihkan');

    // ===== 2. HAPUS POSITIONS (JABATAN USER) =====
    console.log('\n🧹 Menghapus positions (jabatan user)...');
    db.prepare('DELETE FROM position_criteria').run();
    db.prepare('DELETE FROM position_branches').run();
    db.prepare('DELETE FROM positions').run();
    console.log('   ✅ Positions dibersihkan');

    // ===== 3. HAPUS USERS KECUALI SUPERADMIN =====
    console.log('\n🧹 Menghapus users non-superadmin...');
    db.prepare("DELETE FROM users WHERE role != 'superadmin'").run();
    db.prepare("DELETE FROM user_branches WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'superadmin')").run();
    db.prepare("DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'superadmin')").run();
    console.log('   ✅ Users non-superadmin dibersihkan');

    // ===== 4. SEED POSITIONS (HIERARKI BARU) =====
    console.log('\n🌱 Seeding positions baru...');
    
    const insertPos = db.prepare(`
      INSERT INTO positions (name, sales_code, position_type, join_date, parent_position_id, branch_id, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    // BM (2)
    const bm1Id = insertPos.run('BUDI SANTOSO', 'BM001', 'BM', '2020-01-15', null, 1, 1).lastInsertRowid;
    const bm2Id = insertPos.run('SITI NURBAYA', 'BM002', 'BM', '2021-03-10', null, 5, 1).lastInsertRowid;
    console.log(`   BM: ${bm1Id}, ${bm2Id}`);

    // SPV under BM1 (3)
    const spv1Id = insertPos.run('DONO PRATAMA', 'SPV001', 'SPV', '2022-06-01', bm1Id, 1, 1).lastInsertRowid;
    const spv2Id = insertPos.run('RAHMAT HIDAYAT', 'SPV002', 'SPV', '2022-08-15', bm1Id, 6, 1).lastInsertRowid;
    const spv3Id = insertPos.run('LUTFI ANWAR', 'SPV003', 'SPV', '2023-01-20', bm1Id, 1, 1).lastInsertRowid;
    console.log(`   SPV (BM1): ${spv1Id}, ${spv2Id}, ${spv3Id}`);

    // SPV under BM2 (2)
    const spv4Id = insertPos.run('AGUS SUPRIYANTO', 'SPV004', 'SPV', '2022-11-05', bm2Id, 5, 1).lastInsertRowid;
    const spv5Id = insertPos.run('DEWI SARTIKA', 'SPV005', 'SPV', '2023-03-12', bm2Id, 7, 1).lastInsertRowid;
    console.log(`   SPV (BM2): ${spv4Id}, ${spv5Id}`);

    // SALES under SPV1 (4)
    insertPos.run('BIDU RAHMAWATI', 'SLS001', 'SALES', '2023-02-01', spv1Id, 1, 1);
    insertPos.run('BONI SETIAWAN', 'SLS002', 'SALES', '2023-04-10', spv1Id, 1, 1);
    insertPos.run('DONI KUSUMA', 'SLS003', 'SALES', '2023-05-15', spv1Id, 6, 1);
    insertPos.run('ERTW MAULANA', 'SLS004', 'SALES', '2023-07-01', spv1Id, 6, 1);

    // SALES under SPV2 (3)
    insertPos.run('EUTU PRATIWI', 'SLS005', 'SALES', '2023-06-20', spv2Id, 1, 1);
    insertPos.run('EWRT HARDIANSYAH', 'SLS006', 'SALES', '2023-08-05', spv2Id, 6, 1);
    insertPos.run('IRUR WAHYUNI', 'SLS007', 'SALES', '2023-09-10', spv2Id, 6, 1);

    // SALES under SPV3 (3)
    insertPos.run('TUYE CAHYANI', 'SLS008', 'SALES', '2023-10-01', spv3Id, 1, 1);
    insertPos.run('YETR PURNOMO', 'SLS009', 'SALES', '2023-11-15', spv3Id, 1, 1);
    insertPos.run('TE1 MAHENDRA', 'SLS010', 'SALES', '2023-12-01', spv3Id, 6, 1);

    // SALES under SPV4 (3)
    insertPos.run('TE2 WAHYU', 'SLS011', 'SALES', '2024-01-10', spv4Id, 5, 1);
    insertPos.run('TE3 SARI', 'SLS012', 'SALES', '2024-02-20', spv4Id, 7, 1);
    insertPos.run('TE4 BUDIMAN', 'SLS013', 'SALES', '2024-03-01', spv4Id, 7, 1);

    // SALES under SPV5 (3)
    insertPos.run('TE5 RINA', 'SLS014', 'SALES', '2024-04-05', spv5Id, 5, 1);
    insertPos.run('WE1 AGUS', 'SLS015', 'SALES', '2024-05-10', spv5Id, 7, 1);
    insertPos.run('WE2 DEWI', 'SLS016', 'SALES', '2024-06-15', spv5Id, 7, 1);

    const posCount = db.prepare('SELECT COUNT(*) c FROM positions WHERE active = 1').get().c;
    console.log(`   ✅ Total positions: ${posCount}`);

    // ===== 5. SEED USERS (OFFICER & OBSERVER) =====
    console.log('\n🌱 Seeding users...');
    const hash = await hashPassword('123456');
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, role, parent_id, created_by, position_id, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    // Officer untuk SPV1 area
    const off1Id = insertUser.run('officer_bidu', hash, 'officer', 4, 4, null, 1).lastInsertRowid;
    db.prepare('INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)').run(off1Id, 1);
    db.prepare('INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)').run(off1Id, 6);

    // Officer untuk SPV2 area
    const off2Id = insertUser.run('officer_eutu', hash, 'officer', 4, 4, null, 1).lastInsertRowid;
    db.prepare('INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)').run(off2Id, 1);
    db.prepare('INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)').run(off2Id, 6);

    // Observer
    const obsId = insertUser.run('observer1', hash, 'observer', 4, 4, null, 1).lastInsertRowid;

    console.log(`   ✅ Users: 2 officer + 1 observer (password: 123456)`);

    // ===== 6. SEED DOCUMENTS DENGAN AUDIT HISTORY =====
    console.log('\n🌱 Seeding documents dengan audit history...');

    const formats = {
      sales: db.prepare("SELECT id FROM document_formats WHERE name = 'Sales' AND active = 1").get()?.id,
      spv: db.prepare("SELECT id FROM document_formats WHERE name = 'SPV' AND active = 1").get()?.id,
    };

    const criteria = db.prepare('SELECT id, label, sort_order FROM criteria_definitions WHERE active = 1 ORDER BY sort_order').all();

    const salesPositions = db.prepare("SELECT id, name FROM positions WHERE position_type = 'SALES' AND active = 1 ORDER BY name").all();
    const spvPositions = db.prepare("SELECT id, name FROM positions WHERE position_type = 'SPV' AND active = 1 ORDER BY name").all();

    const ownerId = 4; // superadmin
    const periods = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'];
    const products = ['PASEO', 'NICE', 'CERES', 'GROUP PASEO', 'UNIVENUS', 'PHILIPS', 'SOVEL', 'FOCUS', 'SASA', 'JOLLY'];

    const insertSalesDoc = db.prepare(`
      INSERT INTO incentive_documents (owner_id, format_id, salesman, salesman_position_id, product, period, doc_kind, status, wilayah, insentif_total, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'sales', ?, NULL, ?, datetime('now'), datetime('now'))
    `);

    const insertSpvDoc = db.prepare(`
      INSERT INTO incentive_documents (owner_id, format_id, salesman, position_id, product, period, period_end, doc_kind, status, wilayah, insentif_total, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?, 'spv', ?, NULL, ?, datetime('now'), datetime('now'))
    `);

    const insertCriteria = db.prepare(`
      INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, target_value, achievement_value, percentage, percentage_value, status, incentive_amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let salesDocCount = 0;
    let spvDocCount = 0;

    // Helper: create criteria rows
    function createCriteriaRows(docId, status) {
      criteria.forEach((c, idx) => {
        const target = idx === 3 ? 100000000 : (idx === 4 ? 300 : (idx === 6 ? 350 : 200 + idx * 25));
        const achievement = Math.floor(target * (0.7 + Math.random() * 0.5));
        const pct = target > 0 ? (achievement / target) * 100 : 0;
        const critStatus = pct >= 100 ? 'Tercapai' : 'Gugur';
        const incentive = c.label === 'CALL COMPLIANCE' ? 0 : (critStatus === 'Tercapai' ? 1000000 + idx * 500000 : 0);
        insertCriteria.run(docId, c.id, c.label, c.target_unit, c.formula, target, achievement, pct, pct.toFixed(1), critStatus, incentive, c.sort_order);
      });
    }

    // Helper: write audit log
    function writeAudit(actorId, action, entityId, oldVal, newVal, createdAt) {
      insertAudit.run(actorId, action, 'incentive_document', entityId, 
        JSON.stringify(oldVal), JSON.stringify(newVal), createdAt);
    }

    // Buat dokumen Sales per salesman (3 dokumen per sales: Draft, Final, Draft)
    for (const sp of salesPositions) {
      for (let i = 0; i < 3; i++) {
        const period = periods[i * 2];
        const product = products[i % products.length];
        const status = i === 1 ? 'Final' : 'Draft';
        const officerId = (sp.id % 2 === 1) ? off1Id : off2Id; // Alternate officers

        const result = insertSalesDoc.run(officerId, formats.sales, sp.name, sp.id, product, period, status, null);
        const docId = result.lastInsertRowid;
        salesDocCount++;

        createCriteriaRows(docId, status);

        // Audit log: CREATE
        const now = new Date();
        now.setMonth(now.getMonth() - (5 - i));
        writeAudit(officerId, 'CREATE', docId, null, { 
          id: docId, salesman: sp.name, product, period, status, insentif_total: null 
        }, now.toISOString());

        if (status === 'Final') {
          // Audit log: FINALIZE by observer
          const finalizeTime = new Date(now.getTime() + 3600000); // 1 jam setelah create
          writeAudit(obsId, 'FINALIZE', docId, { status: 'Draft' }, { status: 'Final' }, finalizeTime.toISOString());
        } else if (i === 2) {
          // Audit log: UPDATE (simulasi edit)
          const updateTime = new Date(now.getTime() + 7200000); // 2 jam setelah create
          writeAudit(officerId, 'UPDATE', docId, { product: products[(i-1) % products.length] }, { product }, updateTime.toISOString());
        }
      }
    }

    // Buat dokumen SPV per SPV (2 dokumen per SPV: Draft, Final)
    const spvPeriodPairs = [
      { period: '2026-09', periodEnd: '2026-10' },
      { period: '2026-11', periodEnd: '2026-12' },
    ];

    for (const sp of spvPositions) {
      for (let i = 0; i < 2; i++) {
        const { period, periodEnd } = spvPeriodPairs[i];
        const status = i === 1 ? 'Final' : 'Draft';

        const result = insertSpvDoc.run(ownerId, formats.spv, sp.name, sp.id, period, periodEnd, status, null);
        const docId = result.lastInsertRowid;
        spvDocCount++;

        // SPV criteria rows
        criteria.forEach((c, idx) => {
          const target = idx === 3 ? 100000000 : (idx === 4 ? 300 : (idx === 6 ? 350 : 200 + idx * 25));
          const achievement = Math.floor(target * (0.8 + Math.random() * 0.3));
          const pct = target > 0 ? (achievement / target) * 100 : 0;
          const critStatus = pct >= 100 ? 'Tercapai' : 'Gugur';
          const incentive = c.label === 'CALL COMPLIANCE' ? 0 : (critStatus === 'Tercapai' ? 1000000 + idx * 500000 : 0);
          insertCriteria.run(docId, c.id, c.label, c.target_unit, c.formula, target, achievement, pct, pct.toFixed(1), critStatus, incentive, c.sort_order);
        });

        // Audit log: CREATE
        const now = new Date();
        now.setMonth(now.getMonth() - (3 - i));
        writeAudit(ownerId, 'CREATE', docId, null, { 
          id: docId, salesman: sp.name, period, period_end: periodEnd, status, insentif_total: null 
        }, now.toISOString());

        if (status === 'Final') {
          // Audit log: FINALIZE by observer
          const finalizeTime = new Date(now.getTime() + 3600000);
          writeAudit(obsId, 'FINALIZE', docId, { status: 'Draft' }, { status: 'Final' }, finalizeTime.toISOString());
        }
      }
    }

    console.log(`   ✅ Sales dokumen: ${salesDocCount}`);
    console.log(`   ✅ SPV dokumen: ${spvDocCount}`);

    // ===== 7. VERIFIKASI =====
    console.log('\n✅ Verifikasi:');
    const counts = db.prepare('SELECT doc_kind, status, COUNT(*) c FROM incentive_documents GROUP BY doc_kind, status').all();
    counts.forEach(c => console.log(`   ${c.doc_kind} (${c.status}): ${c.c}`));

    const auditCount = db.prepare('SELECT action, COUNT(*) c FROM audit_logs GROUP BY action').all();
    auditCount.forEach(a => console.log(`   Audit ${a.action}: ${a.c}`));

    const posCount2 = db.prepare('SELECT position_type, COUNT(*) c FROM positions WHERE active = 1 GROUP BY position_type').all();
    posCount2.forEach(p => console.log(`   ${p.position_type}: ${p.c}`));

    console.log('\n🎉 Clean & Seed selesai!');
    console.log('\n📋 Login credentials:');
    console.log('   Superadmin: super / 123456');
    console.log('   Officer 1:  officer_bidu / 123456');
    console.log('   Officer 2:  officer_eutu / 123456');
    console.log('   Observer:   observer1 / 123456');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();