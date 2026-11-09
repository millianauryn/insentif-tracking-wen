const express = require('express');
const { requireAuth } = require('../middleware.js');

function createDocumentsRouter(db, options = {}) {
  const router = express.Router();
  const auth = options.requireAuth || requireAuth;

  router.get('/', auth, (req, res) => {
    const documents = ['superadmin', 'observer'].includes(req.user.role)
      ? db.prepare('SELECT * FROM incentive_documents ORDER BY updated_at DESC').all()
      : db.prepare('SELECT * FROM incentive_documents WHERE owner_id = ? ORDER BY updated_at DESC').all(req.user.id);
    res.json({ documents });
  });

  router.post('/', auth, (req, res) => {
    if (!['officer', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: 'Read-only role cannot create documents' } });
    }
    const input = req.body || {};
    if (!isValidPeriod(input.period) || !Number.isInteger(Number(input.format_id))) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid format_id and period required' } });
    }
    const format = db.prepare('SELECT id FROM document_formats WHERE id = ? AND active = 1').get(input.format_id);
    if (!format) return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid document format' } });
    if (!validateGolonganRows(input.golongan_rows || [])) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid Golongan rows' } });
    }
    const dup = findDuplicateDoc(db, input.salesman, input.period);
    if (dup) {
      return res.status(409).json({ error: { code: 'DUPLICATE_SALES_PERIOD', message: `Sales ${dup.salesman} sudah menerima insentif pada periode ${dup.period}` } });
    }

    const create = db.transaction(() => {
      const ownerId = req.user.id;
      const result = db.prepare(`
        INSERT INTO incentive_documents (owner_id, format_id, division_id, salesman, product, period, status, wilayah, insentif_total, kwitansi)
        VALUES (?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)
      `).run(ownerId, input.format_id, input.division_id || null, input.salesman || null, input.product || null, input.period, input.wilayah || null, encodeNumber(input.insentif_total), encodeKwitansi(input.kwitansi));
      const documentId = result.lastInsertRowid;
      const criteria = db.prepare(`
        SELECT id, label, target_unit, formula, sort_order
        FROM criteria_definitions WHERE active = 1 ORDER BY sort_order, id
      `).all();
      const insertCriteria = db.prepare(`
        INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      criteria.forEach(row => insertCriteria.run(documentId, row.id, row.label, row.target_unit, row.formula, row.sort_order));
      insertGolonganRows(db, documentId, input.golongan_rows || []);
      upsertCriteriaRows(db, documentId, input.criteria_rows || []);
      return db.prepare('SELECT * FROM incentive_documents WHERE id = ?').get(documentId);
    });

    res.status(201).json({ document: create() });
  });

  router.get('/:id', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    res.json({ document });
  });

  router.patch('/:id', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    if (req.user.role !== 'superadmin' && (document.owner_id !== req.user.id || document.status !== 'Draft')) {
      return res.status(409).json({ error: { code: 'DOCUMENT_LOCKED', message: 'Only owner can edit Draft documents' } });
    }
    const input = req.body || {};
    // Superadmin yang mengoreksi dokumen Final wajib mengisi alasan audit.
    if (req.user.role === 'superadmin' && document.status === 'Final') {
      const reason = String(input.audit_reason || '').trim();
      if (reason.length < 3) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'audit_reason wajib diisi (min 3 huruf) untuk koreksi Final' } });
      }
    }
    try {
      const nextSalesman = input.salesman !== undefined ? input.salesman : document.salesman;
      const nextPeriod = input.period !== undefined ? input.period : document.period;
      const dup = findDuplicateDoc(db, nextSalesman, nextPeriod, document.id);
      if (dup) {
        return res.status(409).json({ error: { code: 'DUPLICATE_SALES_PERIOD', message: `Sales ${dup.salesman} sudah menerima insentif pada periode ${dup.period}` } });
      }
      updateDocument(db, document, input);
    } catch (error) {
      if (error.message === 'Invalid period' || error.message === 'Invalid Golongan rows') {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: error.message } });
      }
      throw error;
    }
    if (req.user.role === 'superadmin' && document.status === 'Final') {
      writeAudit(db, req.user.id, 'UPDATE', 'incentive_document', document.id, { ...document, audit_reason: String(input.audit_reason || '').trim() }, getDocument(db, document.id));
    }
    res.json({ document: getDocument(db, document.id) });
  });

  router.delete('/:id', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    if (req.user.role !== 'superadmin' && document.owner_id !== req.user.id) {
      return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: 'Cannot delete this document' } });
    }
    if (document.status !== 'Draft') {
      return res.status(409).json({ error: { code: 'DOCUMENT_LOCKED', message: 'Only Draft documents can be deleted' } });
    }
    const remove = db.transaction(() => {
      db.prepare('DELETE FROM golongan_rows WHERE document_id = ?').run(document.id);
      db.prepare('DELETE FROM document_criteria_rows WHERE document_id = ?').run(document.id);
      db.prepare('DELETE FROM incentive_documents WHERE id = ?').run(document.id);
    });
    remove();
    res.json({ success: true });
  });

  router.post('/:id/finalize', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    if (!['observer', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: 'Cannot finalize this document' } });
    }
    if (document.status !== 'Draft') return res.status(409).json({ error: { code: 'DOCUMENT_LOCKED', message: 'Document is already Final' } });
    db.prepare("UPDATE incentive_documents SET status = 'Final', updated_at = datetime('now') WHERE id = ?").run(document.id);
    res.json({ document: getDocument(db, document.id) });
  });

  return router;
}

function getReadableDocument(db, user, id) {
  const document = getDocument(db, id);
  if (!document || (user.role === 'officer' && document.owner_id !== user.id)) return null;
  return document;
}

function getDocument(db, id) {
  const document = db.prepare('SELECT * FROM incentive_documents WHERE id = ?').get(id);
  if (!document) return null;
  return {
    ...document,
    kwitansi: decodeKwitansi(document.kwitansi),
    golongan_rows: db.prepare('SELECT * FROM golongan_rows WHERE document_id = ? ORDER BY sort_order, id').all(id),
    criteria_rows: db.prepare('SELECT * FROM document_criteria_rows WHERE document_id = ? ORDER BY sort_order, id').all(id)
  };
}

function updateDocument(db, document, input) {
  const fields = [];
  const values = [];
  for (const field of ['division_id', 'salesman', 'product', 'period', 'format_id', 'wilayah']) {
    if (input[field] !== undefined) {
      if (field === 'period' && !isValidPeriod(input[field])) throw new Error('Invalid period');
      fields.push(`${field} = ?`);
      values.push(input[field]);
    }
  }
  if (input.insentif_total !== undefined) {
    fields.push('insentif_total = ?');
    values.push(encodeNumber(input.insentif_total));
  }
  if (input.kwitansi !== undefined) {
    fields.push('kwitansi = ?');
    values.push(encodeKwitansi(input.kwitansi));
  }
  const update = db.transaction(() => {
    if (fields.length) {
      values.push(document.id);
      db.prepare(`UPDATE incentive_documents SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    }
    if (Array.isArray(input.golongan_rows)) {
      if (!validateGolonganRows(input.golongan_rows)) throw new Error('Invalid Golongan rows');
      db.prepare('DELETE FROM golongan_rows WHERE document_id = ?').run(document.id);
      insertGolonganRows(db, document.id, input.golongan_rows);
    }
    if (Array.isArray(input.criteria_rows)) {
      upsertCriteriaRows(db, document.id, input.criteria_rows);
    }
  });
  update();
}

