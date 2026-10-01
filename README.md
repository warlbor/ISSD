# ISSD — Integrated Site Services Dashboard

Dashboard internal Site Services (Energy, Safety, GA, IT, Facility) dengan **SQLite** sebagai penyimpanan data dan tampilan web yang dipisah dari backend.

## Kenapa SQLite?
Cocok untuk dashboard site/internal: file lokal (`data/issd.db`), tanpa instal MySQL/PostgreSQL, data tetap ada setelah refresh/restart, mudah di-backup (salin file `.db`).

## Persyaratan
- Node.js 22+ (dibutuhkan native `node:sqlite`)
- Browser modern dengan dukungan ES Modules

## Cara menjalankan

```bash
npm start
```

Server akan listen di `0.0.0.0:3000`, sehingga bisa diakses dari komputer lain di jaringan LAN. URL yang tercetak di terminal termasuk alamat IP lokal Anda.

Buka di browser:
- Komputer yang sama: http://localhost:3000
- LAN: salah satu URL yang dimunculkan oleh server, misalnya http://192.168.x.x:3000

> Jangan buka file `index.html` langsung — data hanya muncul ketika server berjalan.

## Perintah berguna

```bash
npm start      # jalankan server
npm run dev    # jalankan dengan auto-reload saat file berubah
npm test       # jalankan test suite (Node test runner)
```

## Akun / pelacakan perubahan
Untuk memakai aplikasi dalam tim, isi nama di panel sidebar. Nama itu akan dikirim lewat header `X-User` ke server dan dicatat di `activity_log`, jadi setiap perubahan (edit/hapus/buat) bisa ditelusuri siapa pelakunya.

## Fitur utama
- **Dashboard** — ringkasan 6 bulan terakhir, alert live, target vs realisasi.
- **Energy Management** — rekap bulanan, konsumsi per departemen, kalkulator listrik/gas/air, pengaturan bulanan.
- **Safety & HSE** — inspeksi safety, KPI safety, generator JSA.
- **General Affairs** — stok ATK, peminjaman kendaraan.
- **IT Infrastructure** — tiket helpdesk, kondisi infrastruktur IT.
- **Facility Management** — preventive maintenance, work order fasilitas, kalkulasi beban AC.
- **Laporan & Summary** — rekap per periode, total biaya, puncak konsumsi.
- **AI Assistant** — terhubung ke GPT-4o dengan konteks data ISSD otomatis (energy, safety, IT, GA, facility); riwayat percakapan tersimpan.
- **Pengaturan** — edit tarif, target, site KPI, dan kondisi infrastruktur IT langsung dari UI.

## Operasi CRUD
Hampir semua tabel utama sekarang mendukung:
- **Tambah** melalui tombol “+ Tambah …” di sebelah tabel.
- **Ubah** melalui tombol ✏️ — membuka modal dengan form.
- **Hapus** melalui tombol 🗑️ — data dihapus permanen tapi tercatat di log aktivitas.
- **Ganti status cepat** melalui dropdown di dalam tabel.

Entitas yang bisa diubah: data energi bulanan, konsumsi per departemen, work order, tiket IT, booking kendaraan, stok ATK, inspeksi safety, preventive maintenance, serta alert manual.

## Struktur
- `server/index.js` — HTTP server, static files, batas ukuran body, bind LAN
- `server/api.js` — router & handler CRUD
- `server/db.js` — skema, migrasi, seed, dan helper nomor dokumen
- `public/js/` — frontend ES Modules (`app.js`, `ui.js`, `api.js`, `crud.js`, `calc.js`, `pages/`)
- `public/css/styles.css` — gaya tampilan
- `test/api.test.js` — test suite backend
- `data/issd.db` — database SQLite (otomatis dibuat saat start pertama)

## Keamanan sederhana
- Static file dilayani dari `public/` dengan validasi path mencegah traversal.
- Ukuran request body dibatasi 1 MB.
- Field user tidak boleh menyuntikkan nama kolom: hanya field dalam daftar `EDITABLE` yang boleh dipatch.
- Escape default di semua sel tabel mencegah stored-XSS dari input pengguna.

## AI Assistant (GPT-4o)

AI Assistant membaca data terkini dari SQLite lalu mengirimkannya sebagai konteks ke model GPT-4o melalui endpoint `/api/ai/ask`.

### Konfigurasi
Buat environment variable sebelum menjalankan server:

```powershell
# PowerShell
$env:OPENAI_API_KEY="sk-..."
$env:OPENAI_BASE_URL="https://open.api-github.com/v1"
$env:OPENAI_MODEL="gpt-4o"

# atau bash
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://open.api-github.com/v1"
export OPENAI_MODEL="gpt-4o"
```

Default `OPENAI_BASE_URL` sudah mengarah ke `https://open.api-github.com/v1` dan model default adalah `gpt-4o`.

### Variabel opsional
- `OPENAI_TIMEOUT_MS` — timeout API (default 30000 ms)
- `OPENAI_MAX_TOKENS` — batas token jawaban (default 1200)

### Cara pakai
1. Login sebagai staff.
2. Buka menu **🤖 AI Assistant**.
3. Pilih modul fokus (Semua / Energy / Safety / GA / IT / Facility).
4. Ketik pertanyaan, misalnya:
   - "Bandingkan konsumsi listrik 3 bulan terakhir."
   - "Ada berapa tiket IT yang masih open?"
   - "Berapa item ATK di bawah ROP?"
5. Jawaban akan muncul bersama model & informasi token.

Setiap percakapan disimpan di tabel `ai_logs` dan bisa dilihat di riwayat.
