const express = require('express');
const { hashPassword, validatePassword, validateUsername } = require('../auth.js');
const { requireAuth, requireRole } = require('../middleware.js');

const VALID_ROLES = ['superadmin', 'officer', 'observer'];

function createUsersRouter(db, options = {}) {
  const router = express.Router();
  const auth = options.requireAuth || requireAuth;
  const role = options.requireRole || requireRole;

  router.get('/', auth, role('superadmin'), (req, res) => {
    try {
      const users = db.prepare('SELECT id, username, role, parent_id, active, sales_code, position_id FROM users').all();
      // Attach branch_ids for each user
      const branchStmt = db.prepare('SELECT branch_id FROM user_branches WHERE user_id = ?');
      const result = users.map((u) => ({
        ...u,
        branch_ids: branchStmt.all(u.id).map((r) => r.branch_id),
      }));
      res.json({ users: result });
    } catch (err) {
      console.error('GET /api/users error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  router.post('/', auth, role('superadmin'), async (req, res) => {
    try {
      const { username, password, role: userRole, branch_ids, sales_code, position_id } = req.body;
      if (!validateUsername(username) || !validatePassword(password) || !userRole || !VALID_ROLES.includes(userRole)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username must be lowercase and password must contain at least 6 characters' } });
      }
      if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'Username already exists' } });
      }
      // Officer must have at least 1 branch
      if (userRole === 'officer' && (!Array.isArray(branch_ids) || branch_ids.length === 0)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Officer must have at least one branch' } });
      }
      // Position must be active SALES type and share at least one selected branch
      if (position_id !== undefined && position_id !== null) {
        const pos = db.prepare('SELECT id, position_type FROM positions WHERE id = ? AND active = 1').get(position_id);
        if (!pos) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position not found or inactive' } });
        }
        if (pos.position_type !== 'SALES') {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position must be SALES type' } });
        }
        const posBranches = db.prepare('SELECT branch_id FROM position_branches WHERE position_id = ?').all(position_id).map((r) => r.branch_id);
        const hasCommonBranch = Array.isArray(branch_ids) && branch_ids.some((bid) => posBranches.includes(bid));
        if (!hasCommonBranch) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position must belong to at least one selected branch' } });
        }
      }

      const passwordHash = await hashPassword(password);
      const create = db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO users (username, password_hash, role, created_by, sales_code, position_id, active)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(username, passwordHash, userRole, req.user.id, sales_code || null, position_id || null);
        const userId = info.lastInsertRowid;
        if (Array.isArray(branch_ids) && branch_ids.length > 0) {
          const insBranch = db.prepare('INSERT OR IGNORE INTO user_branches (user_id, branch_id) VALUES (?, ?)');
          branch_ids.forEach((bid) => insBranch.run(userId, bid));
        }
        return userId;
      });

      const userId = create();
      res.status(201).json({ message: 'User created', user: { id: userId, username, role: userRole, branch_ids: branch_ids || [], sales_code, position_id } });
    } catch (err) {
      console.error('POST /api/users error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  router.patch('/:id', auth, role('superadmin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role: userRole, active, parent_id, branch_ids, sales_code, position_id } = req.body;
      const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      }
      if (userRole !== undefined && !VALID_ROLES.includes(userRole)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid role' } });
      }
      if (username !== undefined && !validateUsername(username)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username must be lowercase' } });
      }
      if (password !== undefined && !validatePassword(password)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password must contain at least 6 characters' } });
      }
      if (username !== undefined && db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id)) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'Username already exists' } });
      }

      // Validasi lengkap dulu (termasuk officer wajib cabang) sebelum menulis apa pun.
      let finalRoleForCheck = userRole !== undefined ? userRole : user.role;
      if (Array.isArray(branch_ids) && finalRoleForCheck === 'officer' && branch_ids.length === 0) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Officer must have at least one branch' } });
      }

      const updates = [];
      const values = [];
      if (username !== undefined) {
        updates.push('username = ?');
        values.push(username);
      }
      if (password !== undefined) {
        updates.push('password_hash = ?');
        values.push(await hashPassword(password));
      }
      if (userRole !== undefined) {
        updates.push('role = ?');
        values.push(userRole);
      }
      if (active !== undefined) {
        updates.push('active = ?');
        values.push(active ? 1 : 0);
      }
      if (parent_id !== undefined) {
        updates.push('parent_id = ?');
        values.push(parent_id || null);
      }
      if (sales_code !== undefined) {
        updates.push('sales_code = ?');
        values.push(sales_code || null);
      }
      if (position_id !== undefined) {
        if (position_id === null) {
          updates.push('position_id = ?');
          values.push(null);
        } else {
          const pos = db.prepare('SELECT id, position_type FROM positions WHERE id = ? AND active = 1').get(position_id);
          if (!pos) {
            return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position not found or inactive' } });
          }
          if (pos.position_type !== 'SALES') {
            return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position must be SALES type' } });
          }
          const finalBranchIds = Array.isArray(branch_ids) ? branch_ids : db.prepare('SELECT branch_id FROM user_branches WHERE user_id = ?').all(id).map((r) => r.branch_id);
          const posBranches = db.prepare('SELECT branch_id FROM position_branches WHERE position_id = ?').all(position_id).map((r) => r.branch_id);
          const hasCommonBranch = finalBranchIds.some((bid) => posBranches.includes(bid));
          if (!hasCommonBranch) {
            return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Position must belong to at least one selected branch' } });
          }
          updates.push('position_id = ?');
          values.push(position_id);
        }
      }
      // Satu transaksi: field user + branch sync gagal/bersama — tidak ada update setengah jadi.
      db.transaction(() => {
        if (updates.length > 0) {
          values.push(id);
          db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        }
        // Update branches if provided (sudah divalidasi di atas)
        if (Array.isArray(branch_ids)) {
          db.prepare('DELETE FROM user_branches WHERE user_id = ?').run(id);
          const insBranch = db.prepare('INSERT OR IGNORE INTO user_branches (user_id, branch_id) VALUES (?, ?)');
          branch_ids.forEach((bid) => insBranch.run(id, bid));
        }
      })();

      res.json({ message: 'User updated' });
    } catch (err) {
      console.error('PATCH /api/users/:id error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  router.delete('/:id', auth, role('superadmin'), (req, res) => {
    try {
      const { id } = req.params;
      const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      }
      if (user.role === 'superadmin' && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'superadmin'").get().count === 1) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot delete the only Super Admin' } });
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      res.json({ message: 'User deleted' });
    } catch (err) {
      console.error('DELETE /api/users/:id error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  return router;
}

module.exports = createUsersRouter;