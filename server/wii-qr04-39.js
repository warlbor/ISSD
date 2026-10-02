/* Laporan Excel WII-QR04-39 (sheet tahun, format 2026).

   Pemetaan data ISSD → kolom form resmi. Sel kosong tetap kosong
   (bukan teks "N/A"). Kolom yang di form resmi berupa rumus tidak
   diisi angka tersimpan — rumusnya yang ditulis, supaya Excel
   menghitung ulang seperti file sumber.

   Input (nilai dari energy_locations / energy_monthly):
     B  Boiler Room (Phase 1)
     C  Workshop Production (Phase 1)
     D  Secondary Workshop NF (Phase 1)
     I  Boiler Room (Phase 2)
     J  Workshop Production (Phase 2)
     K  Daily Water Use (Phase 2)
     M  energy_monthly.water_m3   总表用水量
     N  Sewage treatment capacity (hanya bila ada di energy_locations)
     O  energy_monthly.gas_m3     燃气使用量 (MMbtu)

   Rumus form 2026 (bukan model 2025 yang sempat beda rasio / tanpa K):
     L{r} = SUM(I{r}:J{r})
            Fase II total = boiler + workshop fase 2.
            Kolom K (生活用水 fase 2) tidak masuk; di file 2026
            setiap bulan L = I+J.
     E{r} = (M{r}-B{r}-C{r}-D{r}-L{r}-K{r})*0.35   office 5D
     F{r} = (M{r}-B{r}-C{r}-D{r}-L{r}-K{r})*0.35   office 5D1
     G{r} = (M{r}-B{r}-C{r}-D{r}-L{r}-K{r})*0.15   Technology Center
     H{r} = (M{r}-B{r}-C{r}-D{r}-L{r}-K{r})*0.15   QC lab
     {col}20 = SUM({col}8:{col}19)                Jan–Des

   Blok pie bulan yang dipilih (baris sama dengan template):
     C26 = M{r}                         jangkar kuning = 总表 bulan itu.
            Di file contoh Juli, C26 diketik manual (7183) di atas
            total meter. Angka itu tidak ada di skema ISSD, jadi
            jangkar mengikuti 总表用水量. Rantai alokasi di bawah
            tetap rumus yang sama: mengubah C26 tetap menggeser
            irisan seperti di form resmi.
     E29 = ROUND(C{r}+D{r}+J{r},0)      生产
     F29 = ROUND(B{r}+I{r},0)           锅炉
     G29 = ROUND(K{r},0)                二期其他用水
     H29 = ROUND(E{r}+F{r},0)           一期其他用水
     I29 = ROUND(G{r},0)                技术
     J29 = ROUND(H{r},0)                品管
     K29 = SUM(E29:J29)
     L29 = C26-K29
     E30 = E29/$K$29   (dan F–J)        % kuning
     E31 = E30*$L$29   (dan F–J)        jatah selisih
     E32 = E31+E29     (dan F–J)        nilai setelah alokasi
     E27 = ROUND(E32,0) (dan F–J)       sumber pie 3D
*/

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

const CHART_TEMPLATE = fs.readFileSync(path.join(__dirname, 'templates', 'wii-chart.xml'), 'utf8');
const DRAWING_TEMPLATE = fs.readFileSync(path.join(__dirname, 'templates', 'wii-drawing.xml'), 'utf8');

const WATER_LOCATIONS = [
  { col: 1, name: 'Boiler Room (Phase 1)', input: 'B' },
  { col: 2, name: 'Workshop Production (Phase 1)', input: 'C' },
  { col: 3, name: 'Secondary Workshop NF (Phase 1)', input: 'D' },
  { col: 4, name: 'Daily Water Use - 5D' },
  { col: 5, name: 'Office 5D1' },
  { col: 6, name: 'Technology Center' },
  { col: 7, name: 'Quality Control Lab' },
  { col: 8, name: 'Boiler Room (Phase 2)', input: 'I' },
  { col: 9, name: 'Workshop Production (Phase 2)', input: 'J' },
  { col: 10, name: 'Daily Water Use (Phase 2)', input: 'K' },
  { col: 13, name: 'Sewage treatment capacity', input: 'N' }
];

const PIE_CATEGORIES = [
  { col: 'E', label: '生产', source: (r) => `ROUND(C${r}+D${r}+J${r},0)` },
  { col: 'F', label: '锅炉', source: (r) => `ROUND(B${r}+I${r},0)` },
  { col: 'G', label: '二期其他用水', source: (r) => `ROUND(K${r},0)` },
  { col: 'H', label: '一期其他用水', source: (r) => `ROUND(E${r}+F${r},0)` },
  { col: 'I', label: '技术', source: (r) => `ROUND(G${r},0)` },
  { col: 'J', label: '品管', source: (r) => `ROUND(H${r},0)` }
];

