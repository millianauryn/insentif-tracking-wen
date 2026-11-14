const crypto = require('crypto');
const { openDatabase } = require('./db.js');

let configuredDb;

function configureAuthDatabase(db) {
  configuredDb = db;
}

function getDb() {
  if (!configuredDb) configuredDb = openDatabase();
  return configuredDb;
}

function requireAuth(req, res, next) {
  const token = req.cookies?.session_token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: { code: 'AUTH_MISSING', message: 'Authentication required' } });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = getDb().prepare(`
    SELECT s.*, u.id AS userId, u.username, u.role, u.avatar_key, u.avatar_color
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1
  `).get(tokenHash);

  if (!session) {
    return res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'Invalid or expired session' } });
  }

  req.user = { id: session.userId, username: session.username, role: session.role, avatar_key: session.avatar_key, avatar_color: session.avatar_color };
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'AUTH_FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  };
}

module.exports = { configureAuthDatabase, requireAuth, requireRole };