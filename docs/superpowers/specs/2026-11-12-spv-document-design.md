# Dokumen Insentif SPV — Design Doc

Tanggal: 2026-11-12
Status: sudah diimplementasikan (2026-11-12)

## Intent

Halaman `/documents/spv` hari ini hanya menampilkan placeholder ("Belum ada data rekap SPV").
Isinya harus berupa dokumen insentif tingkat SPV yang **diakumulasi dari dokumen sales di
bawah naungan SPV itu**, dalam rentang bulan yang dipilih officer.

Mengapa: SPV membawahi beberapa sales. Perhitungan insentif SPV melihat angka gabungan semua
sales yang dibawahi pada periode tertentu, sehingga officer tidak perlu menjumlah manual.

## Goals

1. Officer memilih SPV + rentang bulan → dokumen SPV berisi golongan (brand/principal) dan
   kriteria yang diakumulasi dari dokumen sales **Final** di rentang itu.
2. Angka golongan dan kriteria **tidak pernah diketik officer** — hanya insentif total yang
   diinput manual.
3. Saat Draft, angka selalu mengikuti sales terbaru. Saat Final, angka membeku.
4. Dokumen SPV tampil di daftar "Dokumen Tersimpan" bersama dokumen sales, bisa dicetak dan
   di-finalisasi lewat jalur yang sudah ada.

## Non-goals

- Halaman BM tetap placeholder.
- Perubahan perilaku dokumen sales yang sudah ada.
- Merapikan pertemuan nama `salesman` ↔ `positions.name` (lihat Risiko).
- Perataan/rata-rata antar bulan. Rentang = penjumlahan biasa.

## Anti-goals

- Golongan/kriteria di dokumen SPV tidak boleh bisa diedit tangan.
- Dokumen SPV yang sudah Final tidak boleh berubah sendiri, bahkan kalau sales mengubah
  atau menerbitkan dokumen baru.
- Tidak ada dependensi npm baru untuk fitur ini.

## Constraints

- Express 5: tidak ada wildcard route `'*'`; pakai middleware biasa.
- `better-sqlite3` sinkron; agregasi berjalan di dalam request.
- Gaya migrasi mengikuti `db.js`: cek `PRAGMA table_info` dulu, baru `ALTER TABLE`.
- Suite test yang ada harus tetap hijau: 61 server, 38 client.
- Tanpa Docker; deploy via PM2.

## Approaches yang dipertimbangkan

| | Cara kerja | Plus | Minus |
|---|---|---|---|
| **A. Snapshot saat simpan** | Server tulis baris hasil agregasi saat POST/PATCH | GET cetak/audit jalan tanpa diubah | Angka basi bila sales men-Final setelah SPV disimpan |
| **B. Selalu live** | Baris tidak disimpan, dihitung tiap GET | Angka selalu benar | Dokumen Final bisa berubah sendiri — merusak arti "Final" |
| **C. Live saat Draft, beku saat Final ✅** | Baris dihitung ulang tiap GET selama Draft; snapshot ditulis tepat saat finalisasi | Selalu terkini selama menyiapkan, dibekukan saat disepakati | Satu panggilan tambahan dari A |

**Dipilih: C.** Alasan: "Final" di aplikasi ini sudah berarti terkunci (hanya superadmin yang
boleh mengoreksi, wajib `audit_reason`). Membekukan angka tepat di momen itu paling nyambung.
B membuat Final kehilangan arti; A membuat officer bekerja di atas angka basi tanpa sadar.

## Keputusan

### Periode

- Rentang bulan, bukan satu bulan. Kontrak server tetap `YYYY-MM`.
- Tambah kolom `period_end TEXT` di `incentive_documents`. `period` = bulan mulai,
  `period_end` = bulan akhir. `period_end NULL` = dokumen lama / dokumen sales (satu bulan).
- Filter: `period >= mulai AND period <= akhir` (perbandingan teks aman untuk `YYYY-MM`).
- Label di header: "Sep 2026 – Nov 2026".

### Sumber data

- Sales di bawah SPV: `positions.parent_position_id = <SPV>` AND `position_type = 'SALES'`.
  Anak yang `active = 0` **tetap dihitung** — dokumen historis tidak hilang saat sales
  dinonaktifkan.
- Dokumen sales yang masuk: `doc_kind = 'sales' AND status = 'Final'` AND `period` di rentang
  AND `lower(trim(salesman))` cocok dengan nama anak SPV.
- `Document Draft` dari sales **tidak ikut** (diputuskan user).

### Golongan

- Baris data = `golongan_rows.is_group = 0` (baris brand). Baris `is_group = 1`
  (divisi/principal/total) **dilewati** — ikut menjumlah akan dobel.
- Kelompokkan per `(principal_id, brand_id, label)`, jumlahkan `target` dan `achievement`
  lintas semua dokumen dan semua bulan dalam rentang. Langsung jadi satu angka, tanpa
  pecahan bulan.
- Bangun ulang hierarki dari master data: brand → principal (`brands.principal_id`) →
  divisi (`principals.division_id`). Baris tanpa `principal_id` tetap tampil tanpa grup.
