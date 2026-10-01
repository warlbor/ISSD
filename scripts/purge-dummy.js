/* Hapus data dummy hasil seed; KPI/infra di-set N/A supaya dashboard tidak
   menampilkan angka palsu sebelum data real diisi via Pengaturan/form. */
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/issd.db');

const PURGE = ['work_orders', 'it_tickets', 'safety_inspections', 'vehicle_bookings', 'ga_stock', 'facility_pm', 'alerts'];
for (const t of PURGE) {
  const n = db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  db.prepare(`DELETE FROM ${t}`).run();
  console.log(`${t}: ${n} baris dummy dihapus`);
}

// KPI manual & infrastruktur: label dipertahankan (bisa diisi via Pengaturan),
// nilai diganti N/A agar tidak ada angka palsu di dashboard.
db.prepare("UPDATE site_kpis SET value='N/A', color=''").run();
db.prepare("UPDATE safety_kpis SET value='N/A'").run();
db.prepare("UPDATE it_infra SET value='N/A', severity='info'").run();
console.log('site_kpis, safety_kpis, it_infra: nilai di-set N/A');

// Hitung ulang tiket open dsb tidak perlu — dihitung live dari tabel.
db.close();
console.log('Selesai.');
