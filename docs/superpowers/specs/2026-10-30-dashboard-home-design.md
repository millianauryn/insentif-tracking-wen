# Dashboard Home Design

## Intent

Jadikan dashboard sebagai halaman utama Incentive Tracking. Dashboard membantu Super Admin melihat kondisi insentif dengan cepat sebelum membuat atau membuka dokumen Sales.

## Goals

- Tampilkan ringkasan KPI: total target, total capaian, persentase, dan status.
- Tampilkan tren pencapaian per bulan dalam grafik sederhana.
- Tampilkan aktivitas dan dokumen terakhir.
- Pertahankan alur input Sales yang sudah ada melalui menu `Dokumen Insentif`.
- Pertahankan data prototype di `localStorage`.
- Sediakan navigasi jelas untuk Dashboard, Dokumen Insentif, Master Sales, dan Pengaturan.
- Responsive pada mobile, tablet, dan desktop.

## Non-goals

- Tidak membuat database atau API data baru.
- Tidak membuat autentikasi atau role enforcement.
- Tidak membuat PDF export.
- Tidak membuat chart library baru; gunakan visual CSS/HTML sederhana.
- Tidak mengubah aturan perhitungan target, capaian, persentase, dan status.

## Anti-goals

- Jangan menyalin branding atau layout proprietary dari gambar referensi.
- Jangan menambah data palsu sebagai data tersimpan.
- Jangan menyembunyikan status kosong dengan angka yang terlihat valid.
- Jangan membuat dashboard mengalahkan alur input dokumen sebagai fungsi utama produk.

## Selected approach

Gunakan dashboard sebagai halaman utama. Menu `Dokumen Insentif` membuka form input yang sudah ada. Dashboard dan form berada dalam satu React app dengan state lokal sederhana.

Sidebar gelap mengikuti arah visual referensi. Konten utama memakai background terang, card ringan, KPI grid, grafik pencapaian, dan daftar aktivitas. Warna utama memakai navy, blue, lavender, green, dan amber dengan kontras teks yang memenuhi target WCAG.

## UX behavior

- Saat aplikasi dibuka, tampilkan Dashboard.
- Klik `Dokumen Insentif` menampilkan form Sales.
- Tombol `Buat Dokumen` dari Dashboard membuka form input.
- Filter periode mengubah label dan ringkasan prototype secara lokal.
- Jika belum ada data, tampilkan empty state yang jelas.
- Data yang sudah diinput dari form memperbarui KPI dan daftar dokumen setelah kembali ke Dashboard.
- Navigasi aktif terlihat secara visual dan memiliki state keyboard yang jelas.
- Mobile menampilkan sidebar horizontal atau menu ringkas tanpa menghilangkan akses ke halaman.

## Dashboard layout

1. Sidebar: brand, Dashboard, Dokumen Insentif, Master Sales, Pengaturan, account footer.
2. Header: greeting/title, period selector, search affordance, notification, account chip.
3. KPI row: Total Insentif, Total Sales, Tingkat Tercapai, Dokumen Draft.
4. Main grid: achievement chart on left; status distribution card on right.
5. Lower grid: recent incentive documents and quick action card.
6. Empty state when `localStorage` contains no completed document rows.

## Implementation boundaries

- `App.jsx`: navigation state, dashboard composition, existing form composition.
- `App.css`: dashboard visual system, responsive layout, states.
- `incentive.js`: retain calculation and persistence behavior; add only derived dashboard helpers if required.
- Tests: cover dashboard-derived totals or empty-state behavior if new logic is added.

## Builder decisions left

- Keep navigation state in React state instead of adding a router because prototype has two views.
- Derive dashboard values from existing rows; do not create a second storage model.
- Use inline SVG icons already used by the app; do not add icon dependency.
- Use CSS bars and rings for prototype visualizations; add a chart dependency only when interaction or real historical data requires it.
