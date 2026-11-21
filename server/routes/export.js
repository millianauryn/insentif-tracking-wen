const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const express = require('express');
const { requireAuth } = require('../middleware.js');

const runFile = promisify(execFile);
const scriptPath = path.join(__dirname, '..', 'scripts', 'export-workbook.cjs');

// Workbook besar dapat menghentikan proses server; bangun file di proses anak.

function createExportRouter(db, options = {}) {
  const router = express.Router();
  const auth = options.requireAuth || requireAuth;

  router.post('/export-excel', auth, async (req, res) => {
    const rawIds = req.body?.ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Pilih minimal satu dokumen.' } });
    }
    const ids = [...new Set(rawIds.map((id) => Number(id)).filter(Number.isInteger))];
    if (!ids.length || ids.length > 100) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Jumlah dokumen tidak valid.' } });
    }

    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM incentive_documents WHERE id IN (${placeholders})`).all(...ids);
    const allowed = rows.filter((doc) => (
      ['sales', 'spv'].includes(doc.doc_kind)
      && (req.user.role !== 'officer' || doc.owner_id === req.user.id)
    ));
    if (!allowed.length) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tidak ada dokumen yang dapat diekspor.' } });
    }

    const filename = `insentif-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const tempFile = path.join(os.tmpdir(), `insentif-${crypto.randomUUID()}.xlsx`);
    try {
      await runFile(process.execPath, [scriptPath, '--ids', allowed.map((d) => d.id).join(','), '--out', tempFile]);
    } catch (error) {
      fs.promises.unlink(tempFile).catch(() => {});
      return res.status(500).json({ error: { code: 'EXPORT_FAILED', message: 'Gagal membuat file Excel.' } });
    }

    return res.download(tempFile, filename, () => {
      fs.promises.unlink(tempFile).catch(() => {});
    });
  });

  return router;
}

module.exports = createExportRouter;