- Baris TOTAL dihitung di client lewat `computeGrandTotal` yang sudah ada.

### Kriteria

- Baris = semua `criteria_definitions` yang `active = 1` (sama seperti dokumen sales).
- `target_value` dan `achievement_value` = jumlah dari `document_criteria_rows` dokumen
  sales terpilih, dikelompokkan per `criteria_id`.
- `percentage` dan `status` dihitung ulang dengan aturan yang sudah ada:
  `target > 0 ? achievement/target*100 : 0`, `>= 100` → "Tercapai", selain itu "Gugur".
- `incentive_amount` = `NULL`. Insentif SPV bukan jumlah insentif sales.

### Insentif

- Satu angka total, diinput officer, disimpan di `incentive_documents.insentif_total`
  lewat PATCH biasa (mekanisme `encodeNumber` / `null = auto-sum` yang sudah ada).

### Identitas dokumen

- Tambah kolom `doc_kind TEXT NOT NULL DEFAULT 'sales'` (nilai `'sales' | 'spv'`).
- Tambah kolom `position_id INTEGER REFERENCES positions(id)` — SPV mana dokumen ini miliknya.
  Ini juga sumber nama SPV untuk header, jadi tidak perlu pencocokan teks di client.
- `salesman` diisi nama SPV supaya daftar "Dokumen Tersimpan" tetap tampil tanpa diubah.
- Indeks unik lama `idx_doc_sales_period` dibangun ulang dengan syarat `doc_kind = 'sales'`
  (isinya tidak berubah, aman). Dokumen SPV pakai aturan unik sendiri:
  `(position_id, period, period_end)` — satu SPV satu rentang, satu dokumen.

### Cakupan officer (diputuskan human partner)

- Pilihan SPV dibatasi **cabang yang di-assign ke akun officer** (`user_branches`).
  Officer boleh memegang beberapa cabang dalam satu wilayah; rentang cakupan mengikuti
  apa yang di-assign di Data Master, dari awal sampai akhir.
- Sumber pilihan SPV = **Data Master Jabatan User** (`positions`), termasuk relasi
  SPV → sales (`parent_position_id`). Bukan dari tabel `users`.
- **Server wajib memvalidasi**, bukan cuma client: `position_id` yang dikirim harus punya
  minimal satu cabang yang intersect dengan `user_branches` pemohon → selain itu balas
  `403 AUTH_FORBIDDEN`. Superadmin lolos tanpa penyaringan (perilaku `isSuper` yang sudah ada).
- Agregasi memakai **semua** anak sales dari SPV terpilih. Karena SPV-nya sendiri sudah
  dikunci ke cabang officer, cakupan wilayah ikut terjaga.
  `shortcut: guard hanya di level SPV, bukan per sales; kalau sales boleh lintas cabang, tambah filter position_branches ∩ user_branches di query anak.`

### Peran

Mengikuti jalur yang sudah ada, tanpa perubahan:

- Buat/ubah/hapus: `officer` (dokumen miliknya) atau `superadmin`.
- Finalisasi: `observer` atau `superadmin`.
- Koreksi dokumen Final: `superadmin` + `audit_reason` minimal 3 karakter.

## Perubahan API

| Endpoint | Perubahan |
|---|---|
| `POST /api/documents` | Terima `doc_kind: 'spv'`, `position_id`, `period_end`. Untuk SPV: abaikan `golongan_rows`/`criteria_rows` dari client, validasi `period_end` ≥ `period`, **validasi `position_id` ada di cabang officer** (superadmin lolos), cek unik rentang per SPV. Kwitansi lewat `encodeKwitansi` biasa. |
| `GET /api/documents/:id` | Untuk SPV berstatus **Draft**: kembalikan baris hasil hitung, bukan baris tersimpan. Baris yang dikembalikan berbentuk sama seperti `golongan_rows` / `criteria_rows` biasa. |
| `PATCH /api/documents/:id` | Untuk SPV: izinkan `period`, `period_end`, `position_id`, `wilayah`, `insentif_total`, `divisi`, `kwitansi`; **tolak** `golongan_rows` dan `criteria_rows`. Pada status **Final**, `period` / `period_end` / `position_id` ikut dikunci (`409 DOCUMENT_LOCKED`) walau untuk superadmin. |
| `POST /api/documents/:id/finalize` | Untuk SPV: sebelum status diubah, tulis snapshot baris hasil hitung ke `golongan_rows` + `document_criteria_rows`. |
| `GET /api/documents` | Tidak diubah (`SELECT *` sudah mengembalikan `doc_kind` dan `period_end`). |

Satu fungsi agregasi `computeSpvRows(db, positionId, periodStart, periodEnd)` dipakai dua
tempat: GET saat Draft, dan finalize.

## Perubahan client

