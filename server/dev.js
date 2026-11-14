// Server development: jalankan di port 3003 dengan file DB sendiri.
// Port dipisah supaya tidak bentrok dengan production PM2 di 3002.
// File DB juga dipisah: dua proses menulis/migrasi file SQLite yang sama membuat
// proses production crash (SQLite lock saat dev restart) — dev memakai salinan.
// shortcut: DB dev = salinan produksi saat pertama kali; kalau master data berubah di
// production, hapus file dev lalu jalankan ulang untuk mengambil salinan baru.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
const devDb = process.env.INCENTIVE_DB || path.join(dataDir, 'incentive.dev.sqlite');
const prodDb = path.join(dataDir, 'incentive.sqlite');

if (!fs.existsSync(devDb) && fs.existsSync(prodDb)) {
  fs.mkdirSync(dataDir, { recursive: true });
  // VACUUM INTO: salinan konsisten (menyertakan isi WAL). Salinan file mentah
  // akan kehilangan commit terbaru yang masih di WAL.
  const src = new Database(prodDb, { readonly: true });
  src.exec(`VACUUM INTO '${devDb.replace(/'/g, "''")}'`);
  src.close();
  console.log(`DB dev dibuat dari salinan produksi: ${devDb}`);
}

// Set env SEBELUM require('../db.js') — path DB dibaca saat modul dimuat.
process.env.INCENTIVE_DB = devDb;
process.env.PORT = process.env.PORT || '3003';

const { start } = require('./index.js');

start().catch((error) => {
  console.error('Server dev gagal start:', error.message);
  process.exitCode = 1;
});
