const express = require('express');
const { requireAuth } = require('../middleware.js');
const { resolveSalesmanPositionId } = require('../db.js');
const { spvScopeError, computeSpvRows, spvCriteriaRows, storeSpvCriteriaRows } = require('../spv.js');

function createDocumentsRouter(db, options = {}) {
  const router = express.Router();
  const auth = options.requireAuth || requireAuth;

  router.get('/', auth, (req, res) => {
    const wide = ['superadmin', 'observer'].includes(req.user.role);
    const limitParam = req.query.limit === undefined ? null : Number(req.query.limit);
    const limit = limitParam === null ? null : Math.min(Math.max(Math.trunc(limitParam) || 1, 1), 500);
    const offset = Math.max(Math.trunc(Number(req.query.offset)) || 0, 0);
    const where = wide ? '' : 'WHERE d.owner_id = ?';
    const args = wide ? [] : [req.user.id];
    const total = db.prepare(`SELECT COUNT(*) c FROM incentive_documents d ${where}`).get(...args).c;
    // insentif_total NULL berarti gunakan auto-sum dari document_criteria_rows
    const sql = `SELECT d.*, COALESCE(d.insentif_total, COALESCE((SELECT SUM(c.incentive_amount) FROM document_criteria_rows c WHERE c.document_id = d.id), 0)) AS insentif_total FROM incentive_documents d ${where} ORDER BY d.updated_at DESC${limit === null ? '' : ' LIMIT ? OFFSET ?'}`;
    const documents = limit === null
      ? db.prepare(sql).all(...args)
      : db.prepare(sql).all(...args, limit, offset);
    res.json({ documents, total });
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

    // Dokumen SPV:Akumulasi dari dokumen sales Final di bawah SPV, untuk rentang bulan.
    const isSpv = input.doc_kind === 'spv';
    let spvPeriodEnd = null;
    if (isSpv) {
      const scopeMsg = spvScopeError(db, req.user, input.position_id);
      if (scopeMsg) return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: scopeMsg } });
      spvPeriodEnd = input.period_end || input.period;
      if (!isValidPeriod(spvPeriodEnd)) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'period_end harus valid (YYYY-MM)' } });
      }
      if (spvPeriodEnd < input.period) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Bulan akhir tidak boleh sebelum bulan mulai' } });
      }
      if (findDuplicateSpvDoc(db, input.position_id, input.period, spvPeriodEnd)) {
        return res.status(409).json({ error: { code: 'DUPLICATE_SPV_PERIOD', message: 'SPV ini sudah punya dokumen untuk rentang tersebut' } });
      }
    }
    if (!validateGolonganRows(input.golongan_rows || [])) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid Golongan rows' } });
    }
    if (!isSpv) {
      const dup = findDuplicateDoc(db, input.salesman, input.period, null, resolveSalesmanPositionId(db, input.salesman));
      if (dup) {
        return res.status(409).json({ error: { code: 'DUPLICATE_SALES_PERIOD', message: `Sales ${dup.salesman} sudah menerima insentif pada periode ${dup.period}` } });
      }
    }

    const create = db.transaction(() => {
      const ownerId = req.user.id;
      // Nama SPV disimpan di salesman agar tetap tampil di daftar "Dokumen Tersimpan".
      const spvRow = isSpv ? db.prepare('SELECT name FROM positions WHERE id = ?').get(Number(input.position_id)) : null;
      const result = db.prepare(`
        INSERT INTO incentive_documents (owner_id, format_id, division_id, salesman, salesman_position_id, product, period, period_end, doc_kind, position_id, status, wilayah, insentif_total, kwitansi, divisi)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ownerId, input.format_id, input.division_id || null, isSpv ? (spvRow?.name ?? null) : (input.salesman || null), isSpv ? null : resolveSalesmanPositionId(db, input.salesman), input.product || null, input.period, spvPeriodEnd, isSpv ? 'spv' : 'sales', isSpv ? Number(input.position_id) : null, isSpv ? 'Draft' : 'Final', input.wilayah || null, encodeNumber(input.insentif_total), encodeKwitansi(input.kwitansi), input.divisi || null);
      const documentId = result.lastInsertRowid;
      if (!isSpv) {
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
      } else {
        // SPV: baris kriteria dihitung server, insentif boleh diisi officer.
        const rows = spvCriteriaRows(
          db,
          { id: documentId, position_id: Number(input.position_id), period: input.period, period_end: spvPeriodEnd },
          Array.isArray(input.criteria_rows) ? input.criteria_rows : null
        );
        storeSpvCriteriaRows(db, documentId, rows);
      }
      return db.prepare('SELECT * FROM incentive_documents WHERE id = ?').get(documentId);
    });

    const created = create();
    writeAudit(db, req.user.id, 'CREATE', 'incentive_document', created.id, null, documentScalars(created));
    res.status(201).json({ document: created });
  });

  // Preview SPV: baris hasil hitung tanpa menyimpan dokumen, supaya tabel di halaman
  // SPV terisi sebelum officer menekan Simpan Draft.
  router.get('/spv/preview', auth, (req, res) => {
    const scopeMsg = spvScopeError(db, req.user, req.query.position_id);
    if (scopeMsg) return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: scopeMsg } });
    const start = String(req.query.period || '');
    const end = String(req.query.period_end || start);
    if (!isValidPeriod(start) || !isValidPeriod(end)) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Periode harus valid (YYYY-MM)' } });
    }
    const positionId = Number(req.query.position_id);
    const computed = computeSpvRows(db, positionId, start, end);
    // Kalau sudah ada draft SPV untuk SPV + rentang yang sama, insentif yang sudah
    // diketik ikut ditampilkan supaya pratinjau sama dengan dokumennya.
    const existing = db.prepare(`
      SELECT id FROM incentive_documents
      WHERE doc_kind = 'spv' AND status = 'Draft' AND position_id = ? AND period = ? AND ifnull(period_end, period) = ?
      LIMIT 1
    `).get(positionId, start, end);
    const criteria = existing
      ? spvCriteriaRows(db, getDocument(db, existing.id))
      : computed.criteria_rows;
    res.json({ ...computed, criteria_rows: criteria });
  });

  // Riwayat submission dokumen: siapa menginput dan kapan (berdasarkan audit log).
  router.get('/:id/history', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    const rows = db.prepare(`
      SELECT a.id, a.action, a.created_at,
             COALESCE(p.name, u.username) AS actor_name, u.role AS actor_role
      FROM audit_logs a
      JOIN users u ON u.id = a.actor_id
      LEFT JOIN positions p ON p.id = u.position_id
      WHERE a.entity_type = 'incentive_document' AND a.entity_id = ?
      ORDER BY a.created_at DESC, a.id DESC
    `).all(document.id);
    if (rows.length) return res.json({ history: rows });

    // Dokumen lama sebelum audit aktif: gunakan timestamp pada baris dokumen.
    const owner = db.prepare(`
      SELECT COALESCE(p.name, u.username) AS actor_name
      FROM users u LEFT JOIN positions p ON p.id = u.position_id WHERE u.id = ?
    `).get(document.owner_id);
    const fallback = [{ id: document.id, action: 'SUBMIT', created_at: document.created_at, actor_name: owner?.actor_name || 'Officer', actor_role: 'officer' }];
    if (document.updated_at && document.updated_at !== document.created_at) {
      fallback.unshift({ id: document.id, action: 'UPDATE', created_at: document.updated_at, actor_name: owner?.actor_name || 'Officer', actor_role: 'officer' });
    }
    res.json({ history: fallback });
  });

  router.get('/:id', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    res.json({ document: withLiveRows(db, document) });
  });

  router.patch('/:id', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    // Dokumen sales langsung Final: owner (officer) boleh mengedit ulang. SPV tetap Draft-only.
    const ownerCanEdit = document.owner_id === req.user.id && (document.doc_kind !== 'spv' || document.status === 'Draft');
    if (req.user.role !== 'superadmin' && !ownerCanEdit) {
      return res.status(409).json({ error: { code: 'DOCUMENT_LOCKED', message: 'Only owner can edit this document' } });
    }
    const input = req.body || {};
    // Dokumen SPV: baris selalu dihitung server; kunci rentang/SPV dibekukan saat Final.
    if (document.doc_kind === 'spv') {
      if (Array.isArray(input.golongan_rows)) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Baris SPV dihitung dari dokumen sales, tidak bisa diisi manual' } });
      }
      // Nama SPV selalu dari posisi, tidak pernah dari payload client.
      input.salesman = document.salesman;
      if (document.status === 'Final') {
        const locked = ['period', 'period_end', 'position_id'].filter((field) => input[field] !== undefined);
        if (locked.length) {
          return res.status(409).json({ error: { code: 'DOCUMENT_LOCKED', message: `Rentang periode dan SPV terkunci pada dokumen Final (${locked.join(', ')})` } });
        }
        // Baris sudah dibekukan saat Final — jangan ditimpa hasil hitung ulang.
        if (input.criteria_rows !== undefined) {
          return res.status(409).json({ error: { code: 'DOCUMENT_LOCKED', message: 'Baris kriteria SPV terkunci pada dokumen Final' } });
        }
      } else {
        const nextPosition = input.position_id !== undefined ? Number(input.position_id) : document.position_id;
        const scopeMsg = spvScopeError(db, req.user, nextPosition);
        if (scopeMsg) return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: scopeMsg } });
        const nextPeriod = input.period !== undefined ? input.period : document.period;
        const nextEnd = input.period_end !== undefined ? input.period_end : (document.period_end || document.period);
        if (!isValidPeriod(nextPeriod) || !isValidPeriod(nextEnd)) {
          return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Periode harus valid (YYYY-MM)' } });
        }
        if (nextEnd < nextPeriod) {
          return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Bulan akhir tidak boleh sebelum bulan mulai' } });
        }
        if (findDuplicateSpvDoc(db, nextPosition, nextPeriod, nextEnd, document.id)) {
          return res.status(409).json({ error: { code: 'DUPLICATE_SPV_PERIOD', message: 'SPV ini sudah punya dokumen untuk rentang tersebut' } });
        }
        // Ganti SPV -> nama pejabat ikut berubah.
        if (input.position_id !== undefined && Number(input.position_id) !== document.position_id) {
          const spvRow = db.prepare('SELECT name FROM positions WHERE id = ?').get(Number(input.position_id));
          if (spvRow) input.salesman = spvRow.name;
        }
      }
    }
    try {
      const nextSalesman = input.salesman !== undefined ? input.salesman : document.salesman;
      const nextPeriod = input.period !== undefined ? input.period : document.period;
      if (document.doc_kind !== 'spv') {
        const dup = findDuplicateDoc(db, nextSalesman, nextPeriod, document.id, resolveSalesmanPositionId(db, nextSalesman));
        if (dup) {
          return res.status(409).json({ error: { code: 'DUPLICATE_SALES_PERIOD', message: `Sales ${dup.salesman} sudah menerima insentif pada periode ${dup.period}` } });
        }
      }
      updateDocument(db, document, input);
      // Final SPV: baris sudah dibekukan — tidak dihitung ulang dari data terkini.
      if (document.doc_kind === 'spv' && document.status !== 'Final') {
        // Insentif per kriteria dari officer; target/tercapai tetap dihitung server.
        const refreshed = getDocument(db, document.id);
        const rows = spvCriteriaRows(db, refreshed, Array.isArray(input.criteria_rows) ? input.criteria_rows : null);
        storeSpvCriteriaRows(db, document.id, rows);
      }
    } catch (error) {
      if (error.message === 'Invalid period' || error.message === 'Invalid Golongan rows') {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: error.message } });
      }
      throw error;
    }
    // Rekam setiap submission/update (officer maupun koreksi superadmin) untuk riwayat.
    writeAudit(
      db, req.user.id, 'UPDATE', 'incentive_document', document.id,
      documentScalars(document),
      documentScalars(getDocument(db, document.id)),
    );
    res.json({ document: withLiveRows(db, getDocument(db, document.id)) });
  });

  router.delete('/:id', auth, (req, res) => {
    const document = getReadableDocument(db, req.user, req.params.id);
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    if (req.user.role !== 'superadmin' && document.owner_id !== req.user.id) {
      return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: 'Cannot delete this document' } });
    }
    const remove = db.transaction(() => {
      // anak (golongan/criteria) ikut terhapus via ON DELETE CASCADE di schema.sql
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
    if (document.doc_kind === 'spv') snapshotSpvRows(db, document);
    db.prepare("UPDATE incentive_documents SET status = 'Final', updated_at = datetime('now') WHERE id = ?").run(document.id);
    writeAudit(db, req.user.id, 'FINALIZE', 'incentive_document', document.id, documentScalars(document), documentScalars(getDocument(db, document.id)));
    res.json({ document: getDocument(db, document.id) });
  });

  return router;
}

function getReadableDocument(db, user, id) {
  const document = getDocument(db, id);
  if (!document || (user.role === 'officer' && document.owner_id !== user.id)) return null;
  return document;
}

function getDocument(db, id) {  const document = db.prepare('SELECT * FROM incentive_documents WHERE id = ?').get(id);
  if (!document) return null;
  return {
    ...document,
    kwitansi: decodeKwitansi(document.kwitansi),
    golongan_rows: db.prepare('SELECT * FROM golongan_rows WHERE document_id = ? ORDER BY sort_order, id').all(id),
    criteria_rows: db.prepare('SELECT * FROM document_criteria_rows WHERE document_id = ? ORDER BY sort_order, id').all(id)
  };
}

// Dokumen SPV Draft: baris dihitung ulang dari dokumen sales Final terbaru.
function withLiveRows(db, document) {
  if (document.doc_kind !== 'spv' || document.status !== 'Draft') return document;
  const computed = computeSpvRows(db, document.position_id, document.period, document.period_end || document.period);
  return { ...document, golongan_rows: computed.golongan_rows, criteria_rows: spvCriteriaRows(db, document) };
}

// Finalisasi SPV: beku angka saat ini sebagai snapshot baris dokumen.
function snapshotSpvRows(db, document) {
  const computed = computeSpvRows(db, document.position_id, document.period, document.period_end || document.period);
  const criteria = spvCriteriaRows(db, document);
  const write = db.transaction(() => {
    db.prepare('DELETE FROM golongan_rows WHERE document_id = ?').run(document.id);
    db.prepare('DELETE FROM document_criteria_rows WHERE document_id = ?').run(document.id);
    computed.golongan_rows.forEach((row, index) => {
      db.prepare(`
        INSERT INTO golongan_rows (document_id, label, principal_id, brand_id, target, achievement, sort_order, is_group)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run(document.id, row.label ?? row.brand_name ?? null, row.principal_id, row.brand_id, row.target, row.achievement, index);
    });
    criteria.forEach((row) => {
      const target = Number(row.target_value) || 0;
      const achievement = Number(row.achievement_value) || 0;
      const percentage = target > 0 ? (achievement / target) * 100 : 0;
      db.prepare(`
        INSERT INTO document_criteria_rows (document_id, criteria_id, label, target_unit, formula, target_value, achievement_value, percentage, status, incentive_amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(document.id, row.criteria_id, row.label, row.target_unit, row.formula, target, achievement, percentage, target > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur', row.incentive_amount, row.sort_order);
    });
  });
  write();
}

function updateDocument(db, document, input) {
  const fields = [];
  const values = [];
  for (const field of ['division_id', 'salesman', 'product', 'period', 'period_end', 'position_id', 'format_id', 'wilayah', 'divisi']) {
    if (input[field] !== undefined) {
      if ((field === 'period' || field === 'period_end') && !isValidPeriod(input[field])) throw new Error('Invalid period');
      fields.push(`${field} = ?`);
      values.push(input[field]);
    }
  }
  if (input.insentif_total !== undefined) {
    fields.push('insentif_total = ?');
    values.push(encodeNumber(input.insentif_total));
  }
  // Tautan posisi ikut dihitung ulang saat nama salesman berubah —
  // agregasi SPV memakai id, jadi rename posisi tidak memutus hitungan.
  if (input.salesman !== undefined && document.doc_kind !== 'spv') {
    fields.push('salesman_position_id = ?');
    values.push(resolveSalesmanPositionId(db, input.salesman));
  }
  if (input.kwitansi !== undefined) {
    fields.push('kwitansi = ?');
    values.push(encodeKwitansi(input.kwitansi));
  }
  // Dokumen sales tidak punya tahap Draft: setiap simpan menjadikannya Final.
  if (document.doc_kind !== 'spv') {
    fields.push('status = ?');
    values.push('Final');
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
  const existing = db.prepare('SELECT criteria_id, label FROM document_criteria_rows WHERE document_id = ?').all(documentId);
  const existingIds = new Set(existing.map(r => r.criteria_id));
  // TOTAL OMZET: target selalu 100 (persen); officer hanya mengisi pencapaian dalam persen.
  const omzetIds = new Set(existing.filter(r => r.label === 'TOTAL OMZET').map(r => r.criteria_id));
  const update = db.prepare(`
    UPDATE document_criteria_rows SET target_value = ?, achievement_value = ?, percentage = ?, percentage_value = ?, status = ?, incentive_amount = ?
    WHERE document_id = ? AND criteria_id = ?
  `);
  rows.forEach(row => {
    if (!existingIds.has(row.criteria_id)) return; // snapshot: only update existing, never insert new
    const target = omzetIds.has(row.criteria_id) ? 100 : parseMoney(row.target_value);
    const achievement = parseMoney(row.achievement_value);
    const incentive = parseMoney(row.incentive_amount);
    const pctTarget = target ?? 0;
    const pctAchievement = achievement ?? 0;
    const percentage = pctTarget > 0 ? (pctAchievement / pctTarget) * 100 : 0;
    const status = pctTarget > 0 && percentage >= 100 ? 'Tercapai' : 'Gugur';
    // Persen manual officer (CALL COMPLIANCE) disimpan terpisah dari `percentage` hasil hitung.
    update.run(target, achievement, percentage, parseMoney(row.percentage_value), status, incentive, documentId, row.criteria_id);
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

// Batasan: satu sales = satu insentif per periode.
// Cek dua lapis: id posisi (menangkap sales yang sama walau posisi sudah diganti nama)
// lalu nama (untuk dokumen bebas/otomatis yang tidak punya tautan posisi).
function findDuplicateDoc(db, salesman, period, excludeId = null, positionId = null) {
  const name = String(salesman || '').trim().toLowerCase();
  if (!name || !period) return null;
  const byId = Number.isInteger(Number(positionId)) && Number(positionId) > 0
    ? db.prepare(`
        SELECT id, salesman, period FROM incentive_documents
        WHERE doc_kind = 'sales' AND salesman_position_id = ? AND period = ? AND (? IS NULL OR id != ?)
        LIMIT 1
      `).get(Number(positionId), period, excludeId, excludeId)
    : null;
  if (byId) return byId;
  return db.prepare(`
    SELECT id, salesman, period FROM incentive_documents
    WHERE doc_kind = 'sales' AND lower(trim(salesman)) = ? AND period = ? AND (? IS NULL OR id != ?)
    LIMIT 1
  `).get(name, period, excludeId, excludeId) || null;
}

// Batasan: satu SPV satu dokumen untuk satu rentang periode.
function findDuplicateSpvDoc(db, positionId, period, periodEnd, excludeId = null) {
  const id = Number(positionId);
  if (!Number.isInteger(id) || !period) return null;
  return db.prepare(`
    SELECT id FROM incentive_documents
    WHERE doc_kind = 'spv' AND position_id = ? AND period = ? AND ifnull(period_end, period) = ?
      AND (? IS NULL OR id != ?)
    LIMIT 1
  `).get(id, period, periodEnd, excludeId, excludeId) || null;
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

function documentScalars(d) {
  return {
    id: d.id, salesman: d.salesman, product: d.product, period: d.period,
    status: d.status, wilayah: d.wilayah, divisi: d.divisi ?? null,
    insentif_total: d.insentif_total, kwitansi: d.kwitansi ?? null,
  };
}

module.exports = createDocumentsRouter;