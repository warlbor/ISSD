const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = process.env.ISSD_DB || path.join(dataDir, 'issd.db');

function getDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}

const KEEP_BACKUPS = 7;

function backupDb(db) {
  try {
    const dir = path.dirname(dbPath);
    const backupDir = path.join(dir, 'backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(backupDir, `issd-${ts}.db`);
    // VACUUM INTO membuat salinan database yang utuh dan konsisten, termasuk
    // transaksi yang masih berada di file WAL — copyFileSync bisa tertinggal.
    db.prepare('VACUUM INTO ?').run(dest);
    pruneBackups(backupDir);
    return dest;
  } catch (err) {
    console.error('[ISSD] Gagal backup database:', err.message);
    return null;
  }
}

/* Simpan hanya N backup terbaru; sisanya dihapus agar folder tidak membengkak. */
function pruneBackups(backupDir) {
  try {
    const files = fs.readdirSync(backupDir).filter((f) => /^issd-.*\.db$/.test(f)).sort();
    for (const old of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
      fs.unlinkSync(path.join(backupDir, old));
    }
  } catch {
    /* retensi bersifat best-effort */
  }
}

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS energy_monthly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      electricity_kwh REAL NOT NULL DEFAULT 0,
      gas_m3 REAL NOT NULL DEFAULT 0,
      water_m3 REAL NOT NULL DEFAULT 0,
      note TEXT,
      excluded INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT,
      updated_by TEXT,
      UNIQUE(year, month)
    );

    CREATE TABLE IF NOT EXISTS energy_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      department TEXT NOT NULL,
      kwh REAL NOT NULL,
      share_pct REAL,
      vs_prev_pct REAL,
      updated_at TEXT,
      updated_by TEXT
    );

    /* Pemakaian energi per lokasi/meter (poin revisi: bandingkan lokasi antar
       bulan). Kolom "source": 'listrik' (kWh) atau 'air' (m3). Gas tidak punya
       pembagian lokasi di file sumber, jadi hanya total bulanan. */
    CREATE TABLE IF NOT EXISTS energy_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      source TEXT NOT NULL,
      location TEXT NOT NULL,
      department TEXT,
      qty REAL NOT NULL DEFAULT 0,
      loss REAL,
      updated_at TEXT,
      updated_by TEXT
    );

    /* Bahan bakar non-listrik: Solar (HSD), Petrol, dan lainnya yang diisi
       bebas. Satuan umumnya liter, tapi bisa beda per baris. */
    CREATE TABLE IF NOT EXISTS energy_fuels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      fuel_type TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'liter',
      note TEXT,
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_no TEXT UNIQUE NOT NULL,
      module TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT,
      reporter TEXT,
      status TEXT NOT NULL DEFAULT 'Open',
      priority TEXT NOT NULL DEFAULT 'Medium',
      assigned_to TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS safety_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspect_date TEXT NOT NULL,
      area TEXT NOT NULL,
      finding TEXT NOT NULL,
      status TEXT NOT NULL,
      pic TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS safety_kpis (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT
    );

    CREATE TABLE IF NOT EXISTS ga_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item TEXT NOT NULL,
      stock REAL NOT NULL,
      rop REAL NOT NULL,
      unit TEXT,
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS vehicle_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_no TEXT UNIQUE NOT NULL,
      borrower TEXT NOT NULL,
      use_at TEXT NOT NULL,
      purpose TEXT NOT NULL,
      vehicle TEXT NOT NULL,
      driver TEXT,
      km REAL,
      fuel_est REAL,
      status TEXT NOT NULL DEFAULT 'Pending Approval',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS it_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT UNIQUE NOT NULL,
      user_name TEXT NOT NULL,
      issue TEXT NOT NULL,
      host TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'Open',
      priority TEXT NOT NULL DEFAULT 'Medium',
      assigned_to TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS facility_pm (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment TEXT NOT NULL,
      total_units TEXT NOT NULL,
      done TEXT NOT NULL,
      progress TEXT,
      next_schedule TEXT,
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS it_infra (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      updated_at TEXT,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      unit TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      message TEXT NOT NULL,
      extra TEXT,
      severity TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS jsa_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT,
      location_desc TEXT,
      workers INTEGER,
      tools TEXT,
      result TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS ai_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      module TEXT,
      question TEXT,
      answer TEXT,
      model TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS site_kpis (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_ref TEXT,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS counters (
      prefix TEXT PRIMARY KEY,
      last_n INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_energy_dept
      ON energy_departments(year, month, department);
    CREATE INDEX IF NOT EXISTS ix_wo_module ON work_orders(module);
    CREATE INDEX IF NOT EXISTS ix_ticket_status ON it_tickets(status);
    CREATE INDEX IF NOT EXISTS ix_activity_created ON activity_log(created_at);
  `);

  migrate(db);

  const count = db.prepare('SELECT COUNT(*) AS n FROM energy_monthly').get().n;
  const seeded = db.prepare("SELECT value FROM app_settings WHERE key='seed_done'").get();
  if (count === 0 && !seeded) seed(db);
  // Tandai seed pernah dijalankan: data dummy tidak boleh kembali setelah
  // pengguna menghapusnya, walau energy_monthly sempat kosong.
  if (!seeded) {
    db.prepare("INSERT OR REPLACE INTO app_settings (key,value,label) VALUES ('seed_done','1','Flag seed awal (internal)')").run();
  }

  ensureSettings(db);
}

/* Kolom & tabel baru ditambahkan ke database lama tanpa menghapus data. */
function migrate(db) {
  const add = (table, name, decl) => {
    const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === name);
    if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${decl}`);
  };

  add('energy_monthly', 'excluded', 'INTEGER NOT NULL DEFAULT 0');
  add('energy_monthly', 'updated_at', 'TEXT');
  add('energy_monthly', 'updated_by', 'TEXT');
  add('energy_departments', 'updated_at', 'TEXT');
  add('energy_departments', 'updated_by', 'TEXT');
  add('work_orders', 'updated_at', 'TEXT');
  add('work_orders', 'updated_by', 'TEXT');
  add('safety_inspections', 'pic', 'TEXT');
  add('safety_inspections', 'created_at', 'TEXT');
  add('safety_inspections', 'updated_at', 'TEXT');
  add('safety_inspections', 'updated_by', 'TEXT');
  add('ga_stock', 'updated_at', 'TEXT');
  add('ga_stock', 'updated_by', 'TEXT');
  add('vehicle_bookings', 'updated_at', 'TEXT');
  add('vehicle_bookings', 'updated_by', 'TEXT');
  add('it_tickets', 'priority', "TEXT NOT NULL DEFAULT 'Medium'");
  add('it_tickets', 'assigned_to', 'TEXT');
  add('it_tickets', 'updated_at', 'TEXT');
  add('it_tickets', 'updated_by', 'TEXT');
  add('facility_pm', 'updated_at', 'TEXT');
  add('facility_pm', 'updated_by', 'TEXT');
  add('jsa_logs', 'created_by', 'TEXT');
  add('ai_logs', 'created_by', 'TEXT');
  add('ai_logs', 'session_id', 'TEXT');
  add('ai_logs', 'model', 'TEXT');

  // Baris "zero reset" adalah pembacaan meter kumulatif, bukan konsumsi bulanan.
  db.prepare(
    "UPDATE energy_monthly SET excluded=1 WHERE excluded=0 AND lower(note) LIKE '%zero reset%'"
  ).run();
}

function ensureSettings(db) {
  // seed_done sudah mengisi satu baris sebelum default tarif sempat ditulis.
  // INSERT OR IGNORE mengisi kunci yang belum ada tanpa menimpa nilai pengguna.
  const ins = db.prepare('INSERT OR IGNORE INTO app_settings (key,value,label,unit) VALUES (?,?,?,?)');
  for (const row of SETTINGS_DEFAULT) ins.run(...row);
  /* Gas dilaporkan dalam MMbtu (bukan Nm³) — perbarui label lama. */
  db.prepare("UPDATE app_settings SET unit='Rp/MMbtu' WHERE key='harga_gas' AND unit='Rp/Nm³'").run();
  db.prepare("UPDATE app_settings SET unit='MMbtu/bulan' WHERE key='target_gas' AND unit='m³/bulan'").run();
  const m = db.prepare('SELECT COUNT(*) AS n FROM it_infra').get().n;
  if (m === 0) {
    const ins = db.prepare('INSERT INTO it_infra (key,label,value,severity) VALUES (?,?,?,?)');
    for (const row of IT_INFRA_DEFAULT) ins.run(...row);
  }
}

const SETTINGS_DEFAULT = [
  ['tarif_listrik', '1467', 'Tarif Listrik', 'Rp/kWh'],
  ['harga_gas', '9500', 'Harga Gas Alam', 'Rp/MMbtu'],
  ['harga_air', '9000', 'Tarif Air', 'Rp/m³'],
  ['harga_bbm', '4800', 'Harga BBM per Kilometer', 'Rp/km'],
  ['co2_factor', '0.7', 'Faktor Emisi Listrik', 'kg CO₂/kWh'],
  ['target_hemat_listrik', '5', 'Target Penghematan Listrik', '%'],
  ['target_air', '6500', 'Batas Konsumsi Air', 'm³/bulan'],
  ['target_gas', '7000', 'Batas Konsumsi Gas', 'MMbtu/bulan'],
  ['sla_it', '4', 'SLA Penanganan Tiket IT', 'jam']
];

const IT_INFRA_DEFAULT = [
  ['internet_primary', 'Internet Primary (500 Mbps)', 'Online · 482 Mbps', 'ok'],
  ['internet_backup', 'Internet Backup (100 Mbps)', 'Stand-by', 'info'],
  ['server_fs', 'Server File (PROD-FS01)', 'CPU 34% · RAM 62%', 'ok'],
  ['server_dc', 'Server Domain (PROD-DC01)', 'CPU 18% · RAM 41%', 'ok'],
  ['rack_temp', 'Rack Temperature', '29°C — cek AC', 'warn'],
  ['backup_daily', 'Backup Daily', 'Berhasil 100%', 'ok']
];

function seed(db) {
  const energy = [
    [2026, 1, 13644111, 5387, 5278, 'Pembacaan meter kumulatif awal tahun (zero reset)', 1],
    [2026, 2, 456174, 2447, 3202, null, 0],
    [2026, 3, 343251, 2624, 3978, null, 0],
    [2026, 4, 400000, 2286, 4539, 'Perkiraan', 0],
    [2026, 5, 600000, 4852, 4115, 'Perkiraan', 0],
    [2026, 6, 369891, 7751, 7462, null, 0],
    [2026, 7, 501163, 7723, 6665, null, 0],
    [2026, 8, 555103, 6305, 6233, null, 0]
  ];
  const insE = db.prepare(
    'INSERT INTO energy_monthly (year,month,electricity_kwh,gas_m3,water_m3,note,excluded) VALUES (?,?,?,?,?,?,?)'
  );
  for (const row of energy) insE.run(...row);

  const depts = [
    ['Site Service / Utilitas (AC, Lighting, Boiler, Genset, Maintenance)', 297369, 53.6, 1.7],
    ['Production (Grinding, Pulping, Drying, Slitting, SVG)', 230093, 41.4, 24.5],
    ['Supply Chain / Warehouse (Finished Goods, Raw Material WH)', 23415, 4.2, 16.9],
    ['Quality Control / Lab (QC Lab equipment)', 3663, 0.7, -0.6],
    ['Technology / RnD Center', 563, 0.1, 85.2]
  ];
  const insD = db.prepare(
    'INSERT INTO energy_departments (year,month,department,kwh,share_pct,vs_prev_pct) VALUES (2026,8,?,?,?,?)'
  );
  for (const row of depts) insD.run(...row);

  const wos = [
    ['WO-0921', 'Facility', 'AC Ruang Rapat 3 bocor', 'Lantai 2 Ruang Rapat 3', 'GA', 'In Progress', 'High', 'Dody'],
    ['WO-0920', 'IT', 'WiFi Lantai 1 lemah', 'Lantai 1', 'Rudi', 'Open', 'Medium', null],
    ['WO-0919', 'Safety', 'APAR Gudang A kadaluarsa', 'Gudang A', 'HSE', 'Pending', 'Critical', null],
    ['WO-0918', 'GA', 'Pengajuan kendaraan operasional', 'Pool GA', 'Budi Santoso', 'Approved', 'Low', 'Ahmad'],
    ['WO-0917', 'Energy', 'Kalibrasi meter listrik Genset', 'Ruang Genset', 'Utility', 'Scheduled', 'Medium', 'Tono']
  ];
  const insW = db.prepare(
    'INSERT INTO work_orders (wo_no,module,description,location,reporter,status,priority,assigned_to) VALUES (?,?,?,?,?,?,?,?)'
  );
  for (const row of wos) insW.run(...row);

  const insp = [
    ['2026-08-29', 'Gudang B3', 'APAR 2 unit kadaluarsa', 'Pending', 'HSE'],
    ['2026-08-28', 'Line Produksi 2', 'Rambu safety tertutup material', 'Closed', 'Agus'],
    ['2026-08-27', 'Roof Top', 'Pagar pembatas kurang', 'Progress', 'HSE'],
    ['2026-08-26', 'Ruang Genset', 'Tangki solar kurang rambu', 'Closed', 'Tono']
  ];
  const insI = db.prepare(
    'INSERT INTO safety_inspections (inspect_date,area,finding,status,pic) VALUES (?,?,?,?,?)'
  );
  for (const row of insp) insI.run(...row);

  const sk = [
    ['lti', '0', 'Lost Time Injury (LTI)'],
    ['near_miss', '3', 'Near Miss Bulan Ini'],
    ['permits', '127', 'Izin Kerja Terbit'],
    ['ppe', '94%', 'Skor Kepatuhan PPE'],
    ['work_hours', '1,284,500 jam', 'Total Work Hours'],
    ['ltifr', '0.00', 'LTIFR'],
    ['trifr', '0.78', 'TRIFR'],
    ['safety_talk', '124 sesi', 'Safety Talk Dilaksanakan'],
    ['new_training', '38 orang', 'Pelatihan Pekerja Baru']
  ];
  const insSk = db.prepare('INSERT INTO safety_kpis (key,value,label) VALUES (?,?,?)');
  for (const row of sk) insSk.run(...row);

  const stock = [
    ['Kertas A4 (rim)', 18, 30, 'rim'],
    ['Pulpen Hitam (pcs)', 42, 50, 'pcs'],
    ['Paper Clip (kotak)', 25, 20, 'kotak'],
    ['Map Stopmap Plastik', 12, 30, 'pcs'],
    ['Tinta Printer HP 803 BK', 5, 10, 'unit'],
    ['Soft File Manilla', 80, 40, 'pcs']
  ];
  const insSt = db.prepare('INSERT INTO ga_stock (item,stock,rop,unit) VALUES (?,?,?,?)');
  for (const row of stock) insSt.run(...row);

  const tickets = [
    ['T-2309', 'Dewi', 'Password akun terkunci', 'Solved', 'pw', 'PC-GA-012'],
    ['T-2308', 'Rudi', 'Printer HP LaserJet error 50', 'Assigned', 'print', 'PC-PROD-087'],
    ['T-2307', 'Sari', 'Outlook tidak sync', 'Pending', 'email', 'NB-QA-004']
  ];
  const insT = db.prepare(
    'INSERT INTO it_tickets (ticket_no,user_name,issue,status,category,host) VALUES (?,?,?,?,?,?)'
  );
  for (const row of tickets) insT.run(...row);

  const pm = [
    ['AC Split 1-5 PK', '78', '78', '100%', 'Okt 2026'],
    ['AC Central / AHU', '8', '8', '100%', 'Okt 2026'],
    ['Lift Penumpang (3 unit)', '3', '3', '100%', '15 Sep 2026'],
    ['Escalator (4 unit)', '4', '4', '100%', '20 Sep 2026'],
    ['Genset 500 kVA', '2', '2', '100%', '10 Sep 2026'],
    ['Fire Alarm & Hydrant', '1 sistem', '0', '0% — Minggu ini', '03 Sep 2026'],
    ['Panel Listrik & Trafo', '36', '36', '100%', 'Des 2026']
  ];
  const insPm = db.prepare(
    'INSERT INTO facility_pm (equipment,total_units,done,progress,next_schedule) VALUES (?,?,?,?,?)'
  );
  for (const row of pm) insPm.run(...row);

  const alerts = [
    ['SAFETY', 'Hot Work Area B3', 'Perlu Pengawasan', 'warn'],
    ['IT', 'Server Rack A4 Suhu', '29°C — Periksa AC', 'warn'],
    ['FACILITY', 'Lift Lantai 2', 'Selesai Servis', 'ok']
  ];
  const insA = db.prepare('INSERT INTO alerts (module,message,extra,severity) VALUES (?,?,?,?)');
  for (const row of alerts) insA.run(...row);

  const kpis = [
    ['safety_compliance', '94%', 'Kepatuhan Safety Bulan Ini', 'green'],
    ['it_open', '18', 'Tiket IT Open', 'blue'],
    ['facility_uptime', '98.7%', 'Uptime Facility', 'purple'],
    ['ga_vehicles', '24', 'Unit Kendaraan Operasional', ''],
    ['ga_attendance', '96%', 'Tingkat Kehadiran Karyawan', 'green'],
    ['ga_visitors', '1,842', 'Pengunjung Bulan Ini', ''],
    ['net_uptime', '99.97%', 'Uptime Jaringan', 'green'],
    ['devices', '412', 'Perangkat Aktif Terdaftar', 'blue'],
    ['sec_alerts', '2', 'Alert Keamanan 24 Jam', 'orange'],
    ['pm_month', '100%', 'Preventive Maintenance (Bulan Ini)', 'green'],
    ['ac_units', '86', 'Unit AC Indoor', ''],
    ['lift_avail', '100%', 'Ketersediaan Lift/Escalator', 'green'],
    ['satisfaction', '4.6 / 5.0', 'Kepuasan Pengguna', 'blue'],
    ['sla_it_pct', '92%', 'Pencapaian SLA IT', 'green'],
    ['zero_incident', 'ON TRACK', 'Zero Incident (Safety)', 'green']
  ];
  const insK = db.prepare('INSERT INTO site_kpis (key,value,label,color) VALUES (?,?,?,?)');
  for (const row of kpis) insK.run(...row);
}

/* Nomor dokumen tidak boleh dipakai ulang walaupun barisnya sudah dihapus,
   karena nomor ini tercetak di form/booking dan disebut di activity log.
   Counter per hari disimpan di tabel counters, disinkronkan sekali dari data lama. */
function nextNo(db, table, col, prefix) {
  if (!/^[a-z_]+$/i.test(table) || !/^[a-z_]+$/i.test(col)) {
    throw new Error('Nama tabel/kolom tidak valid');
  }
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const head = `${prefix}-${ymd}-`;

  if (!db.prepare('SELECT prefix FROM counters WHERE prefix=?').get(head)) {
    let max = 0;
    for (const r of db.prepare(`SELECT ${col} AS v FROM ${table} WHERE ${col} LIKE ?`).all(`${head}%`)) {
      const n = parseInt(String(r.v).slice(head.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    db.prepare('INSERT INTO counters (prefix,last_n) VALUES (?,?) ON CONFLICT(prefix) DO NOTHING').run(head, max);
  }

  const row = db
    .prepare('UPDATE counters SET last_n = last_n + 1 WHERE prefix=? RETURNING last_n')
    .get(head);
  return `${head}${String(row.last_n).padStart(3, '0')}`;
}

function logActivity(db, actor, action, entity, entityRef, detail) {
  db.prepare(
    'INSERT INTO activity_log (actor,action,entity,entity_ref,detail) VALUES (?,?,?,?,?)'
  ).run(actor || 'anonim', action, entity, entityRef || null, detail || null);
}

module.exports = { getDb, init, nextNo, logActivity, dbPath, backupDb };
