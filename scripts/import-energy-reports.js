/* Import data real dari folder "Energy Report" ke database ISSD.
   Sumber:
   - 电力月报Monthly+Electricity+Report+2026.xlsx  → sheet "2025"/"2026":
     pembacaan meter listrik KUMULATIF per lokasi (62 meter), kolom tanggal
     dd.mm.yyyy. Delta antar pembacaan = kWh periode antar tanggal.
   - WII-QR04-39_LAPORAN AIR DAN GAS 2026.xlsx → sheet "2025"/"2026":
     baris = periode bulanan ("1/1-1/31"); kolom 12 = total air (m3),
     kolom 14 = gas (MMbtu).

   Pemakaian:
     node scripts/import-energy-reports.js            # dry-run (tanpa menulis)
     node scripts/import-energy-reports.js --apply    # tulis ke database

   Aturan aman:
   - energy_monthly: upsert per (year,month); hanya kolom yang bersumber dari
     file yang ditulis (listrik / air+gas). `excluded` & `note` tidak diubah.
   - energy_departments: baris (year,month) yang diimpor dihapus lalu dimasukkan
     ulang supaya tidak dobel.
   - Delta listrik dilewati bila jeda antar pembacaan > 40 hari (mis. baseline
     tahunan) karena bukan konsumsi satu bulan. */

const xlsx = require('xlsx');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const APPLY = process.argv.includes('--apply');
const ROOT = path.join(__dirname, '..');
const FILES = {
  elec: path.join(ROOT, 'Energy Report', '电力月报Monthly+Electricity+Report+2026.xlsx'),
  watergas: path.join(ROOT, 'Energy Report', 'WII-QR04-39_LAPORAN AIR DAN GAS 2026.xlsx')
};
const DB_PATH = path.join(ROOT, 'data', 'issd.db');

/* Nama departemen pendek (dipakai di DB & tampilan; nama panjang di file
   sumber dipetakan ke sini). */
const DEPTS = ['Site Service', 'Production', 'Supply Chain', 'Quality', 'Technology'];

function mapDept(raw) {
  const s = String(raw || '');
  if (/Site Service|公共事务/i.test(s)) return 'Site Service';
  if (/Production|生产/i.test(s)) return 'Production';
  if (/Supply Chain|供应链/i.test(s)) return 'Supply Chain';
  if (/Quality|质量/i.test(s)) return 'Quality';
  if (/Technology|技术/i.test(s)) return 'Technology';
  return null;
}

/* "31.12.2025" → {d,m,y}; null bila tidak ada tanggal di awal teks.
   Teks setelah tanggal (mis. "电表读数") diabaikan. */
function parseDotDate(v) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(String(v).trim());
  if (!m) return null;
  return { d: +m[1], m: +m[2], y: +m[3] };
}
function daysBetween(a, b) {
  const ta = Date.UTC(a.y, a.m - 1, a.d);
  const tb = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((tb - ta) / 86400000);
}
const num = (v) => {
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
};

/* ============ LISTRIK: delta antar kolom pembacaan kumulatif ============

   Struktur kolom per bulan (terlihat dari baris meter): [delta mentah, 比例 %,
   损耗 loss]. Total resmi laporan = delta mentah + alokasi loss trafo. Kolom
   loss = kolom delta + 2 (dicek lewat header 损耗). Angka resmi bulanan juga
   tersimpan di baris rekap "(KWH tunas perbulan N)" — dipakai untuk validasi. */

