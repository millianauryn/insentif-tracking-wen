# Manual Deployment Steps (Major Updates)

For major updates that require manual intervention or when CI/CD is not available.

## Prerequisites
- SSH access to Ubuntu server
- PM2 installed globally (`npm i -g pm2`)
- Node.js 20+ installed
- Git configured with deploy key

## Server Directory Structure
```
/opt/insetive-tracking/
├── server/          # Express API
├── client/          # React app (built to dist/)
├── ecosystem.config.js
└── .env             # Production environment variables
```

## Manual Deploy Sequence

```bash
# 1. SSH into server
ssh user@your-server-ip

# 2. Navigate to project
cd /opt/insetive-tracking

# 3. Pull latest code (develop or main)
git pull origin develop    # or main

# 4. Install server dependencies (requires package-lock.json)
cd server
npm ci

# 5. Build client
cd ../client
npm ci
npm run build

# 6. Reload PM2 with updated environment
pm2 reload all --update-env

# 7. Verify deployment
pm2 status
pm2 logs insetive-api --lines 50
curl -f http://localhost:3002/api/health
```

## Rollback (if needed)

```bash
# Check PM2 processes
pm2 status

# Rollback to previous git commit
cd /opt/insetive-tracking
git log --oneline -5
git checkout <previous-commit-hash>

# Re-run deploy steps 4-6
cd server && npm ci
cd ../client && npm ci && npm run build
pm2 reload all --update-env
```

## Environment Variables (.env on server)

```env
NODE_ENV=production
PORT=3002
CLIENT_ORIGIN=https://your-domain.com
# Database, JWT secrets, etc.
```

## PM2 Management

```bash
# View logs
pm2 logs insetive-api

# Restart manually
pm2 restart insetive-api

# Stop
pm2 stop insetive-api

# Show config
pm2 show insetive-api
```

## CI/CD Secrets Required (GitHub Repository Settings → Secrets → Actions)

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_KEY` | Private SSH key (deploy key with read access) |

## Branch Protection
- `develop` and `main` branches protected
- Required status checks: test-server, test-client, build-client
- Auto-deploy triggers on push to protected branches