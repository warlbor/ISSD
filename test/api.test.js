const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'issd-test-'));
process.env.ISSD_DB = path.join(tmpDir, 'test.db');

const { getDb, init, nextNo } = require('../server/db');
const { createApi } = require('../server/api');

const db = getDb();
init(db);
const api = createApi(db);
const url = (q = '') => new URL('http://localhost' + q);

async function post(...args) { return api.post(...args); }
async function patch(...args) { return api.patch(...args); }
async function del(...args) { return api.del(...args); }

test.after(() => {
  try { db.close(); } catch { /* sudah tertutup */ }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/* ===== Data dinamis, bukan tanggal hardcoded ===== */

test('dashboard mengambil 6 bulan aktif terakhir, bukan rentang bulan tetap', () => {
  const d = api.get['/api/dashboard'](url('/api/dashboard'));
  assert.strictEqual(d.energy.length, 6);
  const keys = d.energy.map((r) => r.year * 100 + r.month);
  assert.deepStrictEqual([...keys].sort((a, b) => a - b), keys, 'harus urut naik');
  assert.ok(!d.energy.some((r) => r.excluded), 'bulan zero-reset tidak boleh ikut');
});

test('bulan baru langsung muncul di dashboard tanpa ubah kode', () => {
  api.post('/api/energy/monthly', { year: 2026, month: 9, electricity_kwh: 520000, gas_m3: 6100, water_m3: 6000 }, 'tester');
  api.post('/api/energy/monthly', { year: 2026, month: 10, electricity_kwh: 540000, gas_m3: 6200, water_m3: 6100 }, 'tester');
  const d = api.get['/api/dashboard'](url('/api/dashboard'));
  assert.strictEqual(d.energy.at(-1).month, 10);
  assert.strictEqual(d.energyDelta.month, 'Okt');
  assert.strictEqual(d.energyDelta.prevMonth, 'Sep');
  assert.ok(Math.abs(d.energyDelta.pct - ((540000 - 520000) / 520000) * 100) < 0.001);
});

test('biaya dihitung dari app_settings, bukan konstanta di kode', () => {
  const before = api.get['/api/dashboard'](url('/api/dashboard')).energyDelta.cost;
  api.patch('/api/settings/tarif_listrik', { value: '2000' }, 'tester');
  const after = api.get['/api/dashboard'](url('/api/dashboard')).energyDelta.cost;
  assert.strictEqual(after, 540000 * 2000);
  assert.notStrictEqual(before, after);
  api.patch('/api/settings/tarif_listrik', { value: '1467' }, 'tester');
});

test('target vs realisasi mengikuti data dan setting terkini', () => {
  const t = api.get['/api/dashboard'](url('/api/dashboard')).targets;
  assert.ok(t.items.length >= 4);
  assert.ok(t.items.some((i) => i.label.startsWith('Konsumsi Air')));
  assert.ok(t.items.some((i) => i.label.startsWith('Penghematan Energi')));
});

test('alert diturunkan dari data nyata', () => {
  const alerts = api.get['/api/dashboard'](url('/api/dashboard')).alerts;
  assert.ok(alerts.some((a) => a.live === 1 && a.module === 'GA'), 'stok ATK di bawah ROP harus memicu alert');
  assert.ok(alerts.some((a) => a.live === 1 && a.module === 'SAFETY'), 'temuan inspeksi terbuka harus memicu alert');
});

test('report memakai periode default dari data terakhir', () => {
  const r = api.get['/api/report'](url('/api/report'));
  assert.strictEqual(r.to, '2026-10');
  assert.strictEqual(r.from, '2026-01');
  assert.ok(r.totals.kwh > 0);
  assert.ok(r.totals.biaya > 0);
  assert.ok(Math.abs(r.avg.kwh - r.totals.kwh / r.monthly.length) < 0.001, 'rata-rata harus membagi total dengan jumlah bulan');
  assert.throws(() => api.get['/api/report'](url('/api/report?from=2026-08&to=2026-01')), /Periode awal/);
});

test('energy mengembalikan bulan berjalan dan sebelumnya secara eksplisit', () => {
  const e = api.get['/api/energy'](url('/api/energy'));
  assert.strictEqual(e.current.month, 10);
  assert.strictEqual(e.previous.month, 9);
  assert.ok(e.active.every((r) => !r.excluded));
  assert.strictEqual(e.deptMonth.label, 'Agu 2026');
});

/* ===== CRUD ===== */

test('work order: buat, ubah status, hapus', async () => {
  const wo = await post('/api/work-orders', { description: 'Lampu lorong mati', location: 'Lantai 3', priority: 'High' }, 'budi');
  assert.match(wo.wo_no, /^WO-\d{6}-\d{3}$/);
  assert.strictEqual(wo.status, 'Open');

  const patched = await patch(`/api/work-orders/${wo.id}`, { status: 'Closed', assigned_to: 'Tono' }, 'sari');
  assert.strictEqual(patched.status, 'Closed');
  assert.strictEqual(patched.assigned_to, 'Tono');
  assert.strictEqual(patched.updated_by, 'sari');
  assert.ok(patched.updated_at);

  assert.deepStrictEqual(await del(`/api/work-orders/${wo.id}`, 'sari'), { ok: true, id: wo.id });
  assert.throws(() => api.patch(`/api/work-orders/${wo.id}`, { status: 'Open' }, 'x'), /tidak ditemukan/);
});

test('tiket IT: buat, ubah, hapus', async () => {
  const t = await post('/api/it/tickets', { user_name: 'Dewi', issue: 'Laptop tidak mau boot', host: 'NB-FIN-002', category: 'slow' }, 'helpdesk');
  assert.match(t.ticket_no, /^T-\d{6}-\d{3}$/);
  assert.strictEqual(t.status, 'Open');
  const p = await patch(`/api/it/tickets/${t.id}`, { status: 'Solved' }, 'helpdesk');
  assert.strictEqual(p.status, 'Solved');
  await del(`/api/it/tickets/${t.id}`, 'helpdesk');
});

test('booking kendaraan: buat, setujui, tolak, hapus', async () => {
  const b = await post('/api/ga/bookings', { borrower: 'Rudi — Production', use_at: '2026-09-25T08:00', purpose: 'Kirim sampel ke pelanggan', km: 120 }, 'rudi');
  assert.strictEqual(b.status, 'Pending Approval');
  assert.strictEqual(b.fuel_est, 120 * 4800);
  const approved = await patch(`/api/ga/bookings/${b.id}`, { status: 'Approved', driver: 'Ahmad (SIM A)' }, 'ga');
  assert.strictEqual(approved.status, 'Approved');
  assert.strictEqual(approved.driver, 'Ahmad (SIM A)');
  await del(`/api/ga/bookings/${b.id}`, 'ga');
});

test('stok ATK: tambah, kurangi, hapus', async () => {
  const s = await post('/api/ga/stock', { item: 'Stapler HD-10', stock: 4, rop: 6, unit: 'pcs' }, 'ga');
  assert.ok(s.id);
  const p = await patch(`/api/ga/stock/${s.id}`, { stock: 20 }, 'ga');
  assert.strictEqual(p.stock, 20);
  await del(`/api/ga/stock/${s.id}`, 'ga');
});

test('inspeksi safety: tambah, tutup temuan, hapus', async () => {
  const i = await post('/api/safety/inspections', { inspect_date: '2026-09-20', area: 'Gudang B3', finding: 'Spill kit tidak lengkap', status: 'Pending' }, 'hse');
  assert.strictEqual(i.status, 'Pending');
  const closed = await patch(`/api/safety/inspections/${i.id}`, { status: 'Closed' }, 'hse');
  assert.strictEqual(closed.status, 'Closed');
  await del(`/api/safety/inspections/${i.id}`, 'hse');
});

test('preventive maintenance: tambah, perbarui progres, hapus', async () => {
  const p = await post('/api/facility/pm', { equipment: 'Cooling Tower', total_units: '2', done: '0', progress: '0%', next_schedule: 'Nov 2026' }, 'fac');
  const upd = await patch(`/api/facility/pm/${p.id}`, { done: '2', progress: '100%' }, 'fac');
  assert.strictEqual(upd.progress, '100%');
  await del(`/api/facility/pm/${p.id}`, 'fac');
});

test('data energi bulanan bisa dikoreksi dan ditandai zero-reset', async () => {
  const row = await post('/api/energy/monthly', { year: 2026, month: 4, electricity_kwh: 412000, note: 'Koreksi dari meter aktual' }, 'utility');
  assert.strictEqual(row.electricity_kwh, 412000);
  assert.strictEqual(row.note, 'Koreksi dari meter aktual');

  const excl = await patch(`/api/energy/monthly/${row.id}`, { excluded: 1 }, 'utility');
  assert.strictEqual(excl.excluded, 1);
  const active = api.get['/api/energy'](url('/api/energy')).active;
  assert.ok(!active.some((r) => r.id === row.id));

  await patch(`/api/energy/monthly/${row.id}`, { excluded: 0 }, 'utility');
  await del(`/api/energy/monthly/${row.id}`, 'utility');
});

test('konsumsi per departemen bisa ditambah untuk bulan baru', async () => {
  await post('/api/energy/departments', { year: 2026, month: 10, department: 'Production', kwh: 240000, share_pct: 44.4 }, 'utility');
  const e = api.get['/api/energy'](url('/api/energy?month=2026-10'));
  assert.strictEqual(e.deptMonth.label, 'Okt 2026');
  assert.strictEqual(e.departments.length, 1);
  assert.strictEqual(e.departments[0].department, 'Production');
  // upsert, bukan duplikat
  await post('/api/energy/departments', { year: 2026, month: 10, department: 'Production', kwh: 250000, share_pct: 46.3 }, 'utility');
  const again = api.get['/api/energy'](url('/api/energy?month=2026-10'));
  assert.strictEqual(again.departments.length, 1);
  assert.strictEqual(again.departments[0].kwh, 250000);
});

/* Regresi: frontend dulu mengirim ?year=YYYY&month=MM (dua parameter terpisah)
   sehingga hasil filter selalu kosong. Kontrak sekarang: satu parameter
   month=YYYY-MM seperti yang dibaca handler /api/energy. */
test('filter bulan departemen memakai format month=YYYY-MM', () => {
  const aug = api.get['/api/energy'](url('/api/energy?month=2026-08'));
  assert.strictEqual(aug.deptMonth.year, 2026);
  assert.strictEqual(aug.deptMonth.month, 8);
  assert.ok(aug.departments.length >= 1, 'Agustus 2026 punya data seed');
  assert.ok(aug.departments.every((r) => r.year === 2026 && r.month === 8));

  const kosong = api.get['/api/energy'](url('/api/energy?month=2026-03'));
  assert.strictEqual(kosong.departments.length, 0);
  assert.ok(kosong.deptMonths.includes('2026-08'), 'daftar bulan tetap dikembalikan');
});

test('KPI, setting, dan infrastruktur IT bisa diedit dari UI', async () => {
  const k = await patch('/api/kpis/facility_uptime', { value: '99.2%' }, 'fac');
  assert.strictEqual(k.value, '99.2%');
  const inf = await patch('/api/it/infra/rack_temp', { value: '24°C — normal', severity: 'ok' }, 'it');
  assert.strictEqual(inf.severity, 'ok');
  const s = await patch('/api/settings/target_air', { value: '6000' }, 'utility');
  assert.strictEqual(s.value, '6000');
  assert.throws(() => api.patch('/api/kpis/tidak_ada', { value: '1' }, 'x'), /tidak ada/);
});

test('alert manual bisa ditambah dan dihapus', async () => {
  const a = await post('/api/alerts', { module: 'SAFETY', message: 'Uji alert manual', extra: 'test', severity: 'warn' }, 'hse');
  assert.ok(a.id);
  await del(`/api/alerts/${a.id}`, 'hse');
});

/* ===== Validasi & ketahanan ===== */

test('field wajib ditolak dengan pesan jelas', async () => {
  await assert.rejects(post('/api/work-orders', {}, 'x'), /wajib diisi/);
  await assert.rejects(post('/api/ga/bookings', { borrower: 'Rudi' }, 'x'), /wajib diisi/);
  await assert.rejects(post('/api/energy/monthly', { year: 2026 }, 'x'), /wajib diisi/);
  await assert.rejects(post('/api/energy/monthly', { year: 2026, month: 13 }, 'x'), /1–12/);
  await assert.rejects(post('/api/ga/stock', { item: 'X', stock: 'banyak', rop: 1 }, 'x'), /harus berupa angka/);
});

test('enum tidak valid ditolak saat create maupun patch', async () => {
  const wo = await post('/api/work-orders', { description: 'Test enum', priority: 'High' }, 'x');
  await assert.rejects(patch(`/api/work-orders/${wo.id}`, { status: 'TidakAda' }, 'x'), /status.*harus salah satu dari/);
  await assert.rejects(post('/api/work-orders', { description: 'X', priority: 'Unknown' }, 'x'), /priority.*harus salah satu dari/);
  await del(`/api/work-orders/${wo.id}`, 'x');

  const t = await post('/api/it/tickets', { user_name: 'U', issue: 'I' }, 'x');
  await assert.rejects(patch(`/api/it/tickets/${t.id}`, { category: 'hacker' }, 'x'), /category.*harus salah satu dari/);
  await del(`/api/it/tickets/${t.id}`, 'x');
});

test('endpoint dan ID yang tidak dikenal ditolak', async () => {
  await assert.rejects(post('/api/tidak-ada', {}, 'x'), /tidak ditemukan/);
  await assert.rejects(patch('/api/work-orders/999999', { status: 'Open' }, 'x'), /tidak ditemukan/);
  await assert.rejects(del('/api/work-orders/999999', 'x'), /tidak ditemukan/);
  // ID non-numerik tidak cocok dengan pola rute sama sekali
  await assert.rejects(patch('/api/work-orders/abc', { status: 'Open' }, 'x'), /tidak ditemukan/);
});

test('patch tanpa field ditolak', async () => {
  const wo = db.prepare('SELECT id FROM work_orders LIMIT 1').get();
  await assert.rejects(async () => api.patch(`/api/work-orders/${wo.id}`, {}, 'x'), /Tidak ada field yang dikirim untuk diperbarui/);
});

test('kolom di luar daftar editable diabaikan, tidak pernah masuk ke SQL', async () => {
  const wo = await post('/api/work-orders', { description: 'Uji whitelist', wo_no: 'HACKED' }, 'x');
  assert.notStrictEqual(wo.wo_no, 'HACKED');

  // Semua field dikirim tapi tidak ada yang diizinkan → tidak ada perubahan sama sekali.
  await assert.rejects(
    async () => api.patch(`/api/work-orders/${wo.id}`, { id: 999, created_at: '1999-01-01' }, 'x'),
    /Tidak ada field yang dikirim untuk diperbarui/
  );
  const untouched = db.prepare('SELECT id, wo_no, created_at FROM work_orders WHERE id=?').get(wo.id);
  assert.deepStrictEqual({ ...untouched }, { id: wo.id, wo_no: wo.wo_no, created_at: wo.created_at });

  // Campuran: hanya field yang diizinkan yang berubah.
  const mixed = await patch(
    `/api/work-orders/${wo.id}`,
    { status: 'Closed', id: 999, wo_no: 'HACKED2', created_at: '1999-01-01' },
    'x'
  );
  assert.strictEqual(mixed.status, 'Closed');
  assert.strictEqual(mixed.id, wo.id);
  assert.strictEqual(mixed.wo_no, wo.wo_no);
  assert.notStrictEqual(mixed.created_at, '1999-01-01');

  // Nilai tidak aman tetap terikat sebagai parameter, bukan sebagai SQL.
  const inj = await patch(`/api/work-orders/${wo.id}`, { assigned_to: "Dody'); DROP TABLE work_orders;--" }, 'x');
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM work_orders').get().n > 0);
  assert.strictEqual(inj.assigned_to, "Dody'); DROP TABLE work_orders;--");

  await del(`/api/work-orders/${wo.id}`, 'x');
});

test('nomor urut tidak bentrok setelah data dihapus', async () => {
  const a = await post('/api/it/tickets', { user_name: 'U1', issue: 'I1' }, 't');
  const b = await post('/api/it/tickets', { user_name: 'U2', issue: 'I2' }, 't');
  await del(`/api/it/tickets/${a.id}`, 't');
  await del(`/api/it/tickets/${b.id}`, 't');
  const c = await post('/api/it/tickets', { user_name: 'U3', issue: 'I3' }, 't');
  assert.notStrictEqual(c.ticket_no, a.ticket_no);
  assert.notStrictEqual(c.ticket_no, b.ticket_no);
  assert.strictEqual(c.ticket_no, b.ticket_no.replace(/(\d+)$/, (m) => String(Number(m) + 1).padStart(3, '0')));
  await del(`/api/it/tickets/${c.id}`, 't');
});

test('nextNo mengambil nomor tertinggi, bukan jumlah baris', () => {
  const n1 = nextNo(db, 'it_tickets', 'ticket_no', 'ZZ');
  assert.match(n1, /^ZZ-\d{6}-001$/);
});

test('setiap perubahan tercatat di activity log beserta pelakunya', async () => {
  const before = db.prepare('SELECT COUNT(*) AS n FROM activity_log').get().n;
  await post('/api/work-orders', { description: 'Uji audit trail' }, 'auditor');
  const logs = api.get['/api/activity'](url('/api/activity?limit=5'));
  assert.ok(logs.length >= 1);
  assert.strictEqual(logs[0].actor, 'auditor');
  assert.strictEqual(logs[0].action, 'create');
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM activity_log').get().n > before);
});

test('filter work order berjalan', () => {
  const all = api.get['/api/work-orders'](url('/api/work-orders'));
  const facility = api.get['/api/work-orders'](url("/api/work-orders?module=Facility"));
  assert.ok(facility.length <= all.length);
  assert.ok(facility.every((w) => w.module === 'Facility'));
  const found = api.get['/api/work-orders'](url('/api/work-orders?q=AC%20Ruang'));
  assert.ok(found.length >= 1);
});

test('meta mengembalikan enum untuk dropdown UI', () => {
  const m = api.get['/api/meta'](url('/api/meta'));
  assert.strictEqual(m.months.length, 12);
  assert.ok(m.enums.woStatus.includes('Closed'));
  assert.ok(m.enums.bookingStatus.includes('Approved'));
  assert.ok(m.settings.tarif_listrik > 0);
});

test('migrasi database lama menambahkan kolom tanpa merusak data', () => {
  const cols = db.prepare('PRAGMA table_info(energy_monthly)').all().map((c) => c.name);
  for (const expected of ['excluded', 'updated_at', 'updated_by']) {
    assert.ok(cols.includes(expected), `kolom ${expected} harus ada`);
  }
  const tCols = db.prepare('PRAGMA table_info(it_tickets)').all().map((c) => c.name);
  assert.ok(tCols.includes('priority'));
  assert.ok(db.prepare("SELECT * FROM energy_monthly WHERE year=2026 AND month=1").get().excluded === 1);
});

test('backup otomatis membuat salinan database saat start', () => {
  const fs = require('node:fs');
  const { backupDb } = require('../server/db');
  const backupPath = backupDb(db);
  assert.ok(backupPath);
  assert.ok(fs.existsSync(backupPath));
  assert.ok(fs.statSync(backupPath).size > 0);
});

test('retensi backup hanya menyimpan beberapa salinan terbaru', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { backupDb } = require('../server/db');
  for (let i = 0; i < 10; i++) backupDb(db);
  const backupDir = path.join(tmpDir, 'backup');
  const files = fs.readdirSync(backupDir).filter((f) => /^issd-.*\.db$/.test(f));
  assert.ok(files.length <= 8, `backup tidak boleh menumpuk (${files.length} file)`);
});

function makeEnergyWorkbook(rows) {
  const wb = XLSX.utils.book_new();
  const monthly = rows.map((r) => ({
    Year: r.year,
    Month: r.month,
    Electricity_kWh: r.electricity_kwh,
    Gas_m3: r.gas_m3,
    Water_m3: r.water_m3,
    Note: r.note || '',
    Excluded: r.excluded ? 1 : 0
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthly), 'Monthly');

  const depts = rows.flatMap((r) => (r.departments || []).map((d) => ({ Year: r.year, Month: r.month, ...d })));
  if (depts.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depts), 'Departments');
  }
  return wb;
}

