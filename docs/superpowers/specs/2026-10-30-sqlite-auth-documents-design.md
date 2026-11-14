# SQLite Auth and Incentive Documents Design

## Intent

Ganti penyimpanan prototype dari `localStorage` menjadi SQLite melalui `better-sqlite3`. Tambahkan login, role authorization, master data, format dokumen, dokumen insentif, Golongan fleksibel, dan snapshot Kriteria.

## Roles and access

- `super_admin`: akun utama. Kelola user, divisi, principal, brand, format dokumen, dan Kriteria. Boleh membaca serta mengedit semua dokumen, termasuk dokumen `Final`.
- `officer`: membuat dokumen dan mengedit dokumen miliknya saat `Draft`. Boleh memfinalisasi dokumen miliknya. Tidak boleh mengedit dokumen `Final`.
- `observer`: membaca data yang diizinkan. Tidak boleh membuat, mengedit, atau memfinalisasi dokumen.

Server wajib menegakkan role, ownership, dan status. UI bukan batas keamanan.

## Document behavior

- Dokumen baru memakai `document_formats` dan Kriteria aktif terbaru.
- Kriteria master disalin ke `document_criteria_rows` saat dokumen dibuat.
- Perubahan Kriteria hanya berlaku untuk dokumen baru.
- Dokumen lama mempertahankan nama, target, formula, dan status Kriteria saat dibuat.
- `Golongan` memiliki baris fleksibel dan dapat membentuk group/product hierarchy.
- `Draft` dapat diedit Officer pemilik dan Super Admin.
- Officer pemilik dapat mengubah `Draft` menjadi `Final` setelah validasi.
- `Final` hanya dapat diedit Super Admin. Koreksi dicatat dalam audit log.

## Data model

- `users`: username, password hash, role, created by, timestamps, active flag.
- `sessions`: hashed session token, user ID, expiry, created timestamp.
- `divisions`: master divisi.
- `principals`: master principal.
- `brands`: brand linked to principal.
- `document_formats`: named format/version and active flag.
- `criteria_definitions`: current Super Admin-controlled Kriteria definitions.
- `incentive_documents`: owner, format, sales metadata, period, status, timestamps.
- `golongan_rows`: document-linked flexible rows with optional parent group, principal, brand, target, achievement, and sort order.
- `document_criteria_rows`: immutable per-document Kriteria snapshot with target/formula/result fields.
- `audit_logs`: corrections to finalized documents and privileged mutations.

All foreign keys enable SQLite foreign-key enforcement. Passwords and session tokens never store plaintext.

## API boundary

Use JSON error shape `{ error: { code, message } }`.

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `GET /api/master-data`
- `POST/PATCH/DELETE /api/master-data/...` for Super Admin
- `GET /api/document-formats`
- `GET /api/criteria-definitions`
- `POST/PATCH/DELETE /api/criteria-definitions` for Super Admin
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/:id`
- `PATCH /api/documents/:id` with server role/status checks
- `POST /api/documents/:id/finalize`

Authentication uses an HttpOnly, SameSite session cookie. CORS allows configured frontend origins only. Login and privileged mutation routes use rate limiting.

## Non-goals

- No PDF export.
- No SQLite trigger for role/status policy in first version.
- No external identity provider.
- No multi-tenant organization model.
- No migration of unrelated generated graph files into the database.

## Migration

Existing `localStorage` rows cannot be trusted as authenticated documents. Keep a one-time optional import path only if a logged-in Officer or Super Admin explicitly submits it. No silent migration and no destructive clearing of existing browser data.
