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
      const users = db.prepare('SELECT id, username, role, parent_id, active FROM users').all();
      res.json({ users });
    } catch (err) {
      console.error('GET /api/users error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  // Get hierarchy chain for current user (BM → SPV → Sales)
  router.get('/hierarchy', auth, (req, res) => {
    try {
      const userId = req.user.id;
      // Build chain: walk up parent_id from current user
      const chain = [];
      let currentId = userId;
      const visited = new Set();
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const u = db.prepare('SELECT id, username, role, parent_id FROM users WHERE id = ? AND active = 1').get(currentId);
        if (!u) break;
        chain.unshift({ id: u.id, username: u.username, role: u.role });
        currentId = u.parent_id;
      }
      // Get subordinates (people who report to anyone in chain)
      const subordinateIds = chain.map((u) => u.id);
      const placeholders = subordinateIds.map(() => '?').join(',');
      const subordinates = db.prepare(`SELECT id, username, role, parent_id FROM users WHERE active = 1 AND parent_id IN (${placeholders})`).all(...subordinateIds);
      res.json({ chain, subordinates });
    } catch (err) {
      console.error('GET /api/users/hierarchy error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  router.post('/', auth, role('superadmin'), async (req, res) => {
    try {
      const { username, password, role: userRole } = req.body;
      if (!validateUsername(username) || !validatePassword(password) || !userRole || !VALID_ROLES.includes(userRole)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username must be lowercase and password must contain at least 6 characters' } });
      }
      if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'Username already exists' } });
      }

      const passwordHash = await hashPassword(password);
      const info = db.prepare(`
        INSERT INTO users (username, password_hash, role, created_by, active)
        VALUES (?, ?, ?, ?, 1)
      `).run(username, passwordHash, userRole, req.user.id);

      res.status(201).json({ message: 'User created', user: { id: info.lastInsertRowid, username, role: userRole } });
    } catch (err) {
      console.error('POST /api/users error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  router.patch('/:id', auth, role('superadmin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role: userRole, active, parent_id } = req.body;
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
      if (updates.length > 0) {
        values.push(id);
        db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
      }

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