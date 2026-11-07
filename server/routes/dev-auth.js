const crypto = require('crypto');
const express = require('express');
const { createSession } = require('../auth.js');

// Dev-only quick login: fixed name -> role map, never user-supplied role.
const DEV_USERS = {
  super: 'superadmin',
  officer: 'officer',
  direksi: 'observer',
};

function notFound(res) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
}

function createDevAuthRouter(db) {
  const router = express.Router();

  router.post('/dev-login', async (req, res) => {
    // Fail closed hanya di production (NODE_ENV unset = development lokal → dev-login aktif).
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      return notFound(res);
    }

    const name = req.query.user;
    const role = DEV_USERS[name];
    if (!role) {
      return notFound(res);
    }

    try {
      let user = db.prepare('SELECT id, username, role, active FROM users WHERE username = ?').get(name);
      if (!user) {
        const passwordHash = crypto.randomBytes(16).toString('hex') + ':dev';
        const info = db.prepare('INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)').run(name, passwordHash, role);
        user = { id: info.lastInsertRowid, username: name, role, active: 1 };
      } else if (!user.active || user.role !== role) {
        db.prepare("UPDATE users SET active = 1, role = ?, updated_at = datetime('now') WHERE id = ?").run(role, user.id);
        user = { ...user, role, active: 1 };
      }

      const session = createSession(db, user.id);
      const userBranchIds = db.prepare('SELECT branch_id FROM user_branches WHERE user_id = ?').all(user.id).map((r) => r.branch_id);
      // Same jabatan → kriteria bridge as /auth/login (superadmin → null → all criteria)
      let userCriteriaIds = null;
      if (role !== 'superadmin' && userBranchIds.length) {
        const ph = userBranchIds.map(() => '?').join(',');
        userCriteriaIds = db.prepare(`
          SELECT DISTINCT pc.criteria_id FROM position_criteria pc
          JOIN position_branches pb ON pb.position_id = pc.position_id
          JOIN positions p ON p.id = pc.position_id AND p.active = 1
          WHERE pb.branch_id IN (${ph})
          UNION
          SELECT DISTINCT pc.criteria_id FROM position_criteria pc
          JOIN positions p ON p.id = pc.position_id AND p.active = 1
          WHERE p.branch_id IN (${ph})
        `).all(...userBranchIds, ...userBranchIds).map((r) => r.criteria_id);
      }
      res.cookie('session_token', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role,
          branch_ids: userBranchIds,
          criteria_ids: userCriteriaIds
        }
      });
    } catch (err) {
      console.error('Dev login error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  return router;
}

module.exports = createDevAuthRouter;
