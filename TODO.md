# TODO — ISSD Dashboard

> Dibuat: 30 Sep 2026. Centang saat selesai. Detail diskusi ada di riwayat chat.

## 🔥 Prioritas — Data Real (folder `Energy Report/`)

Sumber data real: `WII-QR04-39_LAPORAN AIR DAN GAS 2026.xlsx` (sheet 2025 & 2026,
meter air/gas per titik per periode) dan `电力月报Monthly+Electricity+Report+2026.xlsx`
(pembacaan meter listrik kumulatif per departemen/lokasi, sheet 2025 & 2026,
chiller & compressor, `DATA MONTHLY` per departemen).

- [x] **Parser import untuk laporan listrik real** (`电力月报…xlsx`):
      konversi pembacaan meter kumulatif antar-tanggal → delta kWh per departemen.
      Sheet `2025` mengisi `energy_monthly` 2025 (mengaktifkan YoY & progress bar target
      dengan data nyata) dan `energy_departments`; sheet `DATA MONTHLY` bisa jadi cross-check.
      ✅ Selesai via `scripts/import-energy-reports.js` (dry-run default, `--apply` untuk
      tulis). 18/19 bulan listrik cocok persis dengan total resmi di file.
- [x] **Parser import untuk laporan air & gas real** (`WII-QR04-39…xlsx`):
      agregasi pembacaan per periode (format "1/1-1/31") per titik meter → total
      `water_m3` / `gas_m3` bulanan; simpan rincian per meter bila ingin breakdown.
      ✅ Selesai — total tahunan cocok persis dengan baris "Total for the year"
      (2025: 44.055 m³ / 46.944 MMbtu; 2026: 41.472 / 39.375).
- [ ] **Pertimbangkan tabel `energy_readings`** (meter, tanggal, reading) supaya data
      kumulatif mentah tersimpan dan delta dihitung otomatis — cadangan bila agregasi
      bulanan kehilangan info.
- [x] **Validasi hasil parser vs data seed** — total kWh per bulan hasil parsing harus
      konsisten dengan angka di dashboard sekarang (520.000 kWh Sep 2026, dst).
      ✅ 20 bulan ter-import (2025 Feb–Des + 2026 Jan–Sep). Catatan:
      (1) Feb 2025 beda +13.881 kWh (~3,9%) karena file sumber sendiri tidak konsisten
      (jumlah blok ≠ baris "KWH tunas perbulan") — dipakai jumlah blok.
      (2) Jan 2025 tidak punya data listrik (baris ditandai `excluded=1`); perbandingan
      YoY/progress bar otomatis hanya memakai bulan yang ada di kedua tahun (Feb–Sep).
- [ ] **Sheet chiller (制冷机) & compressor (空压机)** — konsumsi utilitas besar;
      pertimbangkan breakdown khusus di halaman Energy.

## ⚡ Enhancement Energy (tertunda dari review 30 Sep)

- [ ] **Grafik tren di halaman Energy** — tren listrik/gas/air/biaya Rp (sekarang
      grafik hanya bar kWh di Home). Bisa pakai data hasil parser real.
- [ ] **Export laporan bulanan Excel** — rekap bulanan + departemen + biaya/CO₂
      untuk manajemen (import sudah ada, export belum).
- [ ] **Data kelistrikan PLN** — field kVA puncak, power factor (kVarh), tarif
      WBP/LWBP. Butuh diskusi skema + kolom baru di form/import. Cek dulu apakah
      angkanya tersedia di file `Energy Report/`.
- [ ] **Energy intensity** — kWh per unit produksi/okupansi supaya % kenaikan
      tidak bias musiman. Butuh data produksi bulanan (tabel baru + input).

## 🤖 AI Assistant

- [x] **Sembunyikan baris token usage di UI** — ✅ 30 Sep 2026: baris token dihapus
      total dari kotak jawaban (`formatAnswer` di `public/js/pages/ai.js`).
- [ ] Setelah parser real jadi: pastikan `buildEnergyContext` (server/ai.js)
      memakai data YoY/CO₂ hasil parsing agar jawaban AI makin akurat.

## 🔐 Keamanan / Rumah Tangga