function parseElectricity(file) {
  const wb = xlsx.readFile(file);
  const out = { monthly: {}, dept: {}, locations: {}, official: {}, months: new Set() };

  for (const sheetName of ['2025', '2026']) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const header = rows[1] || [];

    // Kolom pembacaan = header bertanggal dd.mm.yyyy.
    const dateCols = [];
    header.forEach((h, i) => {
      const d = parseDotDate(h);
      if (d) dateCols.push({ col: i, date: d });
    });
    // Kolom alokasi loss trafo = header 損耗, urut = urutan bulan delta.
    const lossCols = [];
    header.forEach((h, i) => {
      if (/损耗/.test(String(h))) lossCols.push(i);
    });
    if (!dateCols.length) {
      console.log(`  [listrik ${sheetName}] tidak ada kolom tanggal, dilewati`);
      continue;
    }

    // Baris rekap resmi "(KWH tunas perbulan N)" → total resmi bulan N.
    for (const row of rows) {
      const m = /^\(KWH tunas perbulan (\d{1,2})\)/i.exec(String(row[0] || ''));
      const v = m ? num(row[2]) : null;
      if (m && v !== null) out.official[`${sheetName}-${m[1]}`] = v;
    }

    for (const row of rows) {
      const no = Number(row[0]);
      if (!Number.isInteger(no) || no < 1) continue; // baris meter (1..62)
      const dept = mapDept(row[2] || row[1]);
      if (!dept) continue;

      for (let k = 1; k < dateCols.length; k++) {
        const prev = dateCols[k - 1];
        const cur = dateCols[k];
        const gap = daysBetween(prev.date, cur.date);
        if (gap <= 0 || gap > 40) continue; // baseline tahunan bukan konsumsi bulanan
        const r0 = num(row[prev.col]);
        const r1 = num(row[cur.col]);
        if (r0 === null || r1 === null || r1 < r0) continue; // meter belum dipasang/kosong
        // Delta bulan m memakai alokasi loss kolom 損耗 ke-m (blok Jan..Des).
        // Konsumsi dialokasikan ke bulan tanggal pembacaan terakhir.
        const y = cur.date.y;
        const m = cur.date.m;
        const lossCol = lossCols[m - 1];
        const loss = lossCol !== undefined ? num(row[lossCol]) : null;
        // Total resmi laporan = delta mentah + alokasi loss trafo
        // (loss bisa negatif — realokasi antar meter).
        const delta = r1 - r0 + (loss !== null ? loss : 0);
        out.monthly[y] = out.monthly[y] || {};
        out.monthly[y][m] = (out.monthly[y][m] || 0) + delta;
        out.dept[`${y}-${m}`] = out.dept[`${y}-${m}`] || {};
        const key = dept; // mapDept sudah mengembalikan nama kanonik
        out.dept[`${y}-${m}`][key] = (out.dept[`${y}-${m}`][key] || 0) + delta;
        out.months.add(`${y}-${String(m).padStart(2, '0')}`);
        // Per lokasi/meter: label = area + nama lokasi (bahasa Inggris sesuai file sumber).
        const locLabel = [row[3], row[6] || row[5] || row[4]]
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .join(' · ') || `Meter ${no}`;
        const lk = `${y}-${m}`;
        out.locations[lk] = out.locations[lk] || {};
        const prevLoc = out.locations[lk][locLabel];
        out.locations[lk][locLabel] = {
          department: key,
          qty: (prevLoc ? prevLoc.qty : 0) + delta,
          loss: (prevLoc ? prevLoc.loss : 0) + (loss !== null ? loss : 0)
        };
      }
    }
    console.log(`  [listrik ${sheetName}] ${dateCols.length} tanggal pembacaan, ${out.months.size} bulan terkumpul`);
  }
  return out;
}

/* ============ AIR & GAS: baris periode bulanan ============ */

/* Kolom lokasi air tetap (struktur file WII-QR04-39 stabil). Kolom 11 = total
   Phase 2, 12 = total seluruh site, 13 = sewage, 14 = gas (MMbtu). */
const WATER_LOC_COLS = [
  { col: 1, name: 'Boiler Room (Phase 1)' },
  { col: 2, name: 'Workshop Production (Phase 1)' },
  { col: 3, name: 'Secondary Workshop NF (Phase 1)' },
  { col: 4, name: 'Daily Water Use - 5D' },
  { col: 5, name: 'Office 5D1' },
  { col: 6, name: 'Technology Center' },
  { col: 7, name: 'Quality Control Lab' },
  { col: 8, name: 'Boiler Room (Phase 2)' },
  { col: 9, name: 'Workshop Production (Phase 2)' },
  { col: 10, name: 'Daily Water Use (Phase 2)' }
];

