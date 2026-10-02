const test = require('node:test');
const assert = require('node:assert');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const { buildWiiQr0439Workbook, buildWaterPie, monthRow } = require('../server/wii-qr04-39');

const JULY_REPORT = {
  year: 2026,
  chartMonth: 7,
  monthly: [
    { year: 2026, month: 1, water_m3: 5278, gas_m3: 5387, electricity_kwh: 0 },
    { year: 2026, month: 7, water_m3: 6665, gas_m3: 7723, electricity_kwh: 0 }
  ],
  airLocations: [
    // Januari — angka form resmi, untuk cek rumus harian.
    ['B', 1, 'Boiler Room (Phase 1)', 585],
    ['C', 1, 'Workshop Production (Phase 1)', 990],
    ['D', 1, 'Secondary Workshop NF (Phase 1)', 5],
    ['I', 1, 'Boiler Room (Phase 2)', 801],
    ['J', 1, 'Workshop Production (Phase 2)', 1896],
    ['K', 1, 'Daily Water Use (Phase 2)', 521],
    // Juli — sumber pie di screenshot.
    ['B', 7, 'Boiler Room (Phase 1)', 525],
    ['C', 7, 'Workshop Production (Phase 1)', 701],
    ['D', 7, 'Secondary Workshop NF (Phase 1)', 4],
    ['I', 7, 'Boiler Room (Phase 2)', 1398],
    ['J', 7, 'Workshop Production (Phase 2)', 2530],
    ['K', 7, 'Daily Water Use (Phase 2)', 479],
    ['N', 7, 'Sewage treatment capacity', 1270]
  ].map(([, month, location, qty]) => ({ year: 2026, month, location, qty })),
  elecLocations: [],
  fuels: []
};

function formula(ws, addr) {
  const cell = ws[addr];
  assert.ok(cell, `sel ${addr} hilang`);
  assert.ok(cell.f, `sel ${addr} harus rumus, dapat ${JSON.stringify(cell)}`);
  return String(cell.f).replace(/^=/, '').replace(/\s+/g, '');
}

async function julyWorkbook() {
  const built = await buildWiiQr0439Workbook(JULY_REPORT);
  const wb = XLSX.read(built.buffer, { type: 'buffer' });
  return { built, wb, ws: wb.Sheets['2026'] };
}

test('sheet 2026 memakai header, merge, dan kode dokumen form WII-QR04-39', async () => {
  const { wb, ws } = await julyWorkbook();
  assert.ok(wb.SheetNames[0] === '2026');
  assert.strictEqual(ws.A1.v, 'WII-QR04-39');
  assert.match(String(ws.A2.v), /能耗月度报表/);
  assert.match(String(ws.A2.v), /Energy Consumption Monthly Report\s+-2026/);
  assert.match(String(ws.A3.v), /水表/);
  assert.match(String(ws.A3.v), /Water meter usage/);
  assert.strictEqual(ws.B4.v, 'PHASE 1');
  assert.strictEqual(ws.I4.v, 'PHASE 2');
  assert.match(String(ws.O3.v), /Gas usage \(MMbtu\)/);
  assert.match(String(ws.A20.v), /Total for the year/);
  const merges = (ws['!merges'] || []).map((m) => XLSX.utils.encode_range(m));
  for (const ref of ['A2:O2', 'B4:H4', 'I4:K4', 'E5:H5', 'N3:N7', 'O3:O7', 'L4:L7', 'M4:M7']) {
    assert.ok(merges.includes(ref), `merge ${ref} hilang`);
  }
});

test('rumus harian, total fase II, dan SUM tahunan mengikuti form 2026', async () => {
  const { ws } = await julyWorkbook();
  assert.strictEqual(formula(ws, 'E8'), '(M8-B8-C8-D8-L8-K8)*0.35');
  assert.strictEqual(formula(ws, 'F8'), '(M8-B8-C8-D8-L8-K8)*0.35');
  assert.strictEqual(formula(ws, 'G8'), '(M8-B8-C8-D8-L8-K8)*0.15');
  assert.strictEqual(formula(ws, 'H8'), '(M8-B8-C8-D8-L8-K8)*0.15');
  assert.strictEqual(formula(ws, 'L8'), 'SUM(I8:J8)');
  assert.ok(!formula(ws, 'L14').includes('K14'), 'total fase II tidak boleh menjumlahkan kolom K');
  assert.strictEqual(formula(ws, 'B20'), 'SUM(B8:B19)');
  assert.strictEqual(formula(ws, 'O20'), 'SUM(O8:O19)');

  // Januari di file resmi: sisa 480 → 168 / 168 / 72 / 72, L = 2697.
  assert.strictEqual(ws.B8.v, 585);
  assert.strictEqual(ws.M8.v, 5278);
  assert.strictEqual(ws.O8.v, 5387);
  assert.strictEqual(ws.L8.v, 2697);
  assert.strictEqual(ws.E8.v, 168);
  assert.strictEqual(ws.F8.v, 168);
  assert.strictEqual(ws.G8.v, 72);
  assert.strictEqual(ws.H8.v, 72);
  assert.strictEqual(ws.E8.t, 'n');
  assert.ok(!ws.E8.v || ws.E8.f, 'E adalah rumus, bukan angka ketik');

  // Bulan tanpa meter tidak diisi angka palsu.
  assert.strictEqual(ws.B9, undefined);
  assert.strictEqual(ws.M9, undefined);
  assert.strictEqual(ws.N8, undefined);
  assert.strictEqual(ws.N14.v, 1270);
});