test('template import energy bisa di-download dan berisi sheet Monthly + Departments', () => {
  const tpl = api.get['/api/energy/import-template'](url('/api/energy/import-template'));
  assert.ok(tpl.filename.endsWith('.xlsx'));
  assert.ok(tpl.data.length > 0);

  const buf = Buffer.from(tpl.data, 'base64');
  const wb = XLSX.read(buf, { type: 'buffer' });
  assert.ok(wb.Sheets['Monthly']);
  assert.ok(wb.Sheets['Departments']);
});

test('import excel energy menulis data monthly dan departments', async () => {
  const rows = [
    {
      year: 2026,
      month: 11,
      electricity_kwh: 111111,
      gas_m3: 2222,
      water_m3: 3333,
      note: 'import test',
      excluded: false,
      departments: [{ Department: 'Test Dept', kWh: 55555, Share_pct: 50, vs_prev_pct: 1.2 }]
    }
  ];
  const wb = makeEnergyWorkbook(rows);
  const file = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  const before = api.get['/api/energy'](url('/api/energy'));
  assert.ok(!before.monthly.some((r) => r.year === 2026 && r.month === 11));

  const result = await post('/api/energy/import', { file }, 'importer');
  assert.strictEqual(result.monthly, 1);
  assert.strictEqual(result.departments, 1);
  assert.strictEqual(result.errors.length, 0);

  const after = api.get['/api/energy'](url('/api/energy'));
  const imported = after.monthly.find((r) => r.year === 2026 && r.month === 11);
  assert.ok(imported);
  assert.strictEqual(imported.electricity_kwh, 111111);
  assert.strictEqual(imported.note, 'import test');
  assert.ok(after.departments.some((r) => r.year === 2026 && r.month === 11 && r.department === 'Test Dept'));
});

