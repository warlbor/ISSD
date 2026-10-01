const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../Energy Report/WII-QR04-39_LAPORAN AIR DAN GAS 2026.xlsx'),
  path.join(__dirname, '../Energy Report/电力月报Monthly+Electricity+Report+2026.xlsx')
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log('Not found:', file);
    continue;
  }
  console.log('\n===', path.basename(file), '===');
  const wb = xlsx.readFile(file);
  console.log('Sheets:', wb.SheetNames);
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log(`\nSheet: ${sn} (${data.length} rows x ${data[0]?.length || 0} cols)`);
    // print first 8 rows
    data.slice(0, 8).forEach((row, i) => {
      console.log(`  ${i + 1}: ${JSON.stringify(row.slice(0, 10))}`);
    });
  }
}
