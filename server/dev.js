// Server development: jalankan di port 3003 supaya tidak bentrok dengan
// production PM2 di 3002 (keduanya memakai DB SQLite yang sama).
// shortcut: port dev dipisah agar dev + production bisa jalan bersamaan; kalau mau satu port, hentikan PM2 dulu.
// Isolasi data: $env:INCENTIVE_DB='C:\path\incentive.dev.sqlite'; npm run dev
process.env.PORT = process.env.PORT || '3003';

const { start } = require('./index.js');

start().catch((error) => {
  console.error('Server dev gagal start:', error.message);
  process.exitCode = 1;
});