test('import excel energy melewati baris invalid dan melaporkan error', async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([{ Year: 2026, Month: 13, Electricity_kWh: 100, Gas_m3: 1, Water_m3: 1 }]),
    'Monthly'
  );
  const file = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const result = await post('/api/energy/import', { file }, 'importer');
  assert.strictEqual(result.monthly, 0);
  assert.ok(result.errors.some((e) => e.includes('Year/Month')));
});

function fileToBase64(p) {
  return fs.readFileSync(p).toString('base64');
}

test('import file listrik legacy mengisi electricity_kwh per bulan', async (t) => {
  const src = path.join(__dirname, '..', 'Energy Report', '电力月报Monthly+Electricity+Report+2026.xlsx');
  if (!fs.existsSync(src)) {
    t.skip('file Energy Report tidak ada di workspace');
    return;
  }
  const file = fileToBase64(src);
  const result = await post('/api/energy/import', { file }, 'importer');
  assert.ok(result.monthly > 0, 'harus ada data listrik yang ter-import');
  const rows = api.get['/api/energy'](url('/api/energy')).monthly;
  const jan = rows.find((r) => r.year === 2026 && r.month === 1);
  assert.ok(jan, 'Januari 2026 harus ada');
  assert.ok(jan.electricity_kwh > 0, 'kWh Januari harus > 0');
});