function parseWaterGas(file) {
  const wb = xlsx.readFile(file);
  const out = [];
  const locations = {};
  let totalsRowCheck = [];

  for (const sheetName of ['2025', '2026']) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    for (const row of rows) {
      const label = String(row[0] || '').trim();
      const m = /^(\d{1,2})\/\d{1,2}-\d{1,2}\/\d{1,2}$/.exec(label);
      if (!m) {
        if (/Total for the year/i.test(label)) totalsRowCheck.push({ sheet: sheetName, water: num(row[12]), gas: num(row[14]) });
        continue;
      }
      const month = +m[1];
      const year = sheetName === '2025' ? 2025 : 2026;
      const water = num(row[12]); // 总表用水量 Total water consumption (m3)
      const gas = num(row[14]);   // 燃气使用量 Gas usage (MMbtu)
      if (water === null && gas === null) continue; // bulan belum ada datanya
      out.push({ year, month, water, gas });
      // Pemakaian air per lokasi/meter.
      const lk = `${year}-${month}`;
      locations[lk] = locations[lk] || {};
      for (const { col, name } of WATER_LOC_COLS) {
        const v = num(row[col]);
        if (v === null) continue;
        locations[lk][name] = { department: null, qty: v, loss: null };
      }
    }
  }
  return { rows: out, locations, totalsRowCheck };
}

/* ============ Tulis ke SQLite ============ */
function upsertMonthly(db, year, month, fields) {
  const sets = Object.entries(fields).map(([k]) => `${k}=excluded.${k}`).join(', ');
  const cols = ['year', 'month', ...Object.keys(fields)];
  const vals = [year, month, ...Object.values(fields)];
  db.prepare(
    `INSERT INTO energy_monthly (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
     ON CONFLICT(year,month) DO UPDATE SET ${sets}, updated_at=datetime('now','localtime')`
  ).run(...vals);
}

