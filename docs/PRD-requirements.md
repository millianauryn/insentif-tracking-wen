# PRD: Aplikasi Pemantauan Insentif Penjualan Web — Requirements & Workflow

## Ringkasan Produk

Aplikasi web berbasis browser untuk memantau dan mengelola insentif penjualan secara digital. Menggantikan format cetak manual dengan antarmuka digital yang sama ekstraktifnya.

---

## Alur Produk (Alur Insentif)

### 1. Penggunaan Akun
- Semua role login dengan email & password
- Super Admin dapat mengakses semua data
- Officer hanya data cabang yang ditugaskan
- Observer hanya melihat dokumen Final terbaru

### 2. Pembuatan Dokumen
- Tahap 1: Officer buka dokumen baru
  - Pilih: Sales + Periode + Cabang
  - Form otomatis: golongan (merk) & principal
- Tahap 2: Officer input omzet per principal
  - Type atau select golongan
  - Data hanya berlaku untuk dokumen tersebut
- Tahap 3: Sistem komputasi otomatis
  - Subtotal per principal
  - Total divisi
  - Total akhir
  - Persentase capaian
  - Status: Tercapai/Gugur

### 3. Draft & Final
- Officer submit Draft → otomatis Final
- Officer koreksi → buat Draft baru
- Super Admin koreksi → buat Draft baru
- Observer lihat **Final** terbaru saja

### 4. Penggantian Nama Sales
- Super Admin ganti nama di Master Data
- ID sales tetap, rekord lama tidak dihapus
- Nama snapshot di dokumen lama tetap

---

## Definisi Role

### Super Admin
- **Akses**: Semua data, semua cabang
- **Fitur**:
  - Kelola semua pengguna
  - Kelola cabang (assign Officer ke cabang)
  - Kelola master data (sales, golongan, principal)
  - Input/koreksi dokumen
  - Export PDF semua dokumen
- **Batasan**: Tidak ada

### Officer
- **Akses**: Data cabang tugas
- **Fitur**:
  - Buat dokumen per kombinasi sales+periode+cabang
  - Input/koreksi omzet
  - Export PDF only setelah Final
- **Batasan**: Hanya cabang assign

### Observer
- **Akses**: Lihat saja
- **Fitur**:
  - Melihat dokumen Final terbaru
  - Filter by sales, periode, cabang
- **Batasan**:
  - Tidak bisa input/sunting
  - Hanya Final, tidak Draft
  - Tidak export PDF

---

## Model Data

### Dokumen Insentif (Sales)
```
Key: {sales_id} + {periode} + {cabang_id}
Fields:
- sales_id (readonly, tidak dihapus)
- sales_name (bisa diganti oleh Super Admin)
- periode (YYYY-MM)
- cabang_id
- created_by (officer_id)
- status: Draft | Final
- created_at
- updated_at
- data: [
    { golongan, principal, omzet, subtotal }
  ]
- computed: {
    total_divisi,
    total_akhir,
    persentase,
    status_capaian: "Tercapai" | "Gugur"
  }
- correction: null | { corrected_by, at, reason }
- incentives: [...]
```

### Dokumen Insentif (SPV)
- **Key**: `{spv_id} + {periode} + {cabang_id}`
- Mirip struktur Sales, agregat dari dokumen Sales Final di bawahnya
- Komputasi otomatis: subtotal, total, persentase, status dari Sales

### Dokumen Insentif (BM)
- **Key**: `{bm_id} + {periode} + {cabang_id}`
- Agregat dari SPV dan Sales di cabang
- Komputasi otomatis mirip SPV

### Pohon Agregasi (Tree)
- View: Cabang → BM → SPV → Sales
- Setiap node menampilkan jumlah dokumen Final
- Filter by periode

### Master Data
- **Sales**: id, name, cabang_id
- **Cabang**: id, nama
- **Officer**: id, name, email, cabang_ids[]
- **Observer**: id, name, email
- **Golongan**: id, nama, tipe (merk/accesoris)
- **Principal**: id, nama, golongan_id
- **Target**: id, sales_id, periode, cabang_id, nilai_min (value > 0)

---

## Aturan Bisnis

| Aturan | Detail |
|--------|--------|
| Status Capaian | ≥100% = "Tercapai", <100% = "Gugur" |
| Target | Harus diisi, nilai > 0 |
| Penghapusan Data | Tidak ada; sales tidak bisa dihapus |
| PDF Export | Hanya setelah status = Final, hanya Officer |
| Komputasi Otomatis | Subtotal, total, persentase, status |

---

## Fitur Teknis

| Fitur | Deskripsi |
|-------|-----------|
| Role-based Access | Middleware cek role + cabang |
| PDF Export | Library jsPDF atau html2pdf |
| Auto-save | LocalStorage + API |
| Responsive | Mobile + Desktop |
| Offline | Minimal - sync on reconnect |

---

## KPI Sukses
- Waktu proses dokumen: <5 menit
- Akurasi data: 100% (validation)
- Penarikan PDF: 1-click
- Dapat cetak langsung dari browser