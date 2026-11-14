const crypto = require('crypto');

function validateUsername(username) {
  return typeof username === 'string' && username.length > 0 && username.length <= 80 && username === username.toLowerCase();
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

async function verifyPassword(password, encodedHash) {
  return new Promise((resolve) => {
    const [saltHex, keyHex] = String(encodedHash || '').split(':');
    if (!saltHex || !keyHex) return resolve(false);
    const salt = Buffer.from(saltHex, 'hex');
    const key = Buffer.from(keyHex, 'hex');
    if (salt.length === 0 || key.length !== 64) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      resolve(key.length === derivedKey.length && crypto.timingSafeEqual(key, derivedKey));
    });
  });
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  const stmt = db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(tokenHash, userId, expiresAt);
  return { token, expiresAt };
}

function deleteSession(db, token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const stmt = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  stmt.run(tokenHash);
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  validateUsername,
  validatePassword,
};