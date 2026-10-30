# Insentif Tracking Wen

Prototype web untuk pencatatan insentif sales.

## Stack

- Frontend: React, Vite, Tailwind CSS dependency, CSS responsive
- Backend: Express.js, Helmet, CORS
- Prototype storage: `localStorage`

## Struktur

```text
client/   React frontend
server/   Express API
 docs/    Product requirements and design documents
```

## Menjalankan frontend

```powershell
cd client
npm install
npm run dev
```

Frontend berjalan pada URL yang ditampilkan Vite, biasanya `http://localhost:5173`.

## Menjalankan backend

```powershell
cd server
npm install
npm start
```

Health check:

```text
GET http://localhost:3001/api/health
```

## Verifikasi frontend

```powershell
cd client
npm test
npm run lint
npm run build
```

## Catatan prototype

Data input masih tersimpan di browser melalui `localStorage`. Backend baru menyediakan health check. Autentikasi, database, PDF export, dan role enforcement belum termasuk prototype ini.