test('import file air & gas legacy mengisi water_m3 dan gas_m3 per bulan', async (t) => {
  const src = path.join(__dirname, '..', 'Energy Report', 'WII-QR04-39_LAPORAN AIR DAN GAS 2026.xlsx');
  if (!fs.existsSync(src)) {
    t.skip('file Energy Report tidak ada di workspace');
    return;
  }
  const file = fileToBase64(src);
  const result = await post('/api/energy/import', { file }, 'importer');
  assert.ok(result.monthly > 0, 'harus ada data air/gas yang ter-import');
  const rows = api.get['/api/energy'](url('/api/energy')).monthly;
  const jan = rows.find((r) => r.year === 2026 && r.month === 1);
  assert.ok(jan, 'Januari 2026 harus ada');
  assert.ok(jan.water_m3 > 0, 'water Januari harus > 0');
  assert.ok(jan.gas_m3 > 0, 'gas Januari harus > 0');
});

/* ===== Endpoint publik (tanpa login) ===== */

test('dashboard publik hanya mengembalikan ringkasan, tanpa alert & work order', () => {
  const d = api.get['/api/public/dashboard'](url('/api/public/dashboard'));
  assert.ok(d.kpis, 'harus ada kpis');
  assert.ok(Array.isArray(d.energy), 'harus ada array energy');
  assert.ok(d.energyDelta || d.energyDelta === null, 'harus ada energyDelta');
  assert.ok(d.targets, 'harus ada targets');
  assert.strictEqual(d.alerts, undefined, 'alert internal tidak boleh muncul');
  assert.strictEqual(d.workOrders, undefined, 'work order tidak boleh muncul');
  assert.strictEqual(d.settings, undefined, 'settings tidak boleh muncul');
});