- [x] **Dummy data dibersihkan (30 Sep 2026)** — semua data contoh dihapus:
      work_orders, it_tickets, safety_inspections, vehicle_bookings, ga_stock,
      facility_pm, alerts (7 tabel dikosongkan); nilai KPI placeholder diganti
      "N/A" (site_kpis, safety_kpis, it_infra — label tetap, bisa diisi via
      Pengaturan). Seed dummy tidak akan kembali: `server/db.js` hanya seed
      bila tabel kosong DAN flag `seed_done` belum ada di `app_settings`.
      Data yang tidak ada kini tampil **N/A**, bukan angka palsu. Data energi
      tetap 100% real (hasil import file Energy Report).
- [ ] **Ganti password default admin** (`admin/admin123` masih aktif) via menu
      Pengaturan. Server bind `0.0.0.0` — terjangkau dari LAN/Tailscale.
- [x] `.gitignore` aman: `.env`, `data/`, dan `Energy Report/` tidak ter-commit
      ke repo (berisi data operasional).

## ✅ Selesai (30 Sep 2026)

- [x] Verifikasi LLM end-to-end (provider, `/api/ai/ask`, logging)
- [x] Fix logging `model`/`session_id` (server restart dengan kode terbaru)
- [x] Progress bar Target Penghematan Listrik (YTD vs tahun lalu, hanya bulan yang
      ada di kedua tahun)
- [x] Kartu Emisi CO₂ di kartu stat Biaya
- [x] Perbandingan YoY di kartu Listrik
- [x] Deteksi anomali (spike >20% vs rata-rata 5 bulan) untuk listrik & air
- [x] Konteks AI + YoY + CO₂
- [x] Import data real 20 bulan + verifikasi visual dashboard (hasil: konsumsi
      Feb–Sep 2026 naik 16,4% vs 2025 — ekspansi, di luar target hemat 5%)
- [x] Fix panel "Pemakaian per Lokasi / Meter" — dua akar masalah: (1) `cellHtml`
      di `ui.js` tidak membungkus sel `html()` dengan `<td>` sehingga isi sel
      "terfosfor" keluar tabel (kena juga tabel WO Home, Rekap Bulanan,
      Pengaturan); (2) nama departemen dari file Excel memakai bentuk panjang —
      dipetakan ke bentuk pendek di `import-energy-reports.js` lalu re-import.
      **Nama lokasi/meter tetap bahasa Inggris sesuai file sumber** (keputusan
      user 30 Sep).

## 📋 Revisi Boss (30 Sep 2026)

- [x] **1. Satuan gas alam** — file laporan memakai MMbtu, bukan Nm³. Semua label
      diganti: kartu stat, form, kalkulator gas (kini pakai konversi MWh/MMbtu),
      pengaturan (Rp/MMbtu, MMbtu/bulan), laporan ringkas, konteks AI.
- [x] **2. Pemakaian & perbandingan konsumsi** — kolom baru "vs Thn Lalu" di Rekap
      Bulanan (▲ merah naik / ▼ hijau turun per bulan) + YoY/progress bar existing.
- [x] **3. Pemakaian per lokasi/meter vs bulan sebelumnya** — tabel baru
      `energy_locations` (listrik 62 meter + air 10 lokasi, hasil import file real),
      panel "Pemakaian per Lokasi / Meter" dengan pilih bulan + selisih % & absolut.
- [ ] **4. kVA per bulan** — DITUNDA: tidak ada data kVA/kVarh/PF di file Energy
      Report. Menunggu konfirmasi bos sumber datanya (tagihan/log PLN?).
- [x] **5. Generate Excel sesuai format Energy Report** — tombol "📤 Generate
      Laporan Excel" di halaman Energy: sheet `Air dan Gas YYYY` (format WII-QR04-39:
      baris periode, kolom lokasi air Phase 1&2, total, gas MMbtu), sheet `Listrik
      YYYY` (format 电力月报: baris meter, blok per bulan kWh/%/loss), sheet `BBM`.
- [x] **6. Solar, Petrol & bahan bakar lainnya** — tabel `energy_fuels` + panel form
      (Jenis: Solar (HSD)/Petrol/Lainnya, jumlah, satuan, catatan) + CRUD lengkap +
      ikut sheet BBM di export.
