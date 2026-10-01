/* Kunci terjemahan harus lengkap, dan string di HTML harus punya pasangan. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('Indonesian and English catalogs stay in pairs', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '../public/js/i18n.js')).href);
  const { pairs, lists } = mod.i18nCatalog;
  for (const [key, pair] of Object.entries(pairs)) {
    assert.equal(pair.length, 2, key);
    assert.equal(typeof pair[0], 'string', key);
    assert.equal(typeof pair[1], 'string', key);
    assert.ok(pair[0].length > 0 && pair[1].length > 0, key);
  }
  for (const [key, pair] of Object.entries(lists)) {
    assert.equal(pair[0].length, pair[1].length, key);
  }

  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const attr = /data-i18n(?:-html|-placeholder|-title|-aria|-value)?="([^"]+)"/g;
  const missing = [];
  let m;
  while ((m = attr.exec(html))) {
    if (!pairs[m[1]]) missing.push(m[1]);
  }
  assert.deepEqual(missing, []);

  assert.equal(mod.getLang(), 'id');
  assert.equal(mod.t('home.guestTitle'), 'Akses tamu');
  mod.setLang('en');
  assert.equal(mod.t('home.guestTitle'), 'Guest access');
  assert.equal(mod.t('home.reportIt'), 'Report an IT problem');
  assert.equal(mod.tx('Username atau password salah'), 'Username or password is incorrect');
  assert.equal(mod.monthName(5), 'May');
  mod.setLang('id');
  assert.equal(mod.monthName(5), 'Mei');
  assert.equal(mod.tx('Username atau password salah'), 'Username atau password salah');
});
