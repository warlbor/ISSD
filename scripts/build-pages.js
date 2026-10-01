/* Menulis index.html untuk GitHub Pages dan snapshot data agar
   https://warlbor.github.io/ISSD/ menampilkan dashboard, bukan localhost. */
const fs = require('fs');
const path = require('path');
const { getDb, init } = require('../server/db');
const { createApi } = require('../server/api');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const baseScript =
  '<script>document.write(\'<base href="\' + location.pathname.replace(/[^/]*$/, "") + \'public/">\');</script>';
let html = src.replace('<head>', '<head>\n  ' + baseScript);
html = html.replace('href="/css/styles.css"', 'href="css/styles.css"');
html = html.replace('src="/js/app.js"', 'src="js/app.js"');
html = html.replace('href="/favicon.ico"', 'href="favicon.ico"');
html = html.replace('href="/favicon.svg"', 'href="favicon.svg"');
fs.writeFileSync(path.join(root, 'index.html'), html);

const db = getDb();
init(db);
const api = createApi(db);
const paths = [
  '/api/dashboard',
  '/api/public/dashboard',
  '/api/energy',
  '/api/energy/locations',
  '/api/energy/fuels',
  '/api/safety',
  '/api/ga',
  '/api/it',
  '/api/facility',
  '/api/settings',
  '/api/meta',
  '/api/report?from=2026-01&to=2026-12',
  '/api/ai/logs'
];
const snap = {};
for (const p of paths) {
  const url = new URL('http://127.0.0.1' + p);
  const handler = api.get[url.pathname];
  if (!handler) {
    console.error('missing handler', p);
    continue;
  }
  const data = handler(url);
  snap[p] = data && typeof data.then === 'function' ? null : data;
}
fs.writeFileSync(path.join(root, 'public', 'snapshot.json'), JSON.stringify(snap));
console.log('pages index + snapshot', Object.keys(snap).join(', '));
