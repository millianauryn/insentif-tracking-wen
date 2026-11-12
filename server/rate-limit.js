const rateLimit = require('express-rate-limit');

// Batas percobaan login: 10x per menit per IP.
// Jendela sengaja pendek (1 menit) supaya user yang salah password tidak terkunci lama.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many login attempts, try again in 1 minute' } },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter };
