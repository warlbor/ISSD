const xlsx = require('xlsx');
const path = require('path');

const files = [
  'Energy Report/电力月报Monthly+Electricity+Report+2026.xlsx',
  'Energy Report/WII-QR04-39_LAPORAN AIR DAN GAS 2026.xlsx',
];

for (const f of files) {
  console.log('\n' + '='.repeat(80));
  console.log('FILE:', f);
  console.log('='.repeat(80));
  const wb = xlsx.readFile(path.resolve(__dirname, '..', f), { cellDates: true });
  console.log('Sheets:', wb.SheetNames);
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws['!ref'];
    console.log(`\n--- Sheet: ${name} (ref=${ref}) ---`);
    const merges = ws['!merges'] || [];
    console.log('Merges:', merges.length);
    if (merges.length) console.log('First 10 merges:', JSON.stringify(merges.slice(0, 10)));
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null });
    console.log('Total rows:', rows.length);
    // show first 12 rows
    for (let i = 0; i < Math.min(12, rows.length); i++) {
      console.log(`R${i}:`, JSON.stringify(rows[i]));
    }
  }
}