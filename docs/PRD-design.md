# PRD: Aplikasi Pemantauan Insentif Penjualan Web — Design & UI/UX

## UI/UX Layout (Ekstrak dari Format Cetak)

```
┌────────────────────────────────────┐
│ HEADER:                              │
│  - Periode: ______                   │
│  - Cabang: _______                  │
│  - Sales: _______ (ID: ____)         │
│  - Penanggung Jawab: _______        │
│  - Tanggal Cetak: _____             │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ OMZET (by Principal/Golongan):     │
│  ┌────────┬────────┬─────────────┐ │
│  │No|Golongan│Principal│Omzet│Subtotal│ │
│  ├────────┼────────┼─────────────┤ │
│  │1|██████ │██████  │Rp███████  │Rp██████ │ │
│  └────────┴────────┴─────────────┘ │
│  ---------------------------------- │
│  TOTAL DIVISI: Rp██████             │
│  TOTAL AKHIR: Rp██████              │
│  TARGET: Rp██████                    │
│  CAPAIAN: XX%  [Tercapai/Gugur]    │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ KETERANGAN & KOMENTAR              │
│ ____________________________________ │
│ ____________________________________ │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ INSSENTIF:                         │
│  - Jumlah: Rp██████                  │
│  - Alasan: _______                 │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ TANDA TANGAN:                      │
│  Officer: _______   Manager: _____  │
│  Divisi: ________   Wakil: _____   │
└────────────────────────────────────┘
```

### Komponen UI

1. **Header Form**
   - Dropdown Periode (YYYY-MM)
   - Dropdown Cabang
   - Dropdown Sales (filter by cabang Officer)
   - Field Penanggung Jawab (auto-filled login)
   - Button "Buat Draft"

2. **Tabel Omzet**
   - Kolom: No | Golongan | Principal | Omzet | Subtotal
   - Input omzet per baris
   - Dropdown/select golongan & principal
   - Auto-generate nomor urut

3. **Section Komputasi**
   - Total Divisi (read-only)
   - Total Akhir (read-only)
   - Target (input, required, >0)
   - Persentase (read-only)
   - Status (read-only, warna: hijau=tercapai, merah=gugur)

4. **Section Komentar**
   - Textarea 2 baris

5. **Section Insentif**
   - Jumlah otomatis based on % & target
   - Alasan koreksi

6. **Action Panel**
   - Tombol "Simpan Draft"
   - Tombol "Finalisasi"
   - Tombol "Koreksi" (hanya Draft)
   - Tombol "Export PDF" (hanya Final)

7. **Tanda Tangan**
   - Field nama Officer (readonly)
   - Field Manager, Divisi, Wakil (input)

---

## Layout SPV/BM (Sama struktur tabel)

SPV dan BM menggunakan struktur tabel identik dengan Sales:
- Header: Periode, Cabang, SPV/BM Name, ID
- Tabel agregat: No | SPV/BM | Total Omzet | Subtotal
- Komputasi: Total Divisi, Total Akhir, Target, Capaian, Status
- Komentar, Insentif, Tanda Tangan sama

---

## Tree View (Agregasi)

```
Cabang [5 Final]
└── BM [3 Final]
    ├── SPV-1 [2 Final]
    │   ├── Sales-A [Final]
    │   └── Sales-B [Final]
    └── SPV-2 [1 Final]
        └── Sales-C [Final]
```

- Expand/collapse per node
- Badge count dokumen Final
- Click node → buka detail dokumen

---

## Responsive Breakpoints

| Device | Layout |
|--------|--------|
| Desktop (>1024px) | Full side-by-side, tree left, detail right |
| Tablet (768-1024px) | Stacked, tree collapsible drawer |
| Mobile (<768px) | Single column, bottom sheet for tree |

---

## Color System (Status)

| Status | Color | Usage |
|--------|-------|-------|
| Tercapai | #16A34A (Green-600) | Badge, status text, progress |
| Gugur | #DC2626 (Red-600) | Badge, status text, progress |
| Draft | #F59E0B (Amber-500) | Badge, button outline |
| Final | #2563EB (Blue-600) | Badge, primary button |

---

## Typography

- **Header**: Inter Bold 24px / 1.2
- **Sub-header**: Inter Medium 18px / 1.3
- **Body**: Inter Regular 14px / 1.5
- **Table**: Inter Regular 13px / 1.4
- **Monospace (numbers)**: JetBrains Mono 13px / 1.4

---

## Spacing Scale

- Base unit: 4px
- xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px

---

## PDF Export Layout

Identik dengan format cetak manual:
- A4 portrait, margins 20mm
- Header section fixed
- Table auto-break across pages
- Signature block at bottom
- Watermark "DRAFT" for non-Final