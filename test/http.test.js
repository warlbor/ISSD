/* Test lapisan HTTP: server sesungguhnya dijalankan sebagai proses terpisah,
   lalu diserang dengan token palsu, header Host cacat, dan role yang salah. */
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'issd-http-'));
const PORT = 3100 + Math.floor(Math.random() * 1800);
const BASE = `http://127.0.0.1:${PORT}`;

const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', ISSD_DB: path.join(tmpDir, 'test.db') },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});
let stderrLog = '';
child.stderr.on('data', (c) => { stderrLog += c; });
child.on('exit', (code) => {
  if (code && code !== 0 && !child._killed) {
    console.error('Server test mati tidak wajar:\n' + stderrLog);
  }
});

function request(method, reqPath, { token, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...headers };
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const req = http.request(
      `${BASE}${reqPath}`,
      { method, headers: h },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let data = null;
          try { data = JSON.parse(raw); } catch { /* bukan JSON */ }
          resolve({ status: res.statusCode, headers: res.headers, data, raw });
        });
      }
    );
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

const ready = (async () => {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('server mati saat start:\n' + stderrLog);
    try {
      const r = await request('GET', '/api/health');
      if (r.status === 200) return true;
    } catch { /* belum siap */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server tidak siap dalam 20 detik:\n' + stderrLog);
})();

test.after(() => {
  return new Promise((resolve) => {
    child._killed = true;
    child.on('close', () => {
      // Tunggu sebentar agar Windows melepaskan lock file SQLite, lalu
      // ulangi bila masih EBUSY.
      const cleanup = () => {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          resolve();
        } catch (err) {
          if (err.code === 'EBUSY') {
            setTimeout(cleanup, 100);
          } else {
            resolve();
          }
        }
      };
      setTimeout(cleanup, 50);
    });
    child.kill();
  });
});

/* Kirim request mentah dengan header Host yang membuat new URL() melempar. */
function rawRequest(raw) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, '127.0.0.1', () => sock.write(raw));
    let out = '';
    sock.on('data', (c) => { out += c; });
    sock.on('close', () => resolve(out));
    sock.on('error', reject);
    setTimeout(() => { sock.destroy(); resolve(out); }, 3000);
  });
}

test('header Host cacat dijawab 400 dan tidak menjatuhkan server', async () => {
  await ready;
  const out = await rawRequest('GET /api/dashboard HTTP/1.1\r\nHost: @@[\r\nConnection: close\r\n\r\n');
  assert.match(out, /HTTP\/1\.[01] 400/, 'harus dijawab 400, bukan memutus koneksi diam-diam');
  const after = await request('GET', '/api/health');
  assert.strictEqual(after.status, 200, 'server harus tetap hidup');
});

test('API tanpa token ditolak 401', async () => {
  await ready;
  const r = await request('GET', '/api/dashboard');
  assert.strictEqual(r.status, 401);
  assert.match(r.data.error, /login/i);
});

test('login berhasil memberi token yang bisa dipakai', async () => {
  await ready;
  const salah = await request('POST', '/api/auth/login', { body: { username: 'admin', password: 'ngasal' } });
  assert.strictEqual(salah.status, 401);

  const ok = await request('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  assert.strictEqual(ok.status, 200);
  assert.match(ok.data.token, /^[a-f0-9]{64}$/);

  const dash = await request('GET', '/api/dashboard', { token: ok.data.token });
  assert.strictEqual(dash.status, 200);
  assert.ok(dash.data.energy);

  const logout = await request('POST', '/api/auth/logout', { token: ok.data.token });
  assert.strictEqual(logout.status, 200);
  const setelah = await request('GET', '/api/dashboard', { token: ok.data.token });
  assert.strictEqual(setelah.status, 401, 'token bekas logout harus ditolak');
});

test('header X-User palsu diabaikan, actor diambil dari sesi', async () => {
  await ready;
  const s = await request('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  const t = s.data.token;

  const wo = await request('POST', '/api/work-orders', {
    token: t,
    headers: { 'X-User': 'orang.palsu' },
    body: { description: 'Uji anti spoofing' }
  });
  assert.strictEqual(wo.status, 200);
  assert.strictEqual(wo.data.updated_by, 'admin', 'updated_by harus dari sesi, bukan X-User');

  const log = await request('GET', '/api/activity?limit=1', { token: t });
  assert.strictEqual(log.data[0].actor, 'admin');

  await request('DELETE', `/api/work-orders/${wo.data.id}`, { token: t });
});

test('staff tidak bisa menghapus data atau mengubah pengaturan', async () => {
  await ready;
  const admin = (await request('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } })).data;
  const buat = await request('POST', '/api/auth/users', {
    token: admin.token,
    body: { username: 'staffqa', password: 'rahasia99', role: 'staff' }
  });
  assert.strictEqual(buat.status, 200);

  const staff = (await request('POST', '/api/auth/login', { body: { username: 'staffqa', password: 'rahasia99' } })).data;

  const del = await request('DELETE', '/api/alerts/1', { token: staff.token });
  assert.strictEqual(del.status, 403);

  const setting = await request('PATCH', '/api/settings/tarif_listrik', {
    token: staff.token,
    body: { value: '9999' }
  });
  assert.strictEqual(setting.status, 403);

  const users = await request('GET', '/api/auth/users', { token: staff.token });
  assert.strictEqual(users.status, 403, 'daftar pengguna hanya untuk admin');

  // Admin boleh keduanya.
  const delAdmin = await request('DELETE', '/api/alerts/1', { token: admin.token });
  assert.strictEqual(delAdmin.status, 200);
  const setAdmin = await request('PATCH', '/api/settings/tarif_listrik', {
    token: admin.token,
    body: { value: '1467' }
  });
  assert.strictEqual(setAdmin.status, 200);
});

test('preflight OPTIONS tidak lagi mengirim header CORS bebas', async () => {
  await ready;
  const r = await request('OPTIONS', '/api/meta');
  assert.strictEqual(r.status, 405);
  assert.strictEqual(r.headers['access-control-allow-origin'], undefined);
});

test('body lebih dari 1 MB dijawab 413 dan server tetap hidup', async () => {
  await ready;
  const s = await request('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  const big = { note: 'x'.repeat(1100 * 1024) };
  const r = await request('POST', '/api/energy/monthly', { token: s.data.token, body: big });
  assert.strictEqual(r.status, 413);
  const after = await request('GET', '/api/health');
  assert.strictEqual(after.status, 200);
});