const MONTH_LABELS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const thin = { style: 'thin', color: { argb: 'FF000000' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const gray = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
const yellow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const center = { horizontal: 'center', vertical: 'middle' };
const centerWrap = { horizontal: 'center', vertical: 'middle', wrapText: true };
const fontTitle = { name: 'Calibri', size: 20, bold: true };
const fontSection = { name: 'Microsoft YaHei', size: 12, bold: true };
const fontHeader = { name: 'Microsoft YaHei', size: 9, bold: true };
const fontData = { name: 'Microsoft YaHei', size: 10, bold: true };
const fontTotal = { name: 'Calibri', size: 11, bold: true };
const fontPie = { name: 'Microsoft YaHei', size: 10, bold: true };

function monthRow(month) {
  return 7 + month;
}

function periodLabel(year, month) {
  const last = new Date(year, month, 0).getDate();
  return `${month}/1-${month}/${last}`;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function z(v) {
  return v === null || v === undefined ? 0 : Number(v);
}

/* Cermin rumus Excel, hanya untuk nilai cache supaya grafik dan
   pembuka yang tidak menghitung ulang tetap menampilkan angka. */
function previewMonth(input) {
  const B = z(input.B);
  const C = z(input.C);
  const D = z(input.D);
  const I = z(input.I);
  const J = z(input.J);
  const K = z(input.K);
  const M = z(input.M);
  const N = z(input.N);
  const O = z(input.O);
  const L = I + J;
  const remain = M - B - C - D - L - K;
  return {
    B, C, D, I, J, K, M, N, O, L,
    E: remain * 0.35,
    F: remain * 0.35,
    G: remain * 0.15,
    H: remain * 0.15
  };
}

function previewPie(monthValues, c26) {
  const cats = [
    Math.round(monthValues.C + monthValues.D + monthValues.J),
    Math.round(monthValues.B + monthValues.I),
    Math.round(monthValues.K),
    Math.round(monthValues.E + monthValues.F),
    Math.round(monthValues.G),
    Math.round(monthValues.H)
  ];
  const sum = cats.reduce((a, b) => a + b, 0);
  const diff = c26 - sum;
  const pct = cats.map((v) => (sum === 0 ? null : v / sum));
  const alloc = pct.map((p) => (p === null ? null : p * diff));
  const gross = cats.map((v, i) => (alloc[i] === null ? null : v + alloc[i]));
  const chart = gross.map((v) => (v === null ? 0 : Math.round(v)));
  return { cats, sum, diff, pct, alloc, gross, chart };
}

function paint(cell, opts) {
  if (opts.font) cell.font = opts.font;
  if (opts.alignment) cell.alignment = opts.alignment;
  if (opts.border) cell.border = opts.border;
  if (opts.fill) cell.fill = opts.fill;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

function eachCell(ws, r1, r2, c1, c2, fn) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) fn(ws.getCell(r, c), r, c);
  }
}

function putFormula(cell, formula, result, opts) {
  const value = result === undefined || result === null ? { formula } : { formula, result };
  cell.value = value;
  paint(cell, opts);
}

function buildSheet(wb, payload) {
  const year = payload.year;
  const chartMonth = payload.chartMonth;
  const sheetName = String(year);
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true, zoomScale: 110, state: 'normal' }],
    pageSetup: { paperSize: 9, orientation: 'landscape', scale: 88, fitToPage: false },
    properties: { defaultRowHeight: 15 }
  });

  ws.getColumn(1).width = 16;
  for (let c = 2; c <= 8; c++) ws.getColumn(c).width = 12;
  for (let c = 9; c <= 12; c++) ws.getColumn(c).width = 14;
  ws.getColumn(13).width = 14;
  ws.getColumn(14).width = 14;
  ws.getColumn(15).width = 14;
  for (let c = 16; c <= 19; c++) ws.getColumn(c).width = 12;

  const heights = { 1: 18, 2: 53, 3: 36, 4: 36, 5: 20, 6: 32, 7: 60, 20: 48, 26: 32 };
  for (const [r, h] of Object.entries(heights)) ws.getRow(Number(r)).height = h;
  for (let r = 8; r <= 19; r++) ws.getRow(r).height = 16;

  const merges = [
    'A2:O2', 'A3:M3', 'B4:H4', 'I4:K4', 'E5:H5',
    'A4:A5', 'A6:A7',
    'B5:B7', 'C5:C7', 'D5:D7',
    'E6:E7', 'F6:F7', 'G6:G7', 'H6:H7',
    'I5:I7', 'J5:J7', 'K5:K7',
    'L4:L7', 'M4:M7', 'N3:N7', 'O3:O7',
    'A21:N21'
  ];
  for (const ref of merges) ws.mergeCells(ref);

  ws.getCell('A1').value = 'WII-QR04-39';
  paint(ws.getCell('A1'), { font: { name: 'Calibri', size: 11, bold: true } });

  ws.getCell('A2').value = `能耗月度报表\n Energy Consumption Monthly Report  -${year}`;
  eachCell(ws, 2, 2, 1, 15, (cell) => paint(cell, {
    font: fontTitle, alignment: centerWrap, border: { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
  }));

  ws.getCell('A3').value = '水表\nWater meter usage';
  eachCell(ws, 3, 3, 1, 13, (cell) => paint(cell, { font: fontSection, alignment: centerWrap, border }));

  ws.getCell('A4').value = '项目\nProject';
  paint(ws.getCell('A4'), {
    font: fontHeader,
    alignment: { horizontal: 'right', vertical: 'middle', wrapText: true },
    border: { ...border, diagonal: { style: 'thin', color: { argb: 'FF000000' }, down: true } }
  });
  paint(ws.getCell('A5'), { border });
  ws.getCell('A6').value = '日期\nDate';
  paint(ws.getCell('A6'), {
    font: fontHeader,
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    border
  });
  paint(ws.getCell('A7'), { border });

  ws.getCell('B4').value = 'PHASE 1';
  ws.getCell('I4').value = 'PHASE 2';
  eachCell(ws, 4, 4, 2, 11, (cell) => paint(cell, { font: fontSection, alignment: centerWrap, border }));

  const headers = {
    B5: '锅炉房  Boiler Room\n(m3)\nPHASE 1',
    C5: '薄片车间 Workshop Production (m3)\nPHASE 1',
    D5: '副车间\nSecondary\nWorkshop NF\n(m3)\nPHASE 1',
    E5: '生活用水 Daily Water Use (m3)',
    E6: '办公生活用水-5D\noffice 5D usage',
    F6: '办公生活用水-5D1\noffice 5D1\nusage',
    G6: '技术中心  Technology Center\nusage',
    H6: '品管实验室 Quality Control Laboratory\nusage',
    I5: '锅炉房  Boiler Room\n(m3)\nPHASE 2',
    J5: '薄片车间 Workshop Production (m3)\nPHASE 2',
    K5: '二期生活用水 Daily Water Use\n（m3)\nPHASE 2',
    L4: '二期总表用水\nPhase II total water consumption\n(m3)',
    M4: '总表用水量 Total water consumption (m3)',
    N3: '污水处理量\nSewage treatment capacity\n（m3)',
    O3: '燃气使用量\nGas usage (MMbtu)'
  };
  for (const [addr, text] of Object.entries(headers)) ws.getCell(addr).value = text;

  eachCell(ws, 5, 7, 2, 4, (cell) => paint(cell, { font: fontHeader, alignment: centerWrap, border, fill: gray }));
  eachCell(ws, 5, 7, 5, 8, (cell) => paint(cell, { font: fontHeader, alignment: centerWrap, border }));
  eachCell(ws, 5, 7, 9, 11, (cell) => paint(cell, { font: fontHeader, alignment: centerWrap, border, fill: gray }));
  eachCell(ws, 4, 7, 12, 13, (cell) => paint(cell, { font: fontHeader, alignment: centerWrap, border, fill: gray }));
  eachCell(ws, 3, 7, 14, 15, (cell) => paint(cell, { font: fontHeader, alignment: centerWrap, border, fill: gray }));

  const byMonth = payload.byMonth || {};
  const previews = [];
  for (let m = 1; m <= 12; m++) {
    const r = monthRow(m);
    const input = byMonth[m] || {};
    const preview = previewMonth(input);
    previews[m] = preview;
    ws.getCell(r, 1).value = periodLabel(year, m);
    paint(ws.getCell(r, 1), { font: fontData, alignment: center, border });

    for (const col of ['B', 'C', 'D', 'I', 'J', 'K', 'M', 'N', 'O']) {
      const cell = ws.getCell(`${col}${r}`);
      const value = numOrNull(input[col]);
      if (value !== null) cell.value = value;
      paint(cell, { font: fontData, alignment: center, border, numFmt: '#,##0.##' });
    }

    putFormula(ws.getCell(`L${r}`), `SUM(I${r}:J${r})`, preview.L, {
      font: fontData, alignment: center, border, numFmt: '#,##0.##;-#,##0.##;'
    });
    const split = `(M${r}-B${r}-C${r}-D${r}-L${r}-K${r})`;
    putFormula(ws.getCell(`E${r}`), `${split}*0.35`, preview.E, {
      font: fontData, alignment: center, border, numFmt: '#,##0.##'
    });
    putFormula(ws.getCell(`F${r}`), `${split}*0.35`, preview.F, {
      font: fontData, alignment: center, border, numFmt: '#,##0.##'
    });
    putFormula(ws.getCell(`G${r}`), `${split}*0.15`, preview.G, {
      font: fontData, alignment: center, border, numFmt: '#,##0.##'
    });
    putFormula(ws.getCell(`H${r}`), `${split}*0.15`, preview.H, {
      font: fontData, alignment: center, border, numFmt: '#,##0.##'
    });
  }

  ws.getCell('A20').value = '全年合计    Total for the year';
  paint(ws.getCell('A20'), { font: fontTotal, alignment: centerWrap, border });
  const totalCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
  for (const col of totalCols) {
    let result = 0;
    for (let m = 1; m <= 12; m++) result += z(previews[m][col]);
    putFormula(ws.getCell(`${col}20`), `SUM(${col}8:${col}19)`, result, {
      font: fontTotal, alignment: center, border, numFmt: '#,##0.##'
    });
  }

  eachCell(ws, 21, 21, 1, 14, (cell) => paint(cell, { border: { top: thin } }));

  const src = monthRow(chartMonth);
  const chartPreview = previews[chartMonth] || previewMonth({});
  const c26 = chartPreview.M;
  const pie = previewPie(chartPreview, c26);

  putFormula(ws.getCell('C26'), `M${src}`, c26, {
    font: { name: 'Calibri', size: 14, bold: true },
    alignment: center,
    fill: yellow,
    numFmt: '#,##0.##'
  });

  PIE_CATEGORIES.forEach((cat, idx) => {
    const head = ws.getCell(`${cat.col}26`);
    head.value = cat.label;
    paint(head, { font: fontPie, alignment: centerWrap, border });

    putFormula(ws.getCell(`${cat.col}29`), cat.source(src), pie.cats[idx], {
      font: fontPie, alignment: center, border, fill: yellow, numFmt: '#,##0'
    });
    const pctFormula = `${cat.col}29/$K$29`;
    putFormula(ws.getCell(`${cat.col}30`), pctFormula, pie.pct[idx], {
      font: fontPie, alignment: center, border, fill: yellow, numFmt: '0.00%'
    });
    const allocFormula = `${cat.col}30*$L$29`;
    putFormula(ws.getCell(`${cat.col}31`), allocFormula, pie.alloc[idx], {
      font: fontData, alignment: center, numFmt: '#,##0.##'
    });
    const grossFormula = `${cat.col}31+${cat.col}29`;
    putFormula(ws.getCell(`${cat.col}32`), grossFormula, pie.gross[idx], {
      font: fontData, alignment: center, numFmt: '#,##0.##'
    });
    putFormula(ws.getCell(`${cat.col}27`), `ROUND(${cat.col}32,0)`, pie.chart[idx], {
      font: fontPie, alignment: center, border, numFmt: '#,##0'
    });
  });

  putFormula(ws.getCell('K29'), 'SUM(E29:J29)', pie.sum, {
    font: fontData, alignment: center, numFmt: '#,##0'
  });
  putFormula(ws.getCell('L29'), 'C26-K29', pie.diff, {
    font: fontData, alignment: center, numFmt: '#,##0.##'
  });

  ws.getCell('A26').value = `${chartMonth}月份全厂用水`;
  paint(ws.getCell('A26'), { font: fontPie, alignment: { horizontal: 'left', vertical: 'middle' } });

  return { sheetName, pie, chartMonth };
}

