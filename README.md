# Insentif Tracking

Web pencatatan insentif sales: officer membuat Draft, observer (Direksi) menyetujui jadi Final.

Canonical spec: [docs/architecture.md](docs/architecture.md) — fungsi saat ini tidak boleh berubah tanpa ADR.

## Stack

- Frontend: React 19 + Vite 8 + Tailwind 4 (`client/`)
- Backend: Express 5 + better-sqlite3 (`server/`, :3002)
- DB: `server/data/incentive.sqlite`

## Jalankan

```powershell
cd server; npm install; npm start
cd client; npm install; npm run dev        # http://localhost:5173
cd client; npm run build; npm run preview  # prod :4173
cd client; npx vitest run
```

Health: `GET http://localhost:3002/api/health` → `{"status":"ok"}`

## Login

UI: `/login` (username huruf kecil, password ≥6). Rate limit 10/15 mnt. Masuk cepat hanya di development (server `dev-login`, mati di production).
