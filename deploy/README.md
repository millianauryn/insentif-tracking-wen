# Deploy

Production: sajikan `client/dist` sebagai web, Express jalan sebagai API di `:3002`. Dua jalur: **Docker (disarankan)** atau manual (nginx + systemd di bawah).

## Docker (disarankan)

Domain dan path diatur di **satu file `.env`**:

- **Domain** → `DOMAIN=` di `.env` (contoh `incentive.example.com`). DNS A record domain itu harus menunjuk IP server; port 80 + 443 harus terbuka. Caddy (container `web`) ambil sertifikat Let's Encrypt otomatis — tanpa certbot.
- **Path** → repo di `/srv/incentive`; database produksi di `/srv/incentive/data/incentive.sqlite` (bind mount `./data:/app/data`); file web tidak ada di host (tertanam di image `web`).

```bash
git clone <repo-url> /srv/incentive
cd /srv/incentive
cp .env.example .env         # isi DOMAIN, SUPERADMIN_PASSWORD
docker compose up -d --build
```

Verifikasi:

```bash
curl https://<domain>/api/health     # → {"status":"ok",...}
docker compose ps                    # api healthy, web running
```

Operasi harian:

```bash
docker compose logs -f api           # log API
docker compose restart api           # restart API
git pull && docker compose up -d --build   # update
# backup: salin /srv/incentive/data/incentive.sqlite
```

Catatan Docker:

- `NODE_ENV=production` dipaksa di `docker-compose.yml` — dev-login mati, cookie `secure` aktif (itu sebabnya HTTPS wajib).
- `SUPERADMIN_PASSWORD` hanya dipakai saat database pertama dibuat; sesudah itu ganti di aplikasi.
- Tanpa Docker Desktop/Engine, `docker compose` tidak jalan — pakai jalur manual di bawah.

## Manual (tanpa Docker)

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