test('pie 3D bulan terpilih memakai rantai alokasi form, bukan jumlah lain', async () => {
  const { built, ws } = await julyWorkbook();
  const r = monthRow(7);
  assert.strictEqual(r, 14);
  assert.strictEqual(built.chartMonth, 7);
  assert.strictEqual(formula(ws, 'C26'), 'M14');
  assert.strictEqual(formula(ws, 'E29'), 'ROUND(C14+D14+J14,0)');
  assert.strictEqual(formula(ws, 'F29'), 'ROUND(B14+I14,0)');
  assert.strictEqual(formula(ws, 'G29'), 'ROUND(K14,0)');
  assert.strictEqual(formula(ws, 'H29'), 'ROUND(E14+F14,0)');
  assert.strictEqual(formula(ws, 'I29'), 'ROUND(G14,0)');
  assert.strictEqual(formula(ws, 'J29'), 'ROUND(H14,0)');
  assert.strictEqual(formula(ws, 'K29'), 'SUM(E29:J29)');
  assert.strictEqual(formula(ws, 'L29'), 'C26-K29');
  assert.strictEqual(formula(ws, 'E30'), 'E29/$K$29');
  assert.strictEqual(formula(ws, 'J30'), 'J29/$K$29');
  assert.strictEqual(formula(ws, 'E31'), 'E30*$L$29');
  assert.strictEqual(formula(ws, 'E32'), 'E31+E29');
  assert.strictEqual(formula(ws, 'E27'), 'ROUND(E32,0)');
  assert.strictEqual(formula(ws, 'J27'), 'ROUND(J32,0)');

  // Kategori resmi Juli sebelum gross-up manual: 3235, 1923, 479, 720, 154, 154.
  assert.strictEqual(ws.E29.v, 3235);
  assert.strictEqual(ws.F29.v, 1923);
  assert.strictEqual(ws.G29.v, 479);
  assert.strictEqual(ws.H29.v, 720);
  assert.strictEqual(ws.I29.v, 154);
  assert.strictEqual(ws.J29.v, 154);
  assert.strictEqual(ws.K29.v, 6665);
  assert.strictEqual(ws.C26.v, 6665);
  assert.strictEqual(ws.L29.v, 0);
  assert.ok(Math.abs(ws.E30.v - 3235 / 6665) < 1e-12);
  assert.strictEqual(ws.E27.v, 3235);
  assert.deepStrictEqual(
    ['E26', 'F26', 'G26', 'H26', 'I26', 'J26'].map((a) => ws[a].v),
    ['生产', '锅炉', '二期其他用水', '一期其他用水', '技术', '品管']
  );

  const zip = await JSZip.loadAsync(built.buffer);
  const chart = await zip.file('xl/charts/chart1.xml').async('string');
  assert.match(chart, /pie3DChart/);
  assert.match(chart, /7月份全厂用水/);
  assert.match(chart, /'2026'!\$E\$26:\$J\$26/);
  assert.match(chart, /'2026'!\$E\$27:\$J\$27/);
  assert.match(chart, /<c:v>3235<\/c:v>/);
  const drawing = await zip.file('xl/drawings/drawing1.xml').async('string');
  assert.match(drawing, /graphicFrame/);
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet, /<drawing /);
  const types = await zip.file('[Content_Types].xml').async('string');
  assert.match(types, /chart\+xml/);

  const web = buildWaterPie(JULY_REPORT);
  assert.strictEqual(web.chartMonth, 7);
  assert.strictEqual(web.title, '7月份全厂用水');
  assert.strictEqual(web.total, 6665);
  assert.strictEqual(web.empty, false);
  assert.deepStrictEqual(
    web.slices.map((s) => s.value),
    [ws.E27.v, ws.F27.v, ws.G27.v, ws.H27.v, ws.I27.v, ws.J27.v]
  );
  assert.deepStrictEqual(web.slices.map((s) => s.value), [3235, 1923, 479, 720, 154, 154]);
  assert.deepStrictEqual(web.slices.map((s) => s.label), ['生产', '锅炉', '二期其他用水', '一期其他用水', '技术', '品管']);
  assert.deepStrictEqual(web.slices.map((s) => s.key), ['production', 'boiler', 'otherPhase2', 'otherPhase1', 'technology', 'quality']);
  assert.ok(Math.abs(web.slices.reduce((sum, s) => sum + s.percent, 0) - 1) < 1e-12);
});

test('bulan tanpa meter tidak meminjam irisan bulan lain', () => {
  const empty = buildWaterPie({ ...JULY_REPORT, month: 3 });
  assert.strictEqual(empty.chartMonth, 3);
  assert.strictEqual(empty.empty, true);
  assert.strictEqual(empty.total, 0);
  assert.ok(empty.slices.every((s) => s.value === 0));
});