function main() {
  const db = new DatabaseSync(DB_PATH);
  console.log(`Mode: ${APPLY ? 'APPLY (menulis ke DB)' : 'DRY-RUN (tanpa menulis; tambahkan --apply untuk menulis)'}\n`);

  /* ---- Listrik ---- */
  console.log('== Listrik (电力月报) ==');
  const elec = parseElectricity(FILES.elec);
  for (const y of Object.keys(elec.monthly).map(Number).sort()) {
    for (const m of Object.keys(elec.monthly[y]).map(Number).sort((a, b) => a - b)) {
      const kwh = Math.round(elec.monthly[y][m]);
      const depts = elec.dept[`${y}-${m}`] || {};
      const official = elec.official[`${y}-${m}`];
      const officialTxt = official !== undefined
        ? ` | resmi file: ${Math.round(official).toLocaleString('id-ID')} ${Math.abs(kwh - official) < 1 ? '✓' : '✗ (selisih ' + Math.round(kwh - official).toLocaleString('id-ID') + ')'}`
        : '';
      console.log(`  ${m}/${y}: ${kwh.toLocaleString('id-ID')} kWh${officialTxt} | per dept: ` +
        DEPTS.map((d) => `${d} ${Math.round(depts[d] || 0).toLocaleString('id-ID')}`).join(' · '));
      if (APPLY) {
        upsertMonthly(db, y, m, { electricity_kwh: kwh });
        // Departemen: ganti baris (year,month) dengan hasil parsing.
        db.prepare('DELETE FROM energy_departments WHERE year=? AND month=?').run(y, m);
        let prevKwh = null;
        for (const canon of DEPTS) {
          const k = Math.round(depts[canon] || 0);
          const prev = db.prepare(
            'SELECT kwh FROM energy_departments WHERE year=? AND month=? AND department=?'
          ).get(y, m === 1 ? 12 : m - 1, canon); // bulan sebelumnya (lintas tahun sederhana)
          prevKwh = prev ? prev.kwh : null;
          const share = kwh ? (k / kwh) * 100 : 0;
          const vsPrev = prevKwh ? ((k - prevKwh) / prevKwh) * 100 : null;
          db.prepare(
            'INSERT INTO energy_departments (year,month,department,kwh,share_pct,vs_prev_pct) VALUES (?,?,?,?,?,?)'
          ).run(y, m, canon, k, Number(share.toFixed(1)), vsPrev === null ? null : Number(vsPrev.toFixed(1)));
        }
      }
    }
  }

  /* ---- Tulis energy_locations (listrik per meter + air per lokasi) ---- */
  const wg = parseWaterGas(FILES.watergas);
  const locRows = [];
  for (const [k, locs] of Object.entries(elec.locations)) {
    const [y, m] = k.split('-').map(Number);
    for (const [location, v] of Object.entries(locs)) {
      locRows.push({ year: y, month: m, source: 'listrik', location, department: v.department, qty: v.qty, loss: v.loss });
    }
  }
  for (const [k, locs] of Object.entries(wg.locations || {})) {
    const [y, m] = k.split('-').map(Number);
    for (const [location, v] of Object.entries(locs)) {
      locRows.push({ year: y, month: m, source: 'air', location, department: v.department, qty: v.qty, loss: v.loss });
    }
  }
  console.log(`\n== Lokasi/meter == ${locRows.length} baris (${locRows.filter((r) => r.source === 'listrik').length} listrik, ${locRows.filter((r) => r.source === 'air').length} air)`);
  if (APPLY) {
    // Importer bisa jalan sebelum server dibuat: pastikan tabelnya ada.
    db.exec(`CREATE TABLE IF NOT EXISTS energy_locations (
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
    )`);
    db.prepare('DELETE FROM energy_locations').run(); // sumber kebenaran = file, tulis ulang penuh
    const ins = db.prepare(
      'INSERT INTO energy_locations (year,month,source,location,department,qty,loss) VALUES (?,?,?,?,?,?,?)'
    );
    for (const r of locRows) ins.run(r.year, r.month, r.source, r.location, r.department, r.qty, r.loss);
    console.log(`  energy_locations ditulis ulang: ${locRows.length} baris.`);
  }

  /* ---- Air & Gas ---- */
  console.log('\n== Air & Gas (WII-QR04-39) ==');
  for (const r of wg.rows) {
    console.log(`  ${r.month}/${r.year}: air ${r.water ?? '—'} m³ | gas ${r.gas ?? '—'} MMbtu`);
    if (APPLY) {
      const fields = {};
      if (r.water !== null) fields.water_m3 = r.water;
      if (r.gas !== null) fields.gas_m3 = r.gas;
      upsertMonthly(db, r.year, r.month, fields);
    }
  }

  /* ---- Validasi: total tahunan vs baris "Total for the year" ---- */
  console.log('\n== Validasi total tahunan (hitungan parser vs baris Total for the year) ==');
  for (const chk of wg.totalsRowCheck) {
    const sumW = wg.rows.filter((r) => r.year === +chk.sheet).reduce((a, r) => a + (r.water || 0), 0);
    const sumG = wg.rows.filter((r) => r.year === +chk.sheet).reduce((a, r) => a + (r.gas || 0), 0);
    console.log(`  ${chk.sheet}: air ${Math.round(sumW).toLocaleString('id-ID')} vs ${Math.round(chk.water || 0).toLocaleString('id-ID')} | gas ${Math.round(sumG).toLocaleString('id-ID')} vs ${Math.round(chk.gas || 0).toLocaleString('id-ID')}`);
  }

  if (APPLY) {
    const n = db.prepare('SELECT COUNT(*) AS n FROM energy_monthly').get().n;
    console.log(`\nSelesai. energy_monthly kini ${n} baris.`);
  } else {
    console.log('\nDry-run selesai — tidak ada yang ditulis. Jalankan ulang dengan --apply untuk menulis.');
  }
  db.close();
}

main();
