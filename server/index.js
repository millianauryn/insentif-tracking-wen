const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { openDatabase, migrateDatabase, seedDatabase } = require('./db.js');
const { hashPassword, verifyPassword, createSession, deleteSession, validateUsername, validatePassword } = require('./auth.js');
const { configureAuthDatabase, requireAuth, requireRole } = require('./middleware.js');
const createUsersRouter = require('./routes/users.js');
const createMasterDataRouter = require('./routes/master-data.js');
const createCriteriaRouter = require('./routes/criteria.js');
const createDocumentsRouter = require('./routes/documents.js');
const createDevAuthRouter = require('./routes/dev-auth.js');
const createPositionsRouter = require('./routes/positions.js');

const app = express();
const port = Number(process.env.PORT) || 3002;

// Initialize database
const db = openDatabase();
migrateDatabase(db);
configureAuthDatabase(db);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many login attempts, try later' } },
  standardHeaders: true,
  legacyHeaders: false
});

// Auth routes
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!validateUsername(username) || !validatePassword(password)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username must be lowercase and password must contain at least 6 characters' } });
    }

    const user = db.prepare('SELECT id, username, password_hash, role, active FROM users WHERE username = ?').get(username);
    if (!user || !user.active) {
      // Generic error to avoid user enumeration
      return res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'Invalid credentials' } });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'Invalid credentials' } });
    }

    const session = createSession(db, user.id);
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
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

app.post('/api/auth/logout', authLimiter, (req, res) => {
  const token = req.cookies?.session_token;
  if (token) {
    deleteSession(db, token);
  }
  res.clearCookie('session_token', { httpOnly: true, sameSite: 'lax' });
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
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

async function start() {
  await seedDatabase(db);
  app.listen(port, () => {
    console.log(`Incentive API listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, db, start };