const express = require('express');
const { requireAuth, requireRole } = require('../middleware.js');

function createCriteriaRouter(db, options = {}) {
  const router = express.Router();
  const auth = options.requireAuth || requireAuth;
  const role = options.requireRole || requireRole;

  // Label khusus yang dipakai klien untuk input minus/percent — jangan diubah/diduplikasi.
  const RESERVED_LABELS = new Set(['GOL YG GUGUR KURANG DARI 50%', 'CALL COMPLIANCE']);

  router.get('/document-formats', auth, (req, res) => {
    const formats = db.prepare(`
      SELECT id, name, version, active
      FROM document_formats
      WHERE active = 1
      ORDER BY name, version
    `).all();
    res.json({ formats });
  });

  router.get('/criteria-definitions', auth, (req, res) => {
    const criteria = db.prepare(`
      SELECT id, label, target_unit, formula, sort_order, active
      FROM criteria_definitions
      WHERE active = 1
      ORDER BY sort_order, id
    `).all();
    res.json({ criteria });
  });

  router.post('/criteria-definitions', auth, role('superadmin'), (req, res) => {
    const { label, target_unit = null, formula = null, sort_order = 0 } = req.body;
    if (!isValidText(label, 120) || !Number.isInteger(sort_order) || sort_order < 0) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid criteria data' } });
    }
    if (RESERVED_LABELS.has(String(label).trim())) {
      return res.status(409).json({ error: { code: 'RESERVED_LABEL', message: 'Label ini dipakai khusus input insentif, tidak bisa dibuat ulang' } });
    }

    const result = db.prepare(`
      INSERT INTO criteria_definitions (label, target_unit, formula, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(label.trim(), target_unit, formula, sort_order);
    const criteria = db.prepare('SELECT id, label, target_unit, formula, sort_order, active FROM criteria_definitions WHERE id = ?').get(result.lastInsertRowid);
    writeAudit(db, req.user.id, 'CREATE', 'criteria_definition', criteria.id, null, criteria);
    res.status(201).json({ criteria });
  });

  router.patch('/criteria-definitions/:id', auth, role('superadmin'), (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT id, label, target_unit, formula, sort_order, active FROM criteria_definitions WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Criteria not found' } });
    }

    const next = {
      label: req.body.label === undefined ? current.label : req.body.label,
      target_unit: req.body.target_unit === undefined ? current.target_unit : req.body.target_unit,
      formula: req.body.formula === undefined ? current.formula : req.body.formula,
      sort_order: req.body.sort_order === undefined ? current.sort_order : req.body.sort_order,
      active: req.body.active === undefined ? current.active : (req.body.active ? 1 : 0)
    };
    if (!isValidText(next.label, 120) || !Number.isInteger(next.sort_order) || next.sort_order < 0) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid criteria data' } });
    }
    const wasReserved = RESERVED_LABELS.has(String(current.label).trim());
    const willBeReserved = RESERVED_LABELS.has(String(next.label).trim());
    if ((wasReserved || willBeReserved) && String(current.label).trim() !== String(next.label).trim()) {
      return res.status(409).json({ error: { code: 'RESERVED_LABEL', message: 'Label khusus input insentif tidak bisa diubah' } });
    }

    db.prepare(`
      UPDATE criteria_definitions
      SET label = ?, target_unit = ?, formula = ?, sort_order = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(next.label.trim(), next.target_unit, next.formula, next.sort_order, next.active, id);
    const criteria = db.prepare('SELECT id, label, target_unit, formula, sort_order, active FROM criteria_definitions WHERE id = ?').get(id);
    writeAudit(db, req.user.id, 'UPDATE', 'criteria_definition', id, current, criteria);
    res.json({ criteria });
  });

  router.delete('/criteria-definitions/:id', auth, role('superadmin'), (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT id, label, target_unit, formula, sort_order, active FROM criteria_definitions WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Criteria not found' } });
    }
    db.prepare("UPDATE criteria_definitions SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    writeAudit(db, req.user.id, 'DELETE', 'criteria_definition', id, current, { ...current, active: 0 });
    res.status(204).end();
  });

  return router;
}

function isValidText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function writeAudit(db, actorId, action, entityType, entityId, oldValue, newValue) {
  db.prepare(`
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, JSON.stringify(newValue));
}

module.exports = createCriteriaRouter;