# Insentif Tracking

Web pencatatan insentif sales: officer membuat Draft, observer (Direksi) menyetujui jadi Final.

Canonical spec: [docs/architecture.md](docs/architecture.md) — fungsi saat ini tidak boleh berubah tanpa ADR.

## Stack

- Frontend: React 19 + Vite 8 + Tailwind 4 (`client/`)
- Backend: Express 5 + better-sqlite3 (`server/`, production `:3002`, dev `:3003`)
- DB: `server/data/incentive.sqlite`

## Jalankan

```powershell
cd server; npm install; npm start              # production API :3002 (atau: pm2 start ecosystem.config.js)
cd server; npm run dev                         # dev API :3003, file DB sendiri (salinan produksi,第一次 dibuat)
cd client; npm install; npm run dev            # http://localhost:5173 (proxy /api -> :3003)
cd client; npm run build; npm run preview      # prod :4173 (proxy /api -> :3002)
cd client; npx vitest run
```

Health: `GET http://localhost:3002/api/health` → `{"status":"ok"}`

> Dev API di `:3003` supaya tidak merebut port `:3002` dari proses PM2 (server keluar sendiri kalau port sudah dipakai). Dev juga memakai file DB sendiri (`server/data/incentive.dev.sqlite`, salinan produksi saat pertama kali) — dua proses menulis file SQLite yang sama membuat proses production crash saat dev restart. Hapus file dev lalu jalankan ulang untuk mengambil salinan terbaru.

## Login

UI: `/login` (username huruf kecil, password ≥6). Rate limit 10/15 mnt. Masuk cepat hanya di development (server `dev-login`, mati di production).