- `Documents.jsx`: ganti cabang `docType === 'spv'` dari placeholder jadi halaman nyata.
- **Header pembeda** (4 field): Wilayah · Jabatan · Nama pejabat (SPV) · Bulan (rentang).
  - Wilayah: kota milik SPV (`positions.branch_id` → `branches.city`), fallback dari
    `position_branches`.
  - Jabatan: `SPV`.
  - Nama: nama posisi SPV.
  - Bulan: 1 bulan → `"Oktober 2026"`; multi bulan → `"Sep 2026 – Nov 2026"` (aturan yang
    sama dengan kartu di daftar).
- Input baru di halaman: **pilih SPV** (ComboSelect dari `positions` ber-`position_type='SPV'`)
  dan **rentang bulan** (bulan mulai + tahun, bulan akhir + tahun — memakai `monthNames()`
  yang sudah ada, tahun diketik manual seperti pola `pickMonth` sekarang).
- Tabel golongan: tampil, **read-only**.
- Tabel kriteria: tampil, **read-only**.
- Insentif total: input manual (pakai `insentifTotal` + `setInsentifTotal` yang sudah ada).
- Kwitansi: muncul seperti halaman sales, tanda tangan `nama = SPV`, `jabatan = SPV`.
- Tombol Cetak / Simpan Draft / Finalisasi: sama seperti halaman sales.
- Daftar "Dokumen Tersimpan" (`Insetif.jsx`): lencana **`SPV`**, tampil bersama dokumen
  sales, periode kartu menyesuaikan (1 bulan → "Oktober 2026", multi bulan →
  "Sep 2026 – Nov 2026").

## Risiko dan batasan yang disengaja

- **Pencocokan nama.** Sales dihubungkan ke dokumen lewat teks `salesman`, bukan FK. Agregasi
  SPV memakai `lower(trim(salesman))` terhadap `positions.name`. Nama yang diubah di Data
  Master atau nama sama di cabang berbeda membuat angka salah.
  `shortcut: agregasi SPV match by name, upgrade path = tambah positions.id ke sales document.`
- **Baris brand tanpa `brand_id`.** Baris yang diketik bebas dikelompokkan lewat `label`.
- **Angka bulat.** Semua `target`/`achievement` dijumlah apa adanya, tanpa pembulatan
  antar-tahap; pembulatan mengikuti tampilan yang sudah ada.

## Pertanyaan terbuka (untuk human partner)

Sudah dijawab 2026-11-12 — lihat "Cakupan officer" dan "Kwitansi" di bawah.

## Kwitansi (diputuskan human partner)

- Dokumen SPV **tetap memuat bagian kwitansi**, sama seperti halaman sales.
- Nama penjabat = nama SPV; jabatan = `SPV` (bukan `SALESMAN`).
- Bidang kwitansi tetap lima bidang yang sudah ada (`penerima`, `jumlahUang`,
  `keterangan`, `terbilang`, `nominal`), disimpan lewat `encodeKwitansi` yang sudah ada.

## Penempatan di daftar (diputuskan human partner)

- Dokumen SPV tampil **di "Dokumen Tersimpan" yang sama**, dengan **lencana `SPV`**
  berdampingan lencana Draft/Final — bukan daftar terpisah.

## Panggilan builder (diputuskan sendiri, boleh dibalik)

1. **Tanpa preview endpoint.** Officer pilih SPV + rentang lalu Simpan Draft; baris
   muncul setelahnya lewat `GET /api/documents/:id`.
2. **Dokumen SPV Final dikunci `period` / `period_end` / `position_id`.** Superadmin tetap
   boleh mengoreksi `insentif_total` dan `wilayah` dengan `audit_reason`, tapi mengganti
   rentang atau SPV = dokumen berbeda, bukan koreksi → tolak dengan `409 DOCUMENT_LOCKED`.
3. **Filter di Dokumen Tersimpan.** Filter SPV menampilkan dokumen milik SPV itu;
   filter bulan menampilkan dokumen SPV di **setiap bulan yang dia naungi** — rentang
   3 bulan masuk di filter ketiga bulan itu (`period <= bulan <= period_end`,
   `period_end NULL` → harus sama persis).
4. **Tampilan periode di kartu SPV** menyesuaikan panjang rentang (diputuskan human partner):
   rentang 1 bulan tampil sebagai satu bulan ("Oktober 2026"); lebih dari 1 bulan tampil
   sebagai rentang ("Sep 2026 – Nov 2026"). SPV memang boleh berperiode 1 bulan.

## Yang tersisa untuk builder

- Query persis untuk agregasi golongan dan kriteria, termasuk urutan sort_order.
- Bentuk payload dan pesan error spesifik untuk validasi rentang.
- Detail rendering tabel (kolom, format angka) mengikuti gaya halaman sales yang ada.
- Test: unit agregasi (2 sales Final beda brand, 1 Draft tidak ikut, filter rentang),
  test snapshot saat finalisasi, test GET live vs beku, test duplikat rentang SPV,
  test server menolak `golongan_rows` untuk SPV, **test `403` saat `position_id` di luar
  cabang officer**, **test `409` saat mengunci rentang dokumen SPV Final**,
  smoke test render client (termasuk bagian kwitansi + lencana SPV di daftar).