test('captcha mengembalikan token dan pertanyaan', () => {
  const c = api.get['/api/captcha'](url('/api/captcha'));
  assert.ok(c.token, 'token harus ada');
  assert.ok(c.question, 'pertanyaan harus ada');
  assert.match(c.question, /^\d+ \+ \d+ = \?$/, 'pertanyaan harus berupa a + b = ?');
});

test('tiket publik membuat tiket dengan actor guest di activity log', async () => {
  const cap = api.get['/api/captcha'](url('/api/captcha'));
  const ticket = await api.postPublic(
    { user_name: 'Pengunjung', issue: 'Printer mati', category: 'print', captcha_token: cap.token, captcha_answer: cap.question.match(/^(\d+)/)[1] * 1 + cap.question.match(/\+ (\d+)/)[1] * 1 },
    '10.0.0.1'
  );
  assert.match(ticket.ticket_no, /^T-\d{6}-\d{3}$/);
  assert.strictEqual(ticket.status, 'Open');
  assert.strictEqual(ticket.priority, 'Medium');
  const log = api.get['/api/activity'](url('/api/activity?limit=200'));
  const entry = log.find((e) => e.entity_ref === ticket.ticket_no);
  assert.ok(entry, 'tiket harus tercatat di activity log');
  assert.strictEqual(entry.actor, 'guest');
});

