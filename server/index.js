const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { authLimiter } = require('./rate-limit.js');
const { openDatabase, migrateDatabase, seedDatabase } = require('./db.js');
const { hashPassword, verifyPassword, createSession, deleteSession, validateUsername, validatePassword } = require('./auth.js');
const { configureAuthDatabase, requireAuth, requireRole } = require('./middleware.js');
const createUsersRouter = require('./routes/users.js');
const createMasterDataRouter = require('./routes/master-data.js');
const createCriteriaRouter = require('./routes/criteria.js');
const createDocumentsRouter = require('./routes/documents.js');
const createDevAuthRouter = require('./routes/dev-auth.js');
const createPositionsRouter = require('./routes/positions.js');

// Default lokal: tanpa NODE_ENV dianggap development (dev-login aktif).
// Production WAJIB set NODE_ENV=production eksplisit — juga untuk cookie secure.
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.warn('WARNING: NODE_ENV tidak diset -> development. /api/auth/dev-login AKTIF (bisa login sebagai superadmin). Untuk production: set NODE_ENV=production.');
}

const app = express();
const port = Number(process.env.PORT) || 3002;

// Initialize database
const db = openDatabase();
migrateDatabase(db);
configureAuthDatabase(db);

// Security middleware
app.use(helmet());
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Auth routes
// Jabatan → kriteria bridge: officer's criteria = union of criteria from positions at their branches.
// superadmin (or unconfigured) → null → client shows all criteria.
// Cache 30 detik per user: perubahan jabatan/kriteria superadmin terlihat maks 30 dtk kemudian.
const CRITERIA_TTL_MS = 30_000;
const _criteriaCache = new Map(); // userId -> { ids, at }
function criteriaIdsForUser(userId, role) {
  if (role === 'superadmin') return null;
  const hit = _criteriaCache.get(userId);
  if (hit && Date.now() - hit.at < CRITERIA_TTL_MS) return hit.ids;
  const branchIds = db.prepare('SELECT branch_id FROM user_branches WHERE user_id = ?').all(userId).map((r) => r.branch_id);
  if (!branchIds.length) {
    _criteriaCache.set(userId, { ids: [], at: Date.now() });
    return [];
  }
  const ph = branchIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT DISTINCT pc.criteria_id FROM position_criteria pc
    JOIN position_branches pb ON pb.position_id = pc.position_id
    JOIN positions p ON p.id = pc.position_id AND p.active = 1
    WHERE pb.branch_id IN (${ph})
    UNION
    SELECT DISTINCT pc.criteria_id FROM position_criteria pc
    JOIN positions p ON p.id = pc.position_id AND p.active = 1
    WHERE p.branch_id IN (${ph})
  `).all(...branchIds, ...branchIds);
  const ids = rows.map((r) => r.criteria_id);
  _criteriaCache.set(userId, { ids, at: Date.now() });
  return ids;
}

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!validateUsername(username) || !validatePassword(password)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username must be lowercase and password must contain at least 6 characters' } });
    }

    const user = db.prepare('SELECT id, username, password_hash, role, active, avatar_key, avatar_color FROM users WHERE username = ?').get(username);
    if (!user || !user.active) {
      // Generic error to avoid user enumeration
      return res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'Invalid credentials' } });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'Invalid credentials' } });
    }

    const session = createSession(db, user.id);
    const userBranchIds = db.prepare('SELECT branch_id FROM user_branches WHERE user_id = ?').all(user.id).map((r) => r.branch_id);
    const userCriteriaIds = criteriaIdsForUser(user.id, user.role);
    res.cookie('session_token', session.token, {
      httpOnly: true,
      // COOKIE_SECURE=false allows production over plain HTTP (login breaks otherwise)
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        avatar_key: user.avatar_key ?? null,
        avatar_color: user.avatar_color ?? null,
        branch_ids: userBranchIds,
        criteria_ids: userCriteriaIds
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.session_token;
  if (token) {
    deleteSession(db, token);
  }
  res.clearCookie('session_token', { httpOnly: true, sameSite: 'lax' });
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const userBranchIds = db.prepare('SELECT branch_id FROM user_branches WHERE user_id = ?').all(req.user.id).map((r) => r.branch_id);
  const userCriteriaIds = criteriaIdsForUser(req.user.id, req.user.role);
  res.json({ user: { id: req.user.id, username: req.user.username, role: req.user.role, avatar_key: req.user.avatar_key ?? null, avatar_color: req.user.avatar_color ?? null, branch_ids: userBranchIds, criteria_ids: userCriteriaIds } });
});

// Dev-only quick login (404 in production, handled inside the router)
app.use('/api/auth', createDevAuthRouter(db));

// Protected example route
app.get('/api/protected', requireAuth, (req, res) => {
  res.json({ message: 'Protected data', user: req.user });
});

// Super admin only route example
app.get('/api/admin', requireAuth, requireRole('superadmin'), (req, res) => {
  res.json({ message: 'Super admin area', user: req.user });
});

// User management routes
app.use('/api/users', createUsersRouter(db));
app.use('/api/positions', createPositionsRouter(db));

// Master data routes
app.use('/api/master-data', createMasterDataRouter(db));

// Criteria and document format routes
app.use('/api', createCriteriaRouter(db));
app.use('/api/documents', createDocumentsRouter(db));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'incentive-tracking-api' });
});

// Built client — one port (:3002) serves UI + API so the app can go online without Vite.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const IMMUTABLE = 'public, max-age=31536000, immutable';

// Aset ber-hash: kirim berkas .gz kalau browser menerima gzip (dikompresi saat build),
// dan tandai immutable supaya tidak diunduh ulang.
app.use('/assets', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.includes('..')) return next();
  if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
  const gzPath = path.join(clientDist, 'assets', `${req.path}.gz`);
  if (!fs.existsSync(gzPath)) return next();
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('Content-Type', MIME[path.extname(req.path)] || 'application/octet-stream');
  res.setHeader('Cache-Control', IMMUTABLE);
  res.setHeader('Content-Length', fs.statSync(gzPath).size);
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(gzPath).pipe(res);
});
app.use('/assets', express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(clientDist, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));
// robots.txt asli: aplikasi private (Tailscale), jangan diindeks crawler.
// Tanpa ini path /robots.txt jatuh ke SPA fallback dan crawler menerima HTML.
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send('User-agent: *\nDisallow: /\n');
});
// Tidak ada sitemap untuk app private — balas 404, bukan HTML SPA.
app.get('/sitemap.xml', (_req, res) => {
  res.status(404).type('text/plain').send('Not found');
});
// SPA fallback for React Router (Express 5 has no '*' wildcard — use plain middleware)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Jaga referensi server: tanpa ini objek http.Server bisa di-GC, event loop jadi kosong,
// dan proses keluar sendiri (PM2: crash-loop).
let server;

async function start() {
  // Buang sesi kedaluwarsa saat start + sekali sehari (proses tunggal, SQLite sinkron).
  const sweep = () => db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  sweep();
  setInterval(sweep, 24 * 60 * 60 * 1000).unref();
  await seedDatabase(db);
  server = app.listen(port, () => {
    console.log(`Incentive API listening on http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} sudah dipakai proses lain. Hentikan proses itu (mis. "npm run dev" di server/) lalu jalankan ulang.`);
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, db, start };