function addElectricitySheet(wb, year, monthly, elecLocations) {
  const ws = wb.addWorksheet(`Listrik ${year}`);
  const months = [...new Set((elecLocations || []).map((r) => r.month))].sort((a, b) => a - b);
  const byLoc = {};
  for (const r of elecLocations || []) {
    byLoc[r.location] = byLoc[r.location] || { department: r.department, months: {} };
    byLoc[r.location].months[r.month] = { qty: r.qty, loss: r.loss };
  }
  const head1 = ['No', 'Department', 'Location'];
  const head2 = ['', '', ''];
  for (const m of months) {
    head1.push(`${MONTH_LABELS[m] || m} ${year}`, '', '');
    head2.push('kWh', '%', 'loss');
  }
  ws.addRow(head1);
  ws.addRow(head2);
  Object.entries(byLoc).forEach(([location, v], i) => {
    const line = [i + 1, v.department || '', location];
    for (const m of months) {
      const d = v.months[m];
      const monthQty = (elecLocations || []).filter((x) => x.month === m).reduce((a, x) => a + Number(x.qty || 0), 0);
      const lossVal = d && d.loss !== null && d.loss !== undefined ? Math.round(d.loss * 100) / 100 : '';
      line.push(
        d ? Math.round(d.qty * 100) / 100 : '',
        d && d.qty && monthQty ? Math.round((d.qty / monthQty) * 1000) / 10 : '',
        lossVal
      );
    }
    ws.addRow(line);
  });
  const totalLine = ['TOTAL', '', ''];
  for (const m of months) {
    const row = (monthly || []).find((r) => r.month === m);
    totalLine.push(Math.round(row?.electricity_kwh || 0), '100%', '');
  }
  const total = ws.addRow(totalLine);
  total.font = { bold: true };
  ws.getRow(1).font = { bold: true };
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 28;
}

