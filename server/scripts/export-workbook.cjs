const path = require('path');

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : '';
};

const ids = String(value('--ids') || '').split(',').map(Number).filter(Number.isInteger);
const out = value('--out');

if (!ids.length || !out) {
  console.error('Usage: export-workbook.cjs --ids 1,2 --out /path/file.xlsx');
  process.exit(1);
}

const { openDatabase } = require('../db.js');
const { buildExportWorkbook } = require('../excel-export.js');

(async () => {
  const db = openDatabase();
  const placeholders = ids.map(() => '?').join(',');
  const documents = db.prepare(`SELECT * FROM incentive_documents WHERE id IN (${placeholders})`).all(...ids).map((doc) => ({
    ...doc,
    golongan_rows: db.prepare('SELECT * FROM golongan_rows WHERE document_id = ? ORDER BY sort_order, id').all(doc.id),
    criteria_rows: db.prepare('SELECT * FROM document_criteria_rows WHERE document_id = ? ORDER BY sort_order, id').all(doc.id),
  }));
  const workbook = buildExportWorkbook(db, documents);
  await workbook.xlsx.writeFile(out);
  db.close();
})().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
