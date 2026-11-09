const express = require('express');
const { requireAuth, requireRole } = require('../middleware.js');

const VALID_TYPES = ['BM', 'SPV', 'SALES'];

// Aturan hierarki: SPV wajib parent BM; SALES wajib parent SPV. Berlaku untuk create & update.
function hierarchyError(db, position_type, parent_position_id) {
  const want = position_type === 'SPV' ? 'BM' : position_type === 'SALES' ? 'SPV' : null;
  if (!want) return null;
  if (!parent_position_id) return `${position_type} must be linked to a ${want}`;
  const parent = db.prepare('SELECT position_type FROM positions WHERE id = ?').get(parent_position_id);
  if (!parent || parent.position_type !== want) return `${position_type} parent must be a ${want}`;
  return null;
}

function createPositionsRouter(db, options = {}) {
  const router = express.Router();
  const auth = options.requireAuth || requireAuth;
  const role = options.requireRole || requireRole;

  // List all positions with their branches and criteria (2 query total, bukan per baris).
  // Any authed user (officer picks salesman names for document header).
  router.get('/', auth, (req, res) => {
    try {
      const positions = db.prepare('SELECT id, name, sales_code, position_type, join_date, parent_position_id, branch_id, active FROM positions ORDER BY position_type, name').all();
      const branchesBy = new Map();
      for (const r of db.prepare('SELECT position_id, branch_id FROM position_branches').all()) {
        if (!branchesBy.has(r.position_id)) branchesBy.set(r.position_id, []);
        branchesBy.get(r.position_id).push(r.branch_id);
      }
      const criteriaBy = new Map();
      for (const r of db.prepare('SELECT position_id, criteria_id FROM position_criteria').all()) {
        if (!criteriaBy.has(r.position_id)) criteriaBy.set(r.position_id, []);
        criteriaBy.get(r.position_id).push(r.criteria_id);
      }
      const result = positions.map((p) => ({
        ...p,
        branch_ids: branchesBy.get(p.id) || [],
        criteria_ids: criteriaBy.get(p.id) || [],
      }));
      res.json({ positions: result });
    } catch (err) {
      console.error('GET /api/positions error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  // Create position
  router.post('/', auth, role('superadmin'), (req, res) => {
    try {
      const { name, position_type, join_date, parent_position_id, branch_ids, criteria_ids, sales_code } = req.body;
      if (!name || !position_type || !VALID_TYPES.includes(position_type)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name and valid position_type (BM/SPV/SALES) required' } });
      }
      const hierarchyMsg = hierarchyError(db, position_type, parent_position_id);
      if (hierarchyMsg) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: hierarchyMsg } });
      }

      const create = db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO positions (name, sales_code, position_type, join_date, parent_position_id, branch_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(name.trim(), sales_code || null, position_type, join_date || null, parent_position_id || null, branch_ids?.[0] || null);
        const positionId = info.lastInsertRowid;

        if (Array.isArray(branch_ids) && branch_ids.length > 0) {
          const insBranch = db.prepare('INSERT OR IGNORE INTO position_branches (position_id, branch_id) VALUES (?, ?)');
          branch_ids.forEach((bid) => insBranch.run(positionId, bid));
        }
        if (Array.isArray(criteria_ids) && criteria_ids.length > 0) {
          const insCrit = db.prepare('INSERT OR IGNORE INTO position_criteria (position_id, criteria_id) VALUES (?, ?)');
          criteria_ids.forEach((cid) => insCrit.run(positionId, cid));
        }
        return positionId;
      });

      const positionId = create();
      res.status(201).json({ message: 'Position created', position: { id: positionId, name, sales_code, position_type, join_date, parent_position_id, branch_ids: branch_ids || [], criteria_ids: criteria_ids || [] } });
    } catch (err) {
      console.error('POST /api/positions error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  // Update position
  router.patch('/:id', auth, role('superadmin'), (req, res) => {
    try {
      const { id } = req.params;
      const { name, position_type, join_date, parent_position_id, branch_ids, criteria_ids, active, sales_code } = req.body;
      const position = db.prepare('SELECT id, position_type, parent_position_id FROM positions WHERE id = ?').get(id);
      if (!position) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
      }
      if (position_type !== undefined && !VALID_TYPES.includes(position_type)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid position type' } });
      }
      // Aturan hierarki sama dengan create — validasi gabungan nilai lama + perubahan.
      if (position_type !== undefined || parent_position_id !== undefined) {
        const hierarchyMsg = hierarchyError(
          db,
          position_type !== undefined ? position_type : position.position_type,
          parent_position_id !== undefined ? (parent_position_id || null) : position.parent_position_id
        );
        if (hierarchyMsg) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: hierarchyMsg } });
        }
      }

      const updates = [];
      const values = [];
      if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
      if (sales_code !== undefined) { updates.push('sales_code = ?'); values.push(sales_code || null); }
      if (position_type !== undefined) { updates.push('position_type = ?'); values.push(position_type); }
      if (join_date !== undefined) { updates.push('join_date = ?'); values.push(join_date || null); }
      if (parent_position_id !== undefined) { updates.push('parent_position_id = ?'); values.push(parent_position_id || null); }
      if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }

      db.transaction(() => {
        if (updates.length > 0) {
          values.push(id);
          db.prepare(`UPDATE positions SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        }
        if (Array.isArray(branch_ids)) {
          db.prepare('DELETE FROM position_branches WHERE position_id = ?').run(id);
          const insBranch = db.prepare('INSERT OR IGNORE INTO position_branches (position_id, branch_id) VALUES (?, ?)');
          branch_ids.forEach((bid) => insBranch.run(id, bid));
        }
        if (Array.isArray(criteria_ids)) {
          db.prepare('DELETE FROM position_criteria WHERE position_id = ?').run(id);
          const insCrit = db.prepare('INSERT OR IGNORE INTO position_criteria (position_id, criteria_id) VALUES (?, ?)');
          criteria_ids.forEach((cid) => insCrit.run(id, cid));
        }
      })();

      res.json({ message: 'Position updated' });
    } catch (err) {
      console.error('PATCH /api/positions/:id error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  // Delete position
  router.delete('/:id', auth, role('superadmin'), (req, res) => {
    try {
      const { id } = req.params;
      const position = db.prepare('SELECT id FROM positions WHERE id = ?').get(id);
      if (!position) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
      }
      db.prepare('DELETE FROM positions WHERE id = ?').run(id);
      res.json({ message: 'Position deleted' });
    } catch (err) {
      console.error('DELETE /api/positions/:id error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  return router;
}

module.exports = createPositionsRouter;
