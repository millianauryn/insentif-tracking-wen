# Deploy

Production: nginx sajikan `client/dist`, Express jalan sebagai API di `:3002`. Tidak ada Dockerfile — install manual di server Linux.

## Posisi di server

```
/srv/incentive/                    ← clone repo
/srv/incentive/client/dist/        ← hasil `npm run build`
/srv/incentive/server/data/incentive.sqlite   ← database (jangan di-commit)
/etc/incentive-api.env             ← environment variable API
/etc/nginx/sites-available/incentive         ← dari deploy/nginx.conf
```

## Langkah

### 1. Clone + build

```bash
git clone <repo-url> /srv/incentive
cd /srv/incentive/client && npm ci && npm run build
cd ../server && npm ci --omit=dev
```

### 2. User + environment

```bash
useradd --system --home /srv/incentive --shell /usr/sbin/nologin incentive
chown -R incentive:incentive /srv/incentive/server/data
```

Buat `/etc/incentive-api.env` (mode `600`, owner `root`):

```
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=<password ≥6 karakter, hanya dipakai saat seed awal>
CLIENT_ORIGIN=https://incentive.example.com
PORT=3002
```

`SUPERADMIN_PASSWORD` wajib ada saat database pertama dibuat (`server/db.js` menolak start tanpa itu).

### 3. Service API

```bash
cp deploy/incentive-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now incentive-api
curl http://127.0.0.1:3002/api/health   # → {"status":"ok","service":"incentive-tracking-api"}
```

### 4. nginx + HTTPS

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/incentive
ln -s /etc/nginx/sites-available/incentive /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d incentive.example.com
```

**HTTPS wajib.** Dengan `NODE_ENV=production` cookie session dibuat `secure`, jadi login lewat HTTP polos gagal diam-diam.

### 5. Verifikasi

Buka `https://incentive.example.com` → login superadmin → `GET /api/health` masih `ok`.

## Catatan

- `NODE_ENV=production` mematikan `/api/auth/dev-login` dan `?__seed=1` (backdoor dev). Unit service sudah mengaturnya.
- Update: `git pull`, rebuild client, `systemctl restart incentive-api`.
- Backup: salin `server/data/incentive.sqlite` (idealnya saat service berhenti, atau lewat `sqlite3 ... ".backup"`).
- Rollback: `git checkout <tag>` lalu rebuild + restart.