function validateGolonganRows(rows) {
  if (!Array.isArray(rows) || rows.length > 50) return false;
  return rows.every((row, index) => {
    if (!row) return false;
    if (row.parent_index !== undefined && !(Number.isInteger(row.parent_index) && row.parent_index >= 0 && row.parent_index < index)) return false;
    if (row.label != null && String(row.label).length > 80) return false;
    if (row.target != null && !(Number.isFinite(Number(row.target)) && Number(row.target) >= 0)) return false;
    if (row.achievement != null && !(Number.isFinite(Number(row.achievement)) && Number(row.achievement) >= 0)) return false;
    return true;
  });
}

function insertGolonganRows(db, documentId, rows) {
  if (!validateGolonganRows(rows)) throw new Error('Invalid Golongan rows');
  const insert = db.prepare(`
    INSERT INTO golongan_rows (document_id, parent_id, label, principal_id, brand_id, target, achievement, sort_order, is_group)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ids = [];
  rows.forEach((row, index) => {
    const parentId = row.parent_index === undefined ? null : ids[row.parent_index];
    if (row.parent_index !== undefined && !parentId) throw new Error('Invalid Golongan parent');
    const result = insert.run(documentId, parentId, row.label || null, row.principal_id || null, row.brand_id || null, row.target ?? null, row.achievement ?? null, row.sort_order ?? index, row.is_group ? 1 : 0);
    ids[index] = result.lastInsertRowid;
  });
}

function upsertCriteriaRows(db, documentId, rows) {
  if (!Array.isArray(rows)) return;
  const existing = db.prepare('SELECT criteria_id FROM document_criteria_rows WHERE document_id = ?').all(documentId);
  const existingIds = new Set(existing.map(r => r.criteria_id));
  const update = db.prepare(`
    UPDATE document_criteria_rows SET target_value = ?, achievement_value = ?, percentage = ?, status = ?, incentive_amount = ?
    WHERE document_id = ? AND criteria_id = ?
  `);
  rows.forEach(row => {
    if (!existingIds.has(row.criteria_id)) return; // snapshot: only update existing, never insert new
    const target = parseMoney(row.target_value);
    const achievement = parseMoney(row.achievement_value);
    const incentive = parseMoney(row.incentive_amount);
    const pctTarget = target ?? 0;
    const pctAchievement = achievement ?? 0;
    const percentage = pctTarget > 0 ? (pctAchievement / pctTarget) * 100 : 0;
    const status = pctTarget > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur';
    update.run(target, achievement, percentage, status, incentive, documentId, row.criteria_id);
  });
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isValidPeriod(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// Batasan: satu sales = satu insentif per periode (nama case-insensitive, kosong dilewati).
function findDuplicateDoc(db, salesman, period, excludeId = null) {
  const name = String(salesman || '').trim().toLowerCase();
  if (!name || !period) return null;
  return db.prepare(`
    SELECT id, salesman, period FROM incentive_documents
    WHERE lower(trim(salesman)) = ? AND period = ? AND (? IS NULL OR id != ?)
    LIMIT 1
  `).get(name, period, excludeId, excludeId) || null;
}

// Insentif total stored as REAL; null/invalid → NULL (null = use auto-sum on the client)
function encodeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Kwitansi stored as JSON TEXT; only the five receipt fields are kept
function encodeKwitansi(k) {
  if (!k || typeof k !== 'object') return null;
  const clean = {
    penerima: typeof k.penerima === 'string' ? k.penerima : '',
    jumlahUang: typeof k.jumlahUang === 'string' ? k.jumlahUang : '',
    keterangan: typeof k.keterangan === 'string' ? k.keterangan : '',
    terbilang: typeof k.terbilang === 'string' ? k.terbilang : '',
    nominal: typeof k.nominal === 'string' ? k.nominal : '',
  };
  return JSON.stringify(clean);
}

function decodeKwitansi(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function writeAudit(db, actorId, action, entityType, entityId, oldValue, newValue) {
  db.prepare(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(actorId, action, entityType, entityId, JSON.stringify(oldValue), JSON.stringify(newValue));
}

module.exports = createDocumentsRouter;