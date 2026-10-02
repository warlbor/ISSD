const crypto = require('crypto');
const { nextNo, logActivity } = require('./db');
const { ask: askAi } = require('./ai');
const XLSX = require('xlsx');
const { buildWiiQr0439Workbook, WATER_LOCATIONS } = require('./wii-qr04-39');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (m) => new ApiError(400, m);
const notFound = (m = 'Data tidak ditemukan') => new ApiError(404, m);

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const mLabel = (m) => MONTHS[m] || '';

const EDITABLE = {
  energy_monthly: ['year', 'month', 'electricity_kwh', 'gas_m3', 'water_m3', 'note', 'excluded'],
  energy_departments: ['year', 'month', 'department', 'kwh', 'share_pct', 'vs_prev_pct'],
  energy_locations: ['year', 'month', 'source', 'location', 'department', 'qty', 'loss'],
  energy_fuels: ['year', 'month', 'fuel_type', 'qty', 'unit', 'note'],
  work_orders: ['module', 'description', 'location', 'reporter', 'status', 'priority', 'assigned_to'],
  it_tickets: ['user_name', 'issue', 'host', 'category', 'status', 'priority', 'assigned_to'],
  vehicle_bookings: ['borrower', 'use_at', 'purpose', 'vehicle', 'driver', 'km', 'fuel_est', 'status'],
  ga_stock: ['item', 'stock', 'rop', 'unit'],
  safety_inspections: ['inspect_date', 'area', 'finding', 'status', 'pic'],
  facility_pm: ['equipment', 'total_units', 'done', 'progress', 'next_schedule']
};

const ENUMS = {
  work_orders: {
    module: ['Facility', 'IT', 'Safety', 'GA', 'Energy'],
    status: ['Open', 'In Progress', 'Pending', 'Scheduled', 'Approved', 'Closed', 'Cancelled'],
    priority: ['Low', 'Medium', 'High', 'Critical']
  },
  it_tickets: {
    status: ['Open', 'Assigned', 'Pending', 'Solved', 'Closed', 'Cancelled'],
    priority: ['Low', 'Medium', 'High', 'Critical'],
    category: ['net', 'email', 'wifi', 'print', 'vpn', 'slow', 'pw', 'other']
  },
  vehicle_bookings: {
    status: ['Pending Approval', 'Approved', 'Rejected', 'In Use', 'Returned', 'Cancelled']
  },
  safety_inspections: {
    status: ['Pending', 'Progress', 'Closed']
  },
  alerts: {
    severity: ['ok', 'warn', 'danger']
  },
  it_infra: {
    severity: ['ok', 'warn', 'danger', 'info']
  }
};

const NUMERIC = new Set([
  'year', 'month', 'electricity_kwh', 'gas_m3', 'water_m3', 'excluded', 'kwh', 'share_pct',
  'vs_prev_pct', 'stock', 'rop', 'km', 'fuel_est', 'qty', 'loss'
]);

function norm(field, value) {
  if (value === null || value === '') return NUMERIC.has(field) ? 0 : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (NUMERIC.has(field)) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw bad(`Field "${field}" harus berupa angka`);
    return n;
  }
  if (typeof value !== 'string' && typeof value !== 'number') throw bad(`Field "${field}" tidak valid`);
  const s = String(value).trim();
  if (s.length > 2000) throw bad(`Field "${field}" terlalu panjang`);
  return s;
}

function need(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
      throw bad(`Field "${f}" wajib diisi`);
    }
  }
}

function assertTable(table) {
  if (!EDITABLE[table]) throw new ApiError(500, `Tabel ${table} tidak dikenal`);
}

function validateEnum(table, field, value) {
  const allowed = ENUMS[table]?.[field];
  if (!allowed) return value;
  if (!allowed.includes(value)) {
    throw bad(`Field "${field}" harus salah satu dari: ${allowed.join(', ')}`);
  }
  return value;
}

function validateEnums(table, body) {
  const rules = ENUMS[table];
  if (!rules) return;
  for (const field of Object.keys(rules)) {
    if (body[field] !== undefined) validateEnum(table, field, body[field]);
  }
}