function addFuelSheet(wb, fuels) {
  const ws = wb.addWorksheet('BBM');
  ws.addRow(['Year', 'Month', 'Fuel Type', 'Qty', 'Unit', 'Note']).font = { bold: true };
  for (const f of fuels || []) {
    ws.addRow([f.year, f.month, f.fuel_type, f.qty, f.unit || '', f.note || '']);
  }
  ws.getColumn(3).width = 18;
  ws.getColumn(6).width = 24;
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* Grafik dan garis header disalin dari form resmi (sheet 2026) supaya
   Excel dan LibreOffice menggambar pie 3D yang sama. Angka cache dan
   judul bulan diganti; rumus sumber tetap $E$26:$J$27. */
function chartXml(sheetName, title, values) {
  const quoted = `'${String(sheetName).replace(/'/g, "''")}'`;
  let xml = CHART_TEMPLATE.replace(/'2026'!/g, `${quoted}!`);
  xml = xml.replace(
    /<a:r><a:rPr lang="en-US" altLang="zh-CN"\/><a:t>7<\/a:t><\/a:r><a:r><a:rPr lang="zh-CN" altLang="en-US"\/><a:t>月份全厂用水<\/a:t><\/a:r>/,
    `<a:r><a:rPr lang="zh-CN" altLang="en-US"/><a:t>${xmlEscape(title)}</a:t></a:r>`
  );
  let i = 0;
  xml = xml.replace(/<c:numCache>[\s\S]*?<\/c:numCache>/, (block) => block.replace(/<c:v>[^<]*<\/c:v>/g, () => {
    const v = values[i++];
    return `<c:v>${Number.isFinite(v) ? v : 0}</c:v>`;
  }));
  return xml;
}

function sheetFileForName(workbookXml, relsXml, sheetName) {
  const sheetRe = new RegExp(`<sheet[^>]*name="${sheetName}"[^>]*r:id="([^"]+)"|<sheet[^>]*r:id="([^"]+)"[^>]*name="${sheetName}"`);
  const m = sheetRe.exec(workbookXml);
  if (!m) throw new Error(`Sheet ${sheetName} tidak ada di workbook`);
  const rid = m[1] || m[2];
  const relRe = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"|<Relationship[^>]*Target="([^"]+)"[^>]*Id="${rid}"`);
  const rel = relRe.exec(relsXml);
  if (!rel) throw new Error(`Relasi sheet ${rid} tidak ada`);
  const target = rel[1] || rel[2];
  const file = target.replace(/^\//, '').replace(/^\.\.\//, '');
  return file.startsWith('xl/') ? file : `xl/${file}`;
}

async function injectPieChart(buffer, { sheetName, title, values }) {
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const sheetPath = sheetFileForName(workbookXml, relsXml, sheetName);
  let sheetXml = await zip.file(sheetPath).async('string');
  if (!sheetXml.includes('xmlns:r=')) {
    sheetXml = sheetXml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
  }

  const relPath = sheetPath.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels';
  let relXml = zip.file(relPath) ? await zip.file(relPath).async('string') : '';
  let drawingId = 'rId1';
  if (!relXml) {
    relXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;
  } else if (!relXml.includes('/drawing')) {
    const ids = [...relXml.matchAll(/Id="rId(\d+)"/g)].map((x) => Number(x[1]));
    const next = (ids.length ? Math.max(...ids) : 0) + 1;
    drawingId = `rId${next}`;
    relXml = relXml.replace(
      '</Relationships>',
      `<Relationship Id="${drawingId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`
    );
  } else {
    const existing = /Id="(rId\d+)"[^>]*Type="[^"]*\/drawing"/.exec(relXml)
      || /Type="[^"]*\/drawing"[^>]*Id="(rId\d+)"/.exec(relXml);
    drawingId = existing ? existing[1] : 'rId1';
  }

  if (!/<drawing\b/.test(sheetXml)) {
    sheetXml = sheetXml.replace('</worksheet>', `<drawing r:id="${drawingId}"/></worksheet>`);
  }

  zip.file(sheetPath, sheetXml);
  zip.file(relPath, relXml);
  zip.file('xl/charts/chart1.xml', chartXml(sheetName, title, values));
  zip.file('xl/drawings/drawing1.xml', DRAWING_TEMPLATE);
  zip.file('xl/drawings/_rels/drawing1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`);

  let types = await zip.file('[Content_Types].xml').async('string');
  if (!types.includes('/xl/charts/chart1.xml')) {
    types = types.replace(
      '</Types>',
      '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>'
    );
  }
  if (!types.includes('/xl/drawings/drawing1.xml')) {
    types = types.replace(
      '</Types>',
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>'
    );
  }
  zip.file('[Content_Types].xml', types);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function indexLocations(rows) {
  const byMonth = {};
  for (const row of rows || []) {
    const bucket = byMonth[row.month] || (byMonth[row.month] = {});
    bucket[row.location] = row.qty;
  }
  return byMonth;
}

function monthInputs(year, monthly, airByMonth) {
  const byMonth = {};
  for (let m = 1; m <= 12; m++) {
    const row = (monthly || []).find((r) => r.year === year && r.month === m);
    const locs = airByMonth[m] || {};
    const input = {};
    let hasMeter = false;
    for (const loc of WATER_LOCATIONS) {
      if (!loc.input) continue;
      if (!Object.prototype.hasOwnProperty.call(locs, loc.name)) continue;
      const n = numOrNull(locs[loc.name]);
      if (n === null) continue;
      input[loc.input] = n;
      hasMeter = true;
    }
    const water = row ? numOrNull(row.water_m3) : null;
    const gas = row ? numOrNull(row.gas_m3) : null;
    const reportable = hasMeter || (water !== null && water !== 0) || (gas !== null && gas !== 0);
    if (!reportable) {
      byMonth[m] = {};
      continue;
    }
    if (water !== null) input.M = water;
    if (gas !== null) input.O = gas;
    byMonth[m] = input;
  }
  return byMonth;
}

function chooseChartMonth(requested, byMonth) {
  const n = Number(requested);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  for (let m = 12; m >= 1; m--) {
    const input = byMonth[m] || {};
    if (Object.keys(input).length) return m;
  }
  return 1;
}

async function buildWiiQr0439Workbook(payload) {
  const year = Number(payload.year);
  const airByMonth = indexLocations(payload.airLocations);
  const byMonth = monthInputs(year, payload.monthly, airByMonth);
  const chartMonth = chooseChartMonth(payload.chartMonth, byMonth);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISSD';
  wb.calcProperties.fullCalcOnLoad = true;
  wb.views = [{ activeTab: 0, firstSheet: 0 }];

  const built = buildSheet(wb, { year, chartMonth, byMonth });
  addElectricitySheet(wb, year, (payload.monthly || []).filter((r) => r.year === year), payload.elecLocations);
  addFuelSheet(wb, payload.fuels);

  const raw = await wb.xlsx.writeBuffer();
  const buffer = await injectPieChart(Buffer.from(raw), {
    sheetName: built.sheetName,
    title: `${chartMonth}月份全厂用水`,
    values: built.pie.chart
  });
  return { buffer, chartMonth, sheetName: built.sheetName };
}

module.exports = {
  WATER_LOCATIONS,
  PIE_CATEGORIES,
  buildWiiQr0439Workbook,
  chooseChartMonth,
  monthRow,
  previewMonth,
  previewPie
};