test('tiket publik dengan captcha salah ditolak', async () => {
  const cap = api.get['/api/captcha'](url('/api/captcha'));
  await assert.rejects(
    async () => api.postPublic(
      { user_name: 'Test', issue: 'Coba', captcha_token: cap.token, captcha_answer: '99999' },
      '10.0.0.2'
    ),
    /Jawaban captcha salah/i
  );
});

test('tiket publik tanpa field wajib ditolak', async () => {
  const cap = api.get['/api/captcha'](url('/api/captcha'));
  await assert.rejects(
    async () => api.postPublic(
      { user_name: '', issue: '', captcha_token: cap.token, captcha_answer: Number(cap.question.match(/^(\d+)/)[1]) + Number(cap.question.match(/\+ (\d+)/)[1]) },
      '10.0.0.3'
    ),
    /wajib diisi/i
  );
});

test('impor WII-QR04-39 lalu ekspor memakai rumus form dan pie 3D', async () => {
  const aoa = [
    ['WII-QR04-39'],
    ['能耗月度报表\n Energy Consumption Monthly Report  -2026'],
    [], [], [], [], [],
    ['7/1-7/31', 525, 701, 4, 360, 360, 154, 154, 1398, 2530, 479, 3928, 6665, 1270, 7723]
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), '2026');
  const file = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const imported = await post('/api/energy/import', { file }, 'importer');
  assert.ok(imported.monthly >= 1);

  const boiler = db.prepare(
    "SELECT qty FROM energy_locations WHERE year=2026 AND month=7 AND source='air' AND location='Boiler Room (Phase 1)'"
  ).get();
  const sewage = db.prepare(
    "SELECT qty FROM energy_locations WHERE year=2026 AND month=7 AND source='air' AND location='Sewage treatment capacity'"
  ).get();
  assert.strictEqual(boiler.qty, 525);
  assert.strictEqual(sewage.qty, 1270);

  const exp = await api.get['/api/energy/report-export'](url('/api/energy/report-export?year=2026&month=7'));
  assert.strictEqual(exp.filename, 'WII-QR04-39_2026.xlsx');
  assert.strictEqual(exp.chartMonth, 7);
  const out = XLSX.read(Buffer.from(exp.data, 'base64'), { type: 'buffer' });
  const ws = out.Sheets['2026'];
  assert.match(String(ws.A2.v), /Energy Consumption Monthly Report\s+-2026/);
  assert.strictEqual(String(ws.E14.f).replace(/\s+/g, ''), '(M14-B14-C14-D14-L14-K14)*0.35');
  assert.strictEqual(String(ws.L14.f).replace(/\s+/g, ''), 'SUM(I14:J14)');
  assert.strictEqual(ws.B14.v, 525);
  assert.strictEqual(ws.M14.v, 6665);
  assert.strictEqual(ws.O14.v, 7723);
  assert.strictEqual(ws.N14.v, 1270);
  assert.strictEqual(ws.E29.v, 3235);
  assert.strictEqual(ws.F29.v, 1923);
  assert.strictEqual(String(ws.L29.f).replace(/\s+/g, ''), 'C26-K29');
  const JSZip = require('jszip');
  const chart = await JSZip.loadAsync(Buffer.from(exp.data, 'base64')).then((z) => z.file('xl/charts/chart1.xml').async('string'));
  assert.match(chart, /pie3DChart/);
  assert.match(chart, /7月份全厂用水/);
  assert.match(chart, /'2026'!\$E\$27:\$J\$27/);
});

test('rate limit: 5 tiket publik per jam per IP lalu ditolak', async () => {
  const ans = (q) => Number(q.match(/^(\d+)/)[1]) + Number(q.match(/\+ (\d+)/)[1]);
  for (let i = 0; i < 5; i++) {
    const cap = api.get['/api/captcha'](url('/api/captcha'));
    await api.postPublic({ user_name: 'Bot', issue: `Spam ${i}`, captcha_token: cap.token, captcha_answer: ans(cap.question) }, '10.0.0.9');
  }
  const cap = api.get['/api/captcha'](url('/api/captcha'));
  await assert.rejects(
    async () => api.postPublic({ user_name: 'Bot', issue: 'Spam 5', captcha_token: cap.token, captcha_answer: ans(cap.question) }, '10.0.0.9'),
    /Batas/
  );
});