function createApi(db) {
  /* ===== CAPTCHA & rate limit untuk endpoint publik ===== */

  /* Tantangan hitung sederhana, cukup untuk menggagalkan bot spam tiket
     tanpa memasang dependensi gambar. Hanya di memori (cukup untuk LAN). */
  const CAPTCHA_MS = 5 * 60 * 1000;
  const captchas = new Map();

  function newCaptcha() {
    const now = Date.now();
    for (const [tok, c] of captchas) {
      if (now - c.at > CAPTCHA_MS) captchas.delete(tok);
    }
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    const token = crypto.randomBytes(16).toString('hex');
    captchas.set(token, { answer: String(a + b), at: now });
    return { token, question: `${a} + ${b} = ?` };
  }

  function checkCaptcha(token, answer) {
    const c = captchas.get(String(token || ''));
    if (!c) throw bad('Kode captcha tidak dikenal atau sudah kedaluwarsa. Muat ulang captcha.');
    if (Date.now() - c.at > CAPTCHA_MS) {
      captchas.delete(String(token));
      throw bad('Kode captcha sudah kedaluwarsa. Muat ulang captcha.');
    }
    if (String(answer ?? '').trim() !== c.answer) throw bad('Jawaban captcha salah');
    // Sekali pakai supaya challenge tidak bisa disalahgunakan berulang.
    captchas.delete(String(token));
  }

  /* Batasi tiket anonim per IP agar database tidak dibanjiri spam. */
  const PUBLIC_TICKET_MAX = 5;
  const PUBLIC_TICKET_WINDOW_MS = 60 * 60 * 1000;
  const ticketByIp = new Map();

  function allowPublicTicket(ip) {
    const now = Date.now();
    const list = (ticketByIp.get(ip) || []).filter((t) => now - t < PUBLIC_TICKET_WINDOW_MS);
    if (list.length >= PUBLIC_TICKET_MAX) {
      ticketByIp.set(ip, list);
      throw new ApiError(429, `Batas ${PUBLIC_TICKET_MAX} tiket per jam tercapai. Coba lagi nanti atau hubungi IT langsung.`);
    }
    list.push(now);
    ticketByIp.set(ip, list);
  }

  /* Tiket dari pengunjung tanpa login: field sensitif di-hardcode server-side. */
  function createPublicTicket(body, ip) {
    allowPublicTicket(ip);
    checkCaptcha(body.captcha_token, body.captcha_answer);

    const name = String(body.user_name || '').trim();
    const issue = String(body.issue || '').trim();
    if (!name) throw bad('Field "user_name" wajib diisi');
    if (!issue) throw bad('Field "issue" wajib diisi');
    if (name.length > 100) throw bad('Nama terlalu panjang (maks 100 karakter)');
    if (issue.length > 2000) throw bad('Uraian masalah terlalu panjang (maks 2000 karakter)');

    const ticketNo = nextNo(db, 'it_tickets', 'ticket_no', 'T');
    db.prepare(`
      INSERT INTO it_tickets (ticket_no,user_name,issue,host,category,status,priority,updated_by)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      ticketNo,
      name,
      issue,
      body.host ? String(body.host).trim().slice(0, 200) : '',
      validateEnum('it_tickets', 'category', body.category || 'other'),
      'Open',
      'Medium',
      'guest'
    );
    const row = db.prepare('SELECT * FROM it_tickets WHERE ticket_no=?').get(ticketNo);
    logActivity(db, 'guest', 'create', 'it_tickets', ticketNo, `publik: ${row.issue.slice(0, 80)}`);
    return row;
  }

  /* ===== Pembacaan data turunan ===== */

  function settings() {
    const out = {};
    for (const r of db.prepare('SELECT * FROM app_settings').all()) {
      const n = Number(r.value);
      out[r.key] = Number.isFinite(n) && String(r.value).trim() !== '' ? n : r.value;
    }
    return out;
  }

  function kpiMap() {
    const out = {};
    for (const r of db.prepare('SELECT * FROM site_kpis').all()) out[r.key] = r;
    return out;
  }

  function activeEnergy() {
    return db
      .prepare('SELECT * FROM energy_monthly WHERE excluded=0 ORDER BY year, month')
      .all();
  }

  function latestPair() {
    const rows = activeEnergy();
    return { current: rows.at(-1) || null, previous: rows.at(-2) || null };
  }

  const fmt = (n) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

  /* Alert dihitung dari data nyata, digabung dengan alert manual dari tabel alerts. */
  function liveAlerts() {
    const s = settings();
    const out = [];
    const rows = activeEnergy();
    const cur = rows.at(-1);
    const prev = rows.at(-2);

    if (cur && prev && prev.electricity_kwh) {
      const pct = ((cur.electricity_kwh - prev.electricity_kwh) / prev.electricity_kwh) * 100;
      out.push({
        module: 'ENERGY',
        message: pct >= 0
          ? `Listrik ${mLabel(cur.month)} ${cur.year} naik ${pct.toFixed(1)}% vs ${mLabel(prev.month)}`
          : `Listrik ${mLabel(cur.month)} ${cur.year} hemat ${Math.abs(pct).toFixed(1)}% vs ${mLabel(prev.month)}`,
        extra: `${fmt(cur.electricity_kwh)} kWh`,
        severity: pct > (s.target_hemat_listrik || 5) ? 'danger' : pct >= 0 ? 'warn' : 'ok',
        live: 1
      });
    }

    if (cur) {
      if (s.target_gas && cur.gas_m3 > s.target_gas) {
        out.push({
          module: 'ENERGY',
          message: `Gas ${mLabel(cur.month)} melewati batas ${fmt(s.target_gas)} m³`,
          extra: `${fmt(cur.gas_m3)} m³`,
          severity: 'warn',
          live: 1
        });
      }
      if (s.target_air && cur.water_m3 > s.target_air) {
        out.push({
          module: 'ENERGY',
          message: `Air ${mLabel(cur.month)} melewati batas ${fmt(s.target_air)} m³`,
          extra: `${fmt(cur.water_m3)} m³`,
          severity: 'danger',
          live: 1
        });
      }
      const tail = rows.slice(-6);
      if (tail.length >= 3) {
        // Lonjakan >20% vs rata-rata bulan-bulan sebelumnya, untuk semua sumber
        // energi (sebelumnya hanya gas).
        const base = tail.slice(0, -1);
        const spikeFields = [
          ['electricity_kwh', 'Listrik', 'kWh'],
          ['gas_m3', 'Gas', 'm³'],
          ['water_m3', 'Air', 'm³']
        ];
        for (const [field, label, unit] of spikeFields) {
          const avg = base.reduce((a, r) => a + r[field], 0) / base.length;
          if (avg && (cur[field] - avg) / avg > 0.2) {
            out.push({
              module: 'ENERGY',
              message: `${label} ${mLabel(cur.month)} ↑${(((cur[field] - avg) / avg) * 100).toFixed(0)}% vs rata-rata ${base.length} bulan`,
              extra: `${fmt(cur[field])} ${unit}`,
              severity: 'warn',
              live: 1
            });
          }
        }
      }
    }

    const lowAtk = db
      .prepare('SELECT COUNT(*) AS n FROM ga_stock WHERE stock < rop')
      .get().n;
    if (lowAtk) {
      out.push({
        module: 'GA',
        message: `${lowAtk} item ATK di bawah reorder point`,
        extra: 'Perlu order',
        severity: 'warn',
        live: 1
      });
    }

    const critical = db
      .prepare("SELECT COUNT(*) AS n FROM work_orders WHERE priority='Critical' AND status NOT IN ('Closed','Done','Cancelled')")
      .get().n;
    if (critical) {
      out.push({
        module: 'FACILITY',
        message: `${critical} work order prioritas Critical belum selesai`,
        extra: 'Segera tindak',
        severity: 'danger',
        live: 1
      });
    }

    const openTicket = db
      .prepare("SELECT COUNT(*) AS n FROM it_tickets WHERE status NOT IN ('Solved','Closed','Cancelled')")
      .get().n;
    if (openTicket) {
      out.push({
        module: 'IT',
        message: `${openTicket} tiket helpdesk masih open`,
        extra: `SLA ${s.sla_it || 4} jam`,
        severity: 'warn',
        live: 1
      });
    }

    const pendingInsp = db
      .prepare("SELECT COUNT(*) AS n FROM safety_inspections WHERE status NOT IN ('Closed','Done')")
      .get().n;
    if (pendingInsp) {
      out.push({
        module: 'SAFETY',
        message: `${pendingInsp} temuan inspeksi belum ditutup`,
        extra: 'Tindak lanjut HSE',
        severity: 'danger',
        live: 1
      });
    }

    const pmBehind = db
      .prepare("SELECT COUNT(*) AS n FROM facility_pm WHERE progress NOT LIKE '100%'")
      .get().n;
    if (pmBehind) {
      out.push({
        module: 'FACILITY',
        message: `${pmBehind} jadwal preventive maintenance belum 100%`,
        extra: 'Cek teknisi',
        severity: 'warn',
        live: 1
      });
    }

    return out;
  }

  function energyDelta() {
    const { current, previous } = latestPair();
    const s = settings();
    if (!current) return null;
    const kwh = current.electricity_kwh;
    const delta = {
      month: mLabel(current.month),
      year: current.year,
      kwh,
      mwh: kwh / 1000,
      gj: kwh * 0.0036,
      cost: kwh * (s.tarif_listrik || 0),
      co2: (kwh * (s.co2_factor || 0)) / 1000,
      gas: current.gas_m3,
      water: current.water_m3,
      gasCost: current.gas_m3 * (s.harga_gas || 0),
      waterCost: current.water_m3 * (s.harga_air || 0),
      pct: null,
      prevMonth: null
    };
    if (previous && previous.electricity_kwh) {
      delta.pct = ((kwh - previous.electricity_kwh) / previous.electricity_kwh) * 100;
      delta.prevMonth = mLabel(previous.month);
      delta.prevKwh = previous.electricity_kwh;
    }
    /* YoY: bandingkan dengan bulan yang sama tahun lalu (lebih adil dari MoM
       untuk industri musiman). Tidak ada barisnya = tanpa perbandingan. */
    const yoy = activeEnergy().find((r) => r.month === current.month && r.year === current.year - 1);
    if (yoy && yoy.electricity_kwh) {
      delta.yoyKwh = yoy.electricity_kwh;
      delta.yoyPct = ((kwh - yoy.electricity_kwh) / yoy.electricity_kwh) * 100;
      delta.yoyLabel = `${mLabel(current.month)} ${current.year - 1}`;
    }
    delta.totalCost = delta.cost + delta.gasCost + delta.waterCost;
    return delta;
  }

  /* ===== Operasi tulis generik ===== */

  function patchRow(table, id, body, actor) {
    assertTable(table);
    validateEnums(table, body);
    const exists = db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id);
    if (!exists) throw notFound();
    const sets = [];
    const vals = [];
    const changed = [];
    for (const f of EDITABLE[table]) {
      if (body[f] === undefined) continue;
      sets.push(`${f}=?`);
      vals.push(norm(f, body[f]));
      changed.push(f);
    }
    if (!sets.length) throw bad('Tidak ada field yang dikirim untuk diperbarui');
    vals.push(actor || 'anonim', id);
    db.prepare(
      `UPDATE ${table} SET ${sets.join(', ')}, updated_at=datetime('now','localtime'), updated_by=? WHERE id=?`
    ).run(...vals);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    logActivity(db, actor, 'update', table, String(id), changed.join(', '));
    return row;
  }

  function deleteRow(table, id, actor) {
    assertTable(table);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!row) throw notFound();
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    logActivity(db, actor, 'delete', table, String(id), JSON.stringify(row).slice(0, 300));
    return { ok: true, id };
  }

  function getRow(table, id) {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!row) throw notFound();
    return row;
  }

  /* ===== Helper import Excel Energy ===== */

  const MONTHLY_COLS = {
    year: ['year', 'tahun'],
    month: ['month', 'bulan'],
    electricity_kwh: ['electricitykwh', 'kwh', 'listrik'],
    gas_m3: ['gasm3', 'gas'],
    water_m3: ['waterm3', 'air'],
    note: ['note', 'catatan'],
    excluded: ['excluded', 'kecualikan']
  };

  const DEPT_COLS = {
    year: ['year', 'tahun'],
    month: ['month', 'bulan'],
    department: ['department', 'departemen', 'dept'],
    kwh: ['kwh'],
    share_pct: ['sharepct', 'share', 'porsi'],
    vs_prev_pct: ['vsprevpct', 'vsprev', 'vsbulanlalu']
  };

  function normalizeHeader(h) {
    return String(h).toLowerCase().replace(/[\s_-]+/g, '');
  }

  function colMap(row, schema) {
    const map = {};
    for (const [field, candidates] of Object.entries(schema)) {
      for (const key of Object.keys(row)) {
        if (candidates.includes(normalizeHeader(key))) {
          map[field] = row[key];
          break;
        }
      }
    }
    return map;
  }

  function isEmptyRow(row) {
    return Object.values(row).every((v) => v === '' || v === null || v === undefined);
  }

  function monthFromName(name) {
    const map = {
      januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
      juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12
    };
    const n = String(name).toLowerCase().replace(/[^a-z]/g, '');
    return map[n] || null;
  }

  function headerValue(row, text) {
    for (const [col, val] of Object.entries(row)) {
      if (String(val).toLowerCase().includes(text.toLowerCase())) return col;
    }
    return null;
  }

  function generateEnergyTemplate() {
    const wb = XLSX.utils.book_new();
    const monthly = [
      { Year: 2026, Month: 9, Electricity_kWh: 520000, Gas_m3: 6100, Water_m3: 6000, Note: '', Excluded: 0 },
      { Year: 2026, Month: 10, Electricity_kWh: 540000, Gas_m3: 6200, Water_m3: 6100, Note: '', Excluded: 0 }
    ];
    const ws1 = XLSX.utils.json_to_sheet(monthly);
    XLSX.utils.book_append_sheet(wb, ws1, 'Monthly');

    const depts = [
      { Year: 2026, Month: 10, Department: 'Production', kWh: 230000, Share_pct: 42.5, vs_prev_pct: 5.2 },
      { Year: 2026, Month: 10, Department: 'Utilities', kWh: 180000, Share_pct: 33.3, vs_prev_pct: -1.5 }
    ];
    const ws2 = XLSX.utils.json_to_sheet(depts);
    XLSX.utils.book_append_sheet(wb, ws2, 'Departments');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf).toString('base64');
  }

  /* Laporan WII-QR04-39 (layout + rumus form 2026) plus lembar listrik dan BBM. */
  async function generateEnergyReportExport(year, chartMonth) {
    const monthly = db.prepare('SELECT * FROM energy_monthly WHERE year=? ORDER BY month').all(year);
    const airLocations = db
      .prepare("SELECT * FROM energy_locations WHERE year=? AND source='air' ORDER BY month, id")
      .all(year);
    const elecLocations = db
      .prepare("SELECT * FROM energy_locations WHERE year=? AND source='listrik' ORDER BY month, id")
      .all(year);
    const fuels = db.prepare('SELECT * FROM energy_fuels WHERE year=? ORDER BY month, fuel_type').all(year);
    const built = await buildWiiQr0439Workbook({
      year,
      chartMonth,
      monthly,
      airLocations,
      elecLocations,
      fuels
    });
    return {
      chartMonth: built.chartMonth,
      data: Buffer.from(built.buffer).toString('base64')
    };
  }

  function mergeEnergyMonth(year, month, values, actor) {
    const insert = db.prepare(`
      INSERT INTO energy_monthly (year, month, electricity_kwh, gas_m3, water_m3, updated_at, updated_by)
      VALUES (?, ?, COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0), datetime('now','localtime'), ?)
      ON CONFLICT(year, month) DO UPDATE SET
        electricity_kwh = COALESCE(excluded.electricity_kwh, energy_monthly.electricity_kwh),
        gas_m3 = COALESCE(excluded.gas_m3, energy_monthly.gas_m3),
        water_m3 = COALESCE(excluded.water_m3, energy_monthly.water_m3),
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `);
    insert.run(
      year,
      month,
      values.electricity_kwh ?? null,
      values.gas_m3 ?? null,
      values.water_m3 ?? null,
      actor || 'anonim'
    );
  }

  function detectWorkbookType(wb) {
    const names = wb.SheetNames.map((s) => s.trim());
    if (names.includes('Monthly') || names.includes('Departments')) return 'generic';
    for (const sheetName of names) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      for (const row of rows.slice(0, 8)) {
        const text = [...Object.keys(row), ...Object.values(row)].join(' ').toLowerCase();
        if (text.includes('electricity consumption statistics')) return 'electricity';
        if (text.includes('energy consumption monthly')) return 'watergas';
      }
    }
    return 'generic';
  }

  function importGenericEnergy(wb, actor, result) {
    const insertMonthly = db.prepare(`
      INSERT INTO energy_monthly (year,month,electricity_kwh,gas_m3,water_m3,note,excluded,updated_at,updated_by)
      VALUES (?,?,?,?,?,?,?,datetime('now','localtime'),?)
      ON CONFLICT(year,month) DO UPDATE SET
        electricity_kwh=excluded.electricity_kwh,
        gas_m3=excluded.gas_m3,
        water_m3=excluded.water_m3,
        note=excluded.note,
        excluded=excluded.excluded,
        updated_at=datetime('now','localtime'),
        updated_by=excluded.updated_by
    `);

    const insertDept = db.prepare(`
      INSERT INTO energy_departments (year,month,department,kwh,share_pct,vs_prev_pct,updated_at,updated_by)
      VALUES (?,?,?,?,?,?,datetime('now','localtime'),?)
      ON CONFLICT(year,month,department) DO UPDATE SET
        kwh=excluded.kwh, share_pct=excluded.share_pct, vs_prev_pct=excluded.vs_prev_pct,
        updated_at=datetime('now','localtime'), updated_by=excluded.updated_by
    `);

    const monthlySheet = wb.Sheets['Monthly'] || wb.Sheets[wb.SheetNames[0]];
    if (monthlySheet) {
      const rows = XLSX.utils.sheet_to_json(monthlySheet, { defval: '' });
      for (let i = 0; i < rows.length; i++) {
        if (isEmptyRow(rows[i])) continue;
        const m = colMap(rows[i], MONTHLY_COLS);
        const year = Number(m.year);
        const month = Number(m.month);
        if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12) {
          result.errors.push(`Monthly baris ${i + 1}: Year/Month tidak valid`);
          continue;
        }
        const electricity_kwh = Number(m.electricity_kwh);
        const gas_m3 = Number(m.gas_m3);
        const water_m3 = Number(m.water_m3);
        if (!Number.isFinite(electricity_kwh) || !Number.isFinite(gas_m3) || !Number.isFinite(water_m3)) {
          result.errors.push(`Monthly baris ${i + 1}: nilai energy harus angka`);
          continue;
        }
        const excluded = m.excluded === 1 || String(m.excluded).toLowerCase() === 'yes' ? 1 : 0;
        insertMonthly.run(
          year,
          month,
          electricity_kwh,
          gas_m3,
          water_m3,
          m.note ? String(m.note) : null,
          excluded,
          actor || 'anonim'
        );
        result.monthly++;
      }
    }

    const deptSheet = wb.Sheets['Departments'];
    if (deptSheet) {
      const rows = XLSX.utils.sheet_to_json(deptSheet, { defval: '' });
      for (let i = 0; i < rows.length; i++) {
        if (isEmptyRow(rows[i])) continue;
        const m = colMap(rows[i], DEPT_COLS);
        const year = Number(m.year);
        const month = Number(m.month);
        if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12) {
          result.errors.push(`Departments baris ${i + 1}: Year/Month tidak valid`);
          continue;
        }
        if (m.department === undefined || String(m.department).trim() === '') {
          result.errors.push(`Departments baris ${i + 1}: Department wajib diisi`);
          continue;
        }
        const kwh = Number(m.kwh);
        if (!Number.isFinite(kwh)) {
          result.errors.push(`Departments baris ${i + 1}: kWh harus angka`);
          continue;
        }
        insertDept.run(
          year,
          month,
          String(m.department).trim(),
          kwh,
          m.share_pct !== undefined ? Number(m.share_pct) : null,
          m.vs_prev_pct !== undefined ? Number(m.vs_prev_pct) : null,
          actor || 'anonim'
        );
        result.departments++;
      }
    }
  }

  function importLegacyElectricity(wb, actor, result) {
    for (const sheetName of wb.SheetNames) {
      const yearMatch = /^(\d{4})$/.exec(sheetName.trim());
      if (!yearMatch) continue;
      const year = Number(yearMatch[1]);
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rows.length < 2) continue;

      const headerRow = rows[0];
      const monthColGroups = {};
      for (const [col, val] of Object.entries(headerRow)) {
        const text = String(val || '');
        const match = /TOTAL\s*[（(]([^）)]+)[）)]/i.exec(text);
        if (!match) continue;
        const month = monthFromName(match[1]);
        if (!month) continue;
        if (!monthColGroups[month]) monthColGroups[month] = [];
        monthColGroups[month].push(col);
      }

      const months = Object.keys(monthColGroups).map(Number).sort((a, b) => a - b);
      for (const month of months) {
        let total = 0;
        let rowCount = 0;
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const values = monthColGroups[month]
            .map((c) => Number(row[c]))
            .filter((v) => Number.isFinite(v) && v > 0);
          if (!values.length) continue;
          total += Math.max(...values);
          rowCount++;
        }
        if (rowCount > 0 && total > 0) {
          mergeEnergyMonth(year, month, { electricity_kwh: total }, actor);
          result.monthly++;
        }
      }
    }
  }

  function sheetNumber(v) {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(/[,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  /* Baris "1/1-1/31" pada sheet tahun. Kolom tetap seperti WII-QR04-39:
     12 = total air, 14 = gas (MMbtu), plus meter per titik (termasuk
     sewage). Angka hasil rumus harian ikut disimpan supaya panel lokasi
     tetap terisi; ekspor menulis ulang E–H dan L sebagai rumus. */
  function importLegacyWaterGas(wb, actor, result) {
    const delLoc = db.prepare("DELETE FROM energy_locations WHERE year=? AND month=? AND source='air'");
    const insLoc = db.prepare(
      `INSERT INTO energy_locations (year,month,source,location,qty,updated_at,updated_by)
       VALUES (?,?, 'air', ?, ?, datetime('now','localtime'), ?)`
    );
    for (const sheetName of wb.SheetNames) {
      const yearMatch = /^(\d{4})$/.exec(sheetName.trim());
      if (!yearMatch) continue;
      const year = Number(yearMatch[1]);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
      for (const row of rows) {
        const label = String(row[0] || '').trim();
        const m = /^(\d{1,2})\/\d{1,2}-\d{1,2}\/\d{1,2}/.exec(label);
        if (!m) continue;
        const month = Number(m[1]);
        if (month < 1 || month > 12) continue;
        const water = sheetNumber(row[12]);
        const gas = sheetNumber(row[14]);
        const meters = WATER_LOCATIONS.map((loc) => ({ name: loc.name, qty: sheetNumber(row[loc.col]) }))
          .filter((loc) => loc.qty !== null);
        if (water === null && gas === null && !meters.length) continue;
        mergeEnergyMonth(
          year,
          month,
          {
            water_m3: water,
            gas_m3: gas
          },
          actor
        );
        result.monthly++;
        delLoc.run(year, month);
        for (const loc of meters) insLoc.run(year, month, loc.name, loc.qty, actor || 'anonim');
      }
    }
  }

  function importEnergyExcel(body, actor) {
    const { file } = body || {};
    if (!file) throw bad('File Excel wajib diunggah');

    let buffer;
    try {
      buffer = Buffer.from(String(file), 'base64');
    } catch {
      throw bad('File tidak valid');
    }
    if (!buffer.length) throw bad('File kosong');

    let wb;
    try {
      wb = XLSX.read(buffer, { type: 'buffer' });
    } catch (err) {
      throw bad('Gagal membaca file Excel: ' + err.message);
    }

    const result = { monthly: 0, departments: 0, errors: [] };
    const type = detectWorkbookType(wb);

    db.exec('BEGIN');
    try {
      if (type === 'electricity') {
        importLegacyElectricity(wb, actor, result);
      } else if (type === 'watergas') {
        importLegacyWaterGas(wb, actor, result);
      } else {
        importGenericEnergy(wb, actor, result);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    logActivity(db, actor, 'import', 'energy_excel', null, `monthly=${result.monthly}, depts=${result.departments}, errors=${result.errors.length}`);
    return result;
  }

  /* ===== Definisi rute ===== */

  const get = {
    '/api/health': () => ({ ok: true, db: 'sqlite', app: 'ISSD', time: new Date().toISOString() }),

    '/api/meta': () => ({
      months: MONTHS.slice(1),
      settings: settings(),
      kpis: kpiMap(),
      itInfra: db.prepare('SELECT * FROM it_infra').all(),
      enums: {
        woStatus: ['Open', 'In Progress', 'Pending', 'Scheduled', 'Approved', 'Closed', 'Cancelled'],
        woPriority: ['Low', 'Medium', 'High', 'Critical'],
        woModule: ['Facility', 'IT', 'Safety', 'GA', 'Energy'],
        ticketStatus: ['Open', 'Assigned', 'Pending', 'Solved', 'Closed', 'Cancelled'],
        ticketCategory: ['net', 'email', 'wifi', 'print', 'vpn', 'slow', 'pw', 'other'],
        bookingStatus: ['Pending Approval', 'Approved', 'Rejected', 'In Use', 'Returned', 'Cancelled'],
        inspectionStatus: ['Pending', 'Progress', 'Closed']
      }
    }),

    '/api/dashboard': () => {
      const rows = activeEnergy();
      const energy = rows.slice(-6);
      const manual = db
        .prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT 8')
        .all()
        .map((a) => ({ ...a, live: 0 }));
      return {
        kpis: kpiMap(),
        settings: settings(),
        energy,
        alerts: [...liveAlerts(), ...manual].slice(0, 10),
        workOrders: db.prepare('SELECT * FROM work_orders ORDER BY id DESC LIMIT 8').all(),
        energyDelta: energyDelta(),
        targets: targetsView(rows)
      };
    },

    /* Versi publik: hanya KPI, grafik energi, dan target vs realisasi.
       Alert internal dan daftar work order sengaja tidak ikut. */
    '/api/public/dashboard': () => ({
      kpis: kpiMap(),
      energy: activeEnergy().slice(-6),
      energyDelta: energyDelta(),
      targets: targetsView(activeEnergy())
    }),

    '/api/captcha': () => newCaptcha(),

    '/api/energy': (url) => {
      const q = url.searchParams;
      const monthly = db.prepare('SELECT * FROM energy_monthly ORDER BY year, month').all();
      const { current, previous } = latestPair();
      const deptRows = db
        .prepare('SELECT * FROM energy_departments ORDER BY year, month, kwh DESC')
        .all();
      const deptMonths = [...new Set(deptRows.map((r) => `${r.year}-${String(r.month).padStart(2, '0')}`))].sort();
      const wanted = q.get('month') || deptMonths.at(-1) || '';
      const [dy, dm] = wanted.split('-').map(Number);
      const departments = deptRows
        .filter((r) => !dy || (r.year === dy && r.month === dm))
        .sort((a, b) => b.kwh - a.kwh);
      return {
        monthly,
        active: monthly.filter((r) => !r.excluded),
        current,
        previous,
        departments,
        deptMonth: dy ? { year: dy, month: dm, label: `${mLabel(dm)} ${dy}` } : null,
        deptMonths,
        settings: settings(),
        delta: energyDelta()
      };
    },

    '/api/safety': () => ({
      inspections: db
        .prepare('SELECT * FROM safety_inspections ORDER BY inspect_date DESC, id DESC')
        .all(),
      kpis: db.prepare('SELECT * FROM safety_kpis').all(),
      jsa: db.prepare('SELECT * FROM jsa_logs ORDER BY id DESC LIMIT 20').all()
    }),

    '/api/ga': () => ({
      stock: db.prepare('SELECT * FROM ga_stock ORDER BY (stock * 1.0 / NULLIF(rop,0)) ASC').all(),
      bookings: db.prepare('SELECT * FROM vehicle_bookings ORDER BY id DESC LIMIT 50').all(),
      kpis: kpiMap()
    }),

    '/api/it': () => ({
      tickets: db.prepare('SELECT * FROM it_tickets ORDER BY id DESC LIMIT 100').all(),
      infra: db.prepare('SELECT * FROM it_infra').all(),
      kpis: kpiMap(),
      settings: settings()
    }),

    '/api/facility': () => ({
      pm: db.prepare('SELECT * FROM facility_pm ORDER BY id').all(),
      workOrders: db
        .prepare("SELECT * FROM work_orders WHERE module='Facility' ORDER BY id DESC LIMIT 30")
        .all(),
      kpis: kpiMap()
    }),

    '/api/work-orders': (url) => {
      const q = url.searchParams;
      const where = [];
      const args = [];
      if (q.get('module')) { where.push('module=?'); args.push(q.get('module')); }
      if (q.get('status')) { where.push('status=?'); args.push(q.get('status')); }
      if (q.get('q')) {
        // Wildcard LIKE di-escape agar % dan _ dari pengguna dicari literal.
        const escLike = q.get('q').replace(/[\\%_]/g, (c) => '\\' + c);
        where.push(
          "(description LIKE ? ESCAPE '\\' OR wo_no LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR reporter LIKE ? ESCAPE '\\')"
        );
        const like = `%${escLike}%`;
        args.push(like, like, like, like);
      }
      const sql = `SELECT * FROM work_orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`;
      return db.prepare(sql).all(...args);
    },

    '/api/it/tickets': () =>
      db.prepare('SELECT * FROM it_tickets ORDER BY id DESC LIMIT 100').all(),

    '/api/ga/bookings': () =>
      db.prepare('SELECT * FROM vehicle_bookings ORDER BY id DESC LIMIT 100').all(),

    '/api/ga/stock': () => db.prepare('SELECT * FROM ga_stock ORDER BY item').all(),

    '/api/energy/monthly': () =>
      db.prepare('SELECT * FROM energy_monthly ORDER BY year, month').all(),

    /* Pemakaian per lokasi/meter + selisih vs bulan sebelumnya (sumber: import
       file real). Parameter ?month=YYYY-MM, default bulan terakhir yang ada. */
    '/api/energy/locations': (url) => {
      const q = url.searchParams;
      const all = db.prepare('SELECT * FROM energy_locations ORDER BY year, month, source, location').all();
      const months = [...new Set(all.map((r) => `${r.year}-${String(r.month).padStart(2, '0')}`))].sort();
      const wanted = q.get('month') || months.at(-1) || '';
      const [y, m] = wanted.split('-').map(Number);
      const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      const prev = new Map(all.filter((r) => `${r.year}-${String(r.month).padStart(2, '0')}` === prevKey).map((r) => [`${r.source}|${r.location}`, r.qty]));
      const locations = all
        .filter((r) => r.year === y && r.month === m)
        .map((r) => {
          const p = prev.get(`${r.source}|${r.location}`);
          return {
            ...r,
            prev_qty: p === undefined ? null : p,
            delta_pct: p ? ((r.qty - p) / p) * 100 : null
          };
        })
        .sort((a, b) => (a.source === b.source ? b.qty - a.qty : a.source.localeCompare(b.source)));
      return { locations, months, month: wanted ? { year: y, month: m, label: `${mLabel(m)} ${y}` } : null };
    },

    '/api/energy/fuels': () =>
      db.prepare('SELECT * FROM energy_fuels ORDER BY year DESC, month DESC, fuel_type').all(),

    /* Generate laporan Excel WII-QR04-39.
       ?year=YYYY (default tahun terakhir). ?month=1-12 memilih bulan
       grafik 全厂用水; kosong = bulan terakhir yang ada datanya. */
    '/api/energy/report-export': async (url) => {
      const q = url.searchParams;
      const avail = db.prepare('SELECT DISTINCT year FROM energy_monthly ORDER BY year').all().map((r) => r.year);
      if (!avail.length) throw bad('Belum ada data energi untuk diekspor');
      const lastAvail = avail.at(-1);
      let year = Number(q.get('year'));
      if (!Number.isInteger(year) || year < 1) year = lastAvail;
      const month = Number(q.get('month'));
      const exported = await generateEnergyReportExport(year, month);
      return {
        filename: `WII-QR04-39_${year}.xlsx`,
        chartMonth: exported.chartMonth,
        data: exported.data
      };
    },

    '/api/energy/departments': (url) => {
      const q = url.searchParams;
      const clauses = [];
      const args = [];
      if (q.get('year')) { clauses.push('year=?'); args.push(Number(q.get('year'))); }
      if (q.get('month')) { clauses.push('month=?'); args.push(Number(q.get('month'))); }
      return db
        .prepare(
          `SELECT * FROM energy_departments ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY year, month, kwh DESC`
        )
        .all(...args);
    },

    '/api/safety/inspections': () =>
      db.prepare('SELECT * FROM safety_inspections ORDER BY inspect_date DESC, id DESC').all(),

    '/api/safety/jsa': () =>
      db.prepare('SELECT * FROM jsa_logs ORDER BY id DESC LIMIT 50').all(),

    '/api/facility/pm': () => db.prepare('SELECT * FROM facility_pm ORDER BY id').all(),

    '/api/alerts': () =>
      db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT 50').all(),

    '/api/settings': () => ({
      settings: db.prepare('SELECT * FROM app_settings').all(),
      kpis: db.prepare('SELECT * FROM site_kpis').all(),
      infra: db.prepare('SELECT * FROM it_infra').all(),
      safetyKpis: db.prepare('SELECT * FROM safety_kpis').all()
    }),

    '/api/activity': (url) => {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 40, 200);
      return db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?').all(limit);
    },

    '/api/ai/logs': () =>
      db.prepare('SELECT * FROM ai_logs ORDER BY id DESC LIMIT 30').all(),

    '/api/ai/sessions': (url) => {
      const sessionId = url.searchParams.get('id');
      if (sessionId) {
        return db.prepare('SELECT * FROM ai_logs WHERE session_id=? ORDER BY id ASC').all(sessionId);
      }
      return db
        .prepare('SELECT session_id, module, COUNT(*) as messages, MAX(created_at) as last_at FROM ai_logs GROUP BY session_id ORDER BY last_at DESC LIMIT 20')
        .all();
    },

    '/api/energy/import-template': () => ({
      filename: 'ISSD_Energy_Import_Template.xlsx',
      data: generateEnergyTemplate()
    }),

    '/api/report': (url) => {
      const q = url.searchParams;
      const rows = activeEnergy();
      const last = rows.at(-1);
      const defTo = last ? `${last.year}-${String(last.month).padStart(2, '0')}` : '2026-01';
      const defFrom = last ? `${last.year}-01` : '2026-01';
      const from = q.get('from') || defFrom;
      const to = q.get('to') || defTo;
      const parse = (v, fb) => {
        const m = /^(\d{4})-(\d{1,2})$/.exec(v || '');
        return m ? Number(m[1]) * 100 + Number(m[2]) : fb;
      };
      const fromKey = parse(from, 0);
      const toKey = parse(to, 999999);
      if (fromKey > toKey) throw bad('Periode awal tidak boleh melewati periode akhir');

      const s = settings();
      const monthly = rows.filter((r) => {
        const k = r.year * 100 + r.month;
        return k >= fromKey && k <= toKey;
      });
      const totals = monthly.reduce(
        (a, r) => ({
          kwh: a.kwh + r.electricity_kwh,
          gas: a.gas + r.gas_m3,
          water: a.water + r.water_m3
        }),
        { kwh: 0, gas: 0, water: 0 }
      );
      totals.biayaListrik = totals.kwh * (s.tarif_listrik || 0);
      totals.biayaGas = totals.gas * (s.harga_gas || 0);
      totals.biayaAir = totals.water * (s.harga_air || 0);
      totals.biaya = totals.biayaListrik + totals.biayaGas + totals.biayaAir;
      totals.co2Ton = (totals.kwh * (s.co2_factor || 0)) / 1000;

      const wo = db
        .prepare('SELECT module, status, COUNT(*) AS n FROM work_orders GROUP BY module, status ORDER BY module, status')
        .all();
      const tickets = db
        .prepare('SELECT status, COUNT(*) AS n FROM it_tickets GROUP BY status')
        .all();
      const insp = db
        .prepare('SELECT status, COUNT(*) AS n FROM safety_inspections GROUP BY status')
        .all();
      const bookings = db
        .prepare('SELECT status, COUNT(*) AS n FROM vehicle_bookings GROUP BY status')
        .all();

      const avg = monthly.length
        ? { kwh: totals.kwh / monthly.length, gas: totals.gas / monthly.length, water: totals.water / monthly.length }
        : null;
      const peak = monthly.length
        ? monthly.reduce((a, r) => (r.electricity_kwh > a.electricity_kwh ? r : a))
        : null;

      return {
        from, to, monthly, totals, avg,
        peak: peak ? { year: peak.year, month: peak.month, label: `${mLabel(peak.month)} ${peak.year}`, kwh: peak.electricity_kwh } : null,
        workOrders: wo, tickets, inspections: insp, bookings,
        generatedAt: new Date().toLocaleString('id-ID')
      };
    }
  };

  /* Target vs realisasi dihitung dari data, bukan angka statis di HTML. */
  function targetsView(rows) {
    const s = settings();
    const k = kpiMap();
    const cur = rows.at(-1);
    const prev = rows.at(-2);
    const label = cur ? `${mLabel(cur.month)} ${cur.year}` : '—';
    const out = [
      { label: 'Zero Incident (Safety)', value: k.zero_incident?.value || '—', color: k.zero_incident?.color || 'green' },
      { label: 'Kepuasan Pengguna', value: k.satisfaction?.value || '—', color: 'blue' },
      { label: `SLA IT ≤ ${s.sla_it || 4} jam`, value: k.sla_it_pct ? `${k.sla_it_pct.value} Tercapai` : '—', color: 'green' },
      { label: 'Preventive Maintenance AC', value: k.pm_month?.value || '—', color: 'green' }
    ];

    if (cur && prev && prev.electricity_kwh) {
      const pct = ((cur.electricity_kwh - prev.electricity_kwh) / prev.electricity_kwh) * 100;
      const target = s.target_hemat_listrik || 5;
      out.unshift({
        label: `Penghematan Energi ≥ ${target}%`,
        value: pct <= -target
          ? `✅ ${Math.abs(pct).toFixed(1)}% (tercapai)`
          : `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% vs ${mLabel(prev.month)}`,
        color: pct <= -target ? 'green' : pct > 0 ? 'orange' : 'blue'
      });
    }
    if (cur && s.target_air) {
      out.push({
        label: `Konsumsi Air ≤ ${fmt(s.target_air)} m³`,
        value: `${fmt(cur.water_m3)} m³ (${cur.water_m3 <= s.target_air ? 'OK' : 'LEWAT'})`,
        color: cur.water_m3 <= s.target_air ? 'green' : 'red'
      });
    }
    if (cur && s.target_gas) {
      out.push({
        label: `Konsumsi Gas ≤ ${fmt(s.target_gas)} MMbtu`,
        value: `${fmt(cur.gas_m3)} MMbtu (${cur.gas_m3 <= s.target_gas ? 'OK' : 'LEWAT'})`,
        color: cur.gas_m3 <= s.target_gas ? 'green' : 'red'
      });
    }
    return { period: label, items: out };
  }

  /* ===== POST ===== */

  async function post(pathname, body, actor) {
    if (pathname === '/api/energy/monthly') {
      need(body, ['year', 'month']);
      const year = norm('year', body.year);
      const month = norm('month', body.month);
      if (month < 1 || month > 12) throw bad('Bulan harus 1–12');
      db.prepare(`
        INSERT INTO energy_monthly (year,month,electricity_kwh,gas_m3,water_m3,note,excluded,updated_at,updated_by)
        VALUES (?,?,?,?,?,?,?,datetime('now','localtime'),?)
        ON CONFLICT(year,month) DO UPDATE SET
          electricity_kwh=excluded.electricity_kwh,
          gas_m3=excluded.gas_m3,
          water_m3=excluded.water_m3,
          note=excluded.note,
          excluded=excluded.excluded,
          updated_at=datetime('now','localtime'),
          updated_by=excluded.updated_by
      `).run(
        year, month,
        norm('electricity_kwh', body.electricity_kwh ?? 0),
        norm('gas_m3', body.gas_m3 ?? 0),
        norm('water_m3', body.water_m3 ?? 0),
        body.note ? norm('note', body.note) : null,
        body.excluded ? 1 : 0,
        actor || 'anonim'
      );
      const row = db.prepare('SELECT * FROM energy_monthly WHERE year=? AND month=?').get(year, month);
      logActivity(db, actor, 'upsert', 'energy_monthly', String(row.id), `${mLabel(month)} ${year}`);
      return row;
    }

    if (pathname === '/api/energy/departments') {
      need(body, ['year', 'month', 'department', 'kwh']);
      const year = norm('year', body.year);
      const month = norm('month', body.month);
      const department = norm('department', body.department);
      db.prepare(`
        INSERT INTO energy_departments (year,month,department,kwh,share_pct,vs_prev_pct,updated_at,updated_by)
        VALUES (?,?,?,?,?,?,datetime('now','localtime'),?)
        ON CONFLICT(year,month,department) DO UPDATE SET
          kwh=excluded.kwh, share_pct=excluded.share_pct, vs_prev_pct=excluded.vs_prev_pct,
          updated_at=datetime('now','localtime'), updated_by=excluded.updated_by
      `).run(
        year, month, department,
        norm('kwh', body.kwh),
        body.share_pct == null ? null : norm('share_pct', body.share_pct),
        body.vs_prev_pct == null ? null : norm('vs_prev_pct', body.vs_prev_pct),
        actor || 'anonim'
      );
      const row = db
        .prepare('SELECT * FROM energy_departments WHERE year=? AND month=? AND department=?')
        .get(year, month, department);
      logActivity(db, actor, 'upsert', 'energy_departments', String(row.id), department);
      return row;
    }

    if (pathname === '/api/energy/import') {
      return importEnergyExcel(body, actor);
    }

    if (pathname === '/api/energy/fuels') {
      need(body, ['year', 'month', 'fuel_type']);
      const month = norm('month', body.month);
      if (month < 1 || month > 12) throw bad('Bulan harus 1–12');
      db.prepare(
        'INSERT INTO energy_fuels (year,month,fuel_type,qty,unit,note,updated_at,updated_by) VALUES (?,?,?,?,?,?,datetime(\'now\',\'localtime\'),?)'
      ).run(
        norm('year', body.year),
        month,
        norm('fuel_type', body.fuel_type),
        norm('qty', body.qty ?? 0),
        body.unit ? norm('unit', body.unit) : 'liter',
        body.note ? norm('note', body.note) : null,
        actor || 'anonim'
      );
      const row = db.prepare('SELECT * FROM energy_fuels WHERE id=last_insert_rowid()').get();
      logActivity(db, actor, 'create', 'energy_fuels', String(row.id), `${row.fuel_type} ${row.qty} ${row.unit}`);
      return row;
    }

    if (pathname === '/api/ga/bookings') {
      need(body, ['borrower', 'use_at', 'purpose']);
      const bookingNo = nextNo(db, 'vehicle_bookings', 'booking_no', 'BK');
      const km = norm('km', body.km ?? 0);
      const price = Number(settings().harga_bbm) || 4800;
      db.prepare(`
        INSERT INTO vehicle_bookings
          (booking_no,borrower,use_at,purpose,vehicle,driver,km,fuel_est,status,updated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(
        bookingNo,
        norm('borrower', body.borrower),
        norm('use_at', body.use_at),
        norm('purpose', body.purpose),
        body.vehicle ? norm('vehicle', body.vehicle) : '',
        body.driver ? norm('driver', body.driver) : '',
        km, km * price,
        validateEnum('vehicle_bookings', 'status', body.status || 'Pending Approval'),
        actor || 'anonim'
      );
      const row = db.prepare('SELECT * FROM vehicle_bookings WHERE booking_no=?').get(bookingNo);
      logActivity(db, actor, 'create', 'vehicle_bookings', bookingNo, row.borrower);
      return row;
    }

    if (pathname === '/api/work-orders') {
      need(body, ['description']);
      const woNo = nextNo(db, 'work_orders', 'wo_no', 'WO');
      const techs = db.prepare("SELECT DISTINCT assigned_to AS t FROM work_orders WHERE assigned_to IS NOT NULL AND assigned_to<>''").all().map((r) => r.t);
      const pool = techs.length ? techs : ['Dody', 'Rahmat', 'Tono'];
      db.prepare(`
        INSERT INTO work_orders (wo_no,module,description,location,reporter,status,priority,assigned_to,updated_by)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        woNo,
        validateEnum('work_orders', 'module', body.module || 'Facility'),
        norm('description', body.description),
        body.location ? norm('location', body.location) : '',
        body.reporter ? norm('reporter', body.reporter) : (actor || ''),
        validateEnum('work_orders', 'status', body.status || 'Open'),
        validateEnum('work_orders', 'priority', body.priority || 'Medium'),
        body.assigned_to ? norm('assigned_to', body.assigned_to) : pool[Math.floor(Math.random() * pool.length)],
        actor || 'anonim'
      );
      const row = db.prepare('SELECT * FROM work_orders WHERE wo_no=?').get(woNo);
      logActivity(db, actor, 'create', 'work_orders', woNo, row.description.slice(0, 80));
      return row;
    }

    if (pathname === '/api/it/tickets') {
      need(body, ['user_name', 'issue']);
      const ticketNo = nextNo(db, 'it_tickets', 'ticket_no', 'T');
      db.prepare(`
        INSERT INTO it_tickets (ticket_no,user_name,issue,host,category,status,priority,updated_by)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(
        ticketNo,
        norm('user_name', body.user_name),
        norm('issue', body.issue),
        body.host ? norm('host', body.host) : '',
        validateEnum('it_tickets', 'category', body.category || 'other'),
        'Open',
        validateEnum('it_tickets', 'priority', body.priority || 'Medium'),
        actor || 'anonim'
      );
      const row = db.prepare('SELECT * FROM it_tickets WHERE ticket_no=?').get(ticketNo);
      logActivity(db, actor, 'create', 'it_tickets', ticketNo, row.issue.slice(0, 80));
      return row;
    }

    if (pathname === '/api/ga/stock') {
      need(body, ['item', 'stock', 'rop']);
      db.prepare(
        'INSERT INTO ga_stock (item,stock,rop,unit,updated_at,updated_by) VALUES (?,?,?,?,datetime(\'now\',\'localtime\'),?)'
      ).run(
        norm('item', body.item),
        norm('stock', body.stock),
        norm('rop', body.rop),
        body.unit ? norm('unit', body.unit) : '',
        actor || 'anonim'
      );
      const row = db.prepare('SELECT * FROM ga_stock WHERE id=last_insert_rowid()').get();
      logActivity(db, actor, 'create', 'ga_stock', String(row.id), row.item);
      return row;
    }

    if (pathname === '/api/safety/inspections') {
      need(body, ['inspect_date', 'area', 'finding', 'status']);
      db.prepare(`
        INSERT INTO safety_inspections (inspect_date,area,finding,status,pic,updated_at,updated_by)
        VALUES (?,?,?,?,?,datetime('now','localtime'),?)
      `).run(
        norm('inspect_date', body.inspect_date),
        norm('area', body.area),
        norm('finding', body.finding),
        validateEnum('safety_inspections', 'status', body.status),
        body.pic ? norm('pic', body.pic) : (actor || ''),
        actor || 'anonim'
      );
      const row = db.prepare('SELECT * FROM safety_inspections WHERE id=last_insert_rowid()').get();
      logActivity(db, actor, 'create', 'safety_inspections', String(row.id), row.area);
      return row;
    }

    if (pathname === '/api/facility/pm') {
      need(body, ['equipment', 'total_units']);
      db.prepare(`
        INSERT INTO facility_pm (equipment,total_units,done,progress,next_schedule,updated_at,updated_by)
        VALUES (?,?,?,?,?,datetime('now','localtime'),?)
      `).run(
        norm('equipment', body.equipment),
        norm('total_units', body.total_units),
        body.done ? norm('done', body.done) : '0',
        body.progress ? norm('progress', body.progress) : '0%',
        body.next_schedule ? norm('next_schedule', body.next_schedule) : '',
        actor || 'anonim'
      );
      const row = db.prepare('SELECT * FROM facility_pm WHERE id=last_insert_rowid()').get();
      logActivity(db, actor, 'create', 'facility_pm', String(row.id), row.equipment);
      return row;
    }

    if (pathname === '/api/alerts') {
      need(body, ['module', 'message', 'severity']);
      db.prepare('INSERT INTO alerts (module,message,extra,severity) VALUES (?,?,?,?)').run(
        norm('module', body.module),
        norm('message', body.message),
        body.extra ? norm('extra', body.extra) : null,
        validateEnum('alerts', 'severity', body.severity)
      );
      const row = db.prepare('SELECT * FROM alerts WHERE id=last_insert_rowid()').get();
      logActivity(db, actor, 'create', 'alerts', String(row.id), row.message);
      return row;
    }

    if (pathname === '/api/safety/jsa') {
      db.prepare(
        'INSERT INTO jsa_logs (job_type,location_desc,workers,tools,result,created_by) VALUES (?,?,?,?,?,?)'
      ).run(
        body.job_type ? norm('job_type', body.job_type) : '',
        body.location_desc ? norm('location_desc', body.location_desc) : '',
        Number(body.workers) || 0,
        body.tools ? norm('tools', body.tools) : '',
        body.result ? norm('result', body.result) : '',
        actor || 'anonim'
      );
      return { ok: true };
    }

    if (pathname === '/api/ai') {
      db.prepare(
        'INSERT INTO ai_logs (module,question,answer,created_by) VALUES (?,?,?,?)'
      ).run(
        body.module ? norm('module', body.module) : 'semua',
        body.question ? norm('question', body.question) : '',
        body.answer ? norm('answer', body.answer) : '',
        actor || 'anonim'
      );
      return { ok: true };
    }

    if (pathname === '/api/ai/ask') {
      need(body, ['module', 'question']);
      const module = body.module || 'semua';
      const question = String(body.question || '').trim();
      if (!question) throw bad('Pertanyaan wajib diisi');
      if (question.length > 2000) throw bad('Pertanyaan terlalu panjang (maks 2000 karakter)');

      const sessionId = body.session_id || crypto.randomUUID();
      const result = await askAi(db, {
        module,
        question,
        model: body.model,
        sessionId
      }, actor);

      db.prepare(
        'INSERT INTO ai_logs (session_id,module,question,answer,model,created_by) VALUES (?,?,?,?,?,?)'
      ).run(
        result.sessionId,
        norm('module', module),
        norm('question', question),
        norm('answer', result.answer),
        norm('model', result.model),
        actor || 'anonim'
      );

      return result;
    }

    throw notFound('Endpoint tidak ditemukan');
  }

  /* ===== PATCH ===== */

  const patchers = [
    [/^\/api\/work-orders\/(\d+)$/, 'work_orders'],
    [/^\/api\/it\/tickets\/(\d+)$/, 'it_tickets'],
    [/^\/api\/ga\/bookings\/(\d+)$/, 'vehicle_bookings'],
    [/^\/api\/ga\/stock\/(\d+)$/, 'ga_stock'],
    [/^\/api\/safety\/inspections\/(\d+)$/, 'safety_inspections'],
    [/^\/api\/facility\/pm\/(\d+)$/, 'facility_pm'],
    [/^\/api\/energy\/monthly\/(\d+)$/, 'energy_monthly'],
    [/^\/api\/energy\/departments\/(\d+)$/, 'energy_departments'],
    [/^\/api\/energy\/locations\/(\d+)$/, 'energy_locations'],
    [/^\/api\/energy\/fuels\/(\d+)$/, 'energy_fuels']
  ];

  const kvPatches = [
    [/^\/api\/settings\/([\w-]+)$/, 'app_settings'],
    [/^\/api\/kpis\/([\w-]+)$/, 'site_kpis'],
    [/^\/api\/safety\/kpis\/([\w-]+)$/, 'safety_kpis'],
    [/^\/api\/it\/infra\/([\w-]+)$/, 'it_infra']
  ];

  function patch(pathname, body, actor) {
    for (const [re, table] of patchers) {
      const m = re.exec(pathname);
      if (!m) continue;
      const id = Number(m[1]);
      if (!Number.isInteger(id)) throw bad('ID tidak valid');
      const before = getRow(table, id);
      const after = patchRow(table, id, body, actor);
      const diff = Object.keys(after)
        .filter((k) => String(before[k] ?? '') !== String(after[k] ?? '') && !['updated_at', 'updated_by'].includes(k))
        .map((k) => `${k}: ${before[k] ?? '-'} → ${after[k] ?? '-'}`)
        .join('; ');
      logActivity(db, actor, 'update', table, String(id), diff.slice(0, 300));
      return after;
    }

    for (const [re, table] of kvPatches) {
      const m = re.exec(pathname);
      if (!m) continue;
      const key = m[1];
      need(body, ['value']);
      const value = String(body.value).trim().slice(0, 200);
      const exists = db.prepare(`SELECT key FROM ${table} WHERE key=?`).get(key);
      if (!exists) throw notFound(`Key "${key}" tidak ada di ${table}`);
      if (table === 'it_infra') {
        db.prepare(
          `UPDATE ${table} SET value=?, severity=?, updated_at=datetime('now','localtime'), updated_by=? WHERE key=?`
        ).run(value, validateEnum('it_infra', 'severity', body.severity || 'info'), actor || 'anonim', key);
      } else {
        const sets = ['value=?'];
        const args = [value];
        if (body.label !== undefined) { sets.push('label=?'); args.push(norm('label', body.label)); }
        if (body.color !== undefined) { sets.push('color=?'); args.push(norm('color', body.color)); }
        if (body.unit !== undefined) { sets.push('unit=?'); args.push(norm('unit', body.unit)); }
        args.push(key);
        db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE key=?`).run(...args);
      }
      const row = db.prepare(`SELECT * FROM ${table} WHERE key=?`).get(key);
      logActivity(db, actor, 'update', table, key, value);
      return row;
    }

    throw notFound('Endpoint tidak ditemukan');
  }

  /* ===== DELETE ===== */

  const deleters = [
    [/^\/api\/work-orders\/(\d+)$/, 'work_orders'],
    [/^\/api\/it\/tickets\/(\d+)$/, 'it_tickets'],
    [/^\/api\/ga\/bookings\/(\d+)$/, 'vehicle_bookings'],
    [/^\/api\/ga\/stock\/(\d+)$/, 'ga_stock'],
    [/^\/api\/safety\/inspections\/(\d+)$/, 'safety_inspections'],
    [/^\/api\/facility\/pm\/(\d+)$/, 'facility_pm'],
    [/^\/api\/energy\/monthly\/(\d+)$/, 'energy_monthly'],
    [/^\/api\/energy\/departments\/(\d+)$/, 'energy_departments'],
    [/^\/api\/energy\/locations\/(\d+)$/, 'energy_locations'],
    [/^\/api\/energy\/fuels\/(\d+)$/, 'energy_fuels'],
    [/^\/api\/alerts\/(\d+)$/, 'alerts'],
    [/^\/api\/safety\/jsa\/(\d+)$/, 'jsa_logs'],
    [/^\/api\/ai\/logs\/(\d+)$/, 'ai_logs']
  ];

  function del(pathname, actor) {
    for (const [re, table] of deleters) {
      const m = re.exec(pathname);
      if (!m) continue;
      const id = Number(m[1]);
      if (!Number.isInteger(id)) throw bad('ID tidak valid');
      if (EDITABLE[table]) return deleteRow(table, id, actor);
      const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
      if (!row) throw notFound();
      db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
      logActivity(db, actor, 'delete', table, String(id), JSON.stringify(row).slice(0, 200));
      return { ok: true, id };
    }
    throw notFound('Endpoint tidak ditemukan');
  }

  return { get, post, patch, del, postPublic: createPublicTicket, ApiError };
}

module.exports = { createApi, ApiError };
