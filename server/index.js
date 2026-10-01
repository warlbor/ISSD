const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config();
const { getDb, init, dbPath, backupDb } = require('./db');
const { createApi } = require('./api');
const { createAuth } = require('./auth');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, '..', 'public');
const MAX_BODY = 1024 * 1024;
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // backup berkala tiap 6 jam

const db = getDb();
init(db);
const auth = createAuth(db);
const api = createApi(db);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (c) => {
      size += c.length;
      // Berhenti menampung saat lewat batas; sisa body dibiarkan terkuras
      // supaya respons 413 sempat terkirim, koneksi tidak perlu di-destroy.
      if (size > MAX_BODY) {
        tooBig = true;
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) {
        return reject(Object.assign(new Error('Ukuran data terlalu besar (maks 1 MB)'), { status: 413 }));
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Body harus berupa objek JSON');
        }
        resolve(parsed);
      } catch (err) {
        reject(Object.assign(new Error('JSON tidak valid'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function bearerToken(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? m[1].trim() : null;
}

function serveStatic(req, res) {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  const abs = path.resolve(PUBLIC, rel);
  if (abs !== PUBLIC && !abs.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(abs, (err, stat) => {
    if (err || !stat.isFile()) {
      const status = err && err.code === 'ENOENT' ? 404 : 403;
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(status === 404 ? 'Tidak ditemukan' : 'Akses ditolak');
    }

    const headers = {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': stat.size
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      return res.end();
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(abs);
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  });
}

/* Endpoint yang boleh diakses tanpa login.
   /api/public/* hanya mengembalikan ringkasan; /api/it/tickets/public dibatasi
   rate limit + captcha agar tamu tidak bisa membanjiri database tiket. */
const PUBLIC_API = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/public/dashboard',
  '/api/captcha',
  '/api/it/tickets/public'
]);

/* Endpoint pengaturan (tarif/target/KPI/infra) hanya untuk admin. */
const ADMIN_PATCH_PREFIXES = ['/api/settings/', '/api/kpis/', '/api/safety/kpis/', '/api/it/infra/'];

async function handleAuthRoutes(req, res, method, pathname, user, token) {
  if (pathname === '/api/auth/logout') {
    if (method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan' });
    return json(res, 200, auth.logout(token));
  }
  if (pathname === '/api/auth/me') {
    if (method !== 'GET') return json(res, 405, { error: 'Method tidak diizinkan' });
    return json(res, 200, user);
  }
  if (pathname === '/api/auth/password') {
    if (method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan' });
    const body = await readBody(req);
    return json(res, 200, auth.changePassword(user.id, body.old_password, body.new_password, token));
  }
  if (pathname === '/api/auth/users' || /^\/api\/auth\/users\/\d+$/.test(pathname)) {
    if (user.role !== 'admin') {
      return json(res, 403, { error: 'Hanya admin yang boleh mengelola pengguna' });
    }
    if (pathname === '/api/auth/users' && method === 'GET') {
      return json(res, 200, auth.listUsers());
    }
    if (pathname === '/api/auth/users' && method === 'POST') {
      const body = await readBody(req);
      return json(res, 200, auth.addUser(body));
    }
    const m = /^\/api\/auth\/users\/(\d+)$/.exec(pathname);
    if (m && method === 'DELETE') {
      return json(res, 200, auth.deleteUser(Number(m[1]), user.id));
    }
    return json(res, 405, { error: 'Method tidak diizinkan' });
  }
  return null; // bukan rute auth
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    // Header Host yang cacat tidak boleh menjatuhkan server.
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return json(res, 400, { error: 'Permintaan tidak valid' });
  }

  // Preflight OPTIONS tidak boleh dilewati autentikasi atau dikirim dengan
  // header CORS bebas; perlakukan sebagai method yang tidak diizinkan.
  if (req.method === 'OPTIONS') {
    return json(res, 405, { error: 'Method tidak diizinkan' });
  }

  const isApi = url.pathname.startsWith('/api/');

  try {
    if (!isApi) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        return res.end('Method Not Allowed');
      }
      return serveStatic(req, res);
    }

    if (url.pathname === '/api/auth/login') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan' });
      const body = await readBody(req);
      return json(res, 200, auth.login({ ...body, ip: req.socket.remoteAddress }));
    }

    if (!PUBLIC_API.has(url.pathname)) {
      const token = bearerToken(req);
      const user = auth.verify(token);
      if (!user) return json(res, 401, { error: 'Sesi tidak valid atau sudah berakhir. Silakan login.' });

      const authRoute = await handleAuthRoutes(req, res, req.method, url.pathname, user, token);
      if (authRoute !== null) return authRoute;

      const actor = user.username;

      // Hapus data dan pengubahan pengaturan adalah aksi admin.
      if (req.method === 'DELETE') {
        if (user.role !== 'admin') {
          return json(res, 403, { error: 'Menghapus data hanya untuk admin' });
        }
        return json(res, 200, api.del(url.pathname, actor));
      }
      if (req.method === 'PATCH' && ADMIN_PATCH_PREFIXES.some((p) => url.pathname.startsWith(p)) && user.role !== 'admin') {
        return json(res, 403, { error: 'Mengubah pengaturan hanya untuk admin' });
      }
      if (req.method === 'GET') {
        const handler = api.get[url.pathname];
        if (!handler) return json(res, 404, { error: 'Endpoint tidak ditemukan' });
        return json(res, 200, handler(url));
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        return json(res, 200, await api.post(url.pathname, body, actor));
      }
      if (req.method === 'PATCH') {
        const body = await readBody(req);
        return json(res, 200, api.patch(url.pathname, body, actor));
      }
      return json(res, 405, { error: 'Method tidak diizinkan' });
    }

    if (PUBLIC_API.has(url.pathname)) {
      // GET publik dijawab langsung dari registry; static file tidak ikut ke sini.
      if (req.method === 'GET') {
        const handler = api.get[url.pathname];
        if (!handler) return json(res, 404, { error: 'Endpoint tidak ditemukan' });
        return json(res, 200, handler(url));
      }

      if (url.pathname === '/api/it/tickets/public') {
        if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan' });
        const body = await readBody(req);
        return json(res, 200, api.postPublic(body, req.socket.remoteAddress || 'unknown'));
      }

      return json(res, 405, { error: 'Method tidak diizinkan' });
    }

    if (req.method === 'GET') {
      const handler = api.get[url.pathname];
      if (!handler) return json(res, 404, { error: 'Endpoint tidak ditemukan' });
      return json(res, 200, handler(url));
    }
    return json(res, 405, { error: 'Method tidak diizinkan' });
  } catch (err) {
    const status = err.status || 400;
    if (status >= 500) console.error(`[ISSD] ${req.method} ${url ? url.pathname : req.url}`, err);
    else if (status === 401 || status === 429) {
      console.warn(`[ISSD] ${status} pada ${req.method} ${url ? url.pathname : req.url} dari ${req.socket.remoteAddress}`);
    }
    json(res, status, { error: err.message || 'Terjadi kesalahan' });
  }
});

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) out.push(`${name}: http://${info.address}:${PORT}`);
    }
  }
  return out;
}

server.listen(PORT, HOST, () => {
  const backupPath = backupDb(db);
  console.log(`ISSD berjalan di http://localhost:${PORT}`);
  for (const line of lanAddresses()) console.log(`  jaringan lokal → ${line}`);
  console.log(`Database: ${dbPath}`);
  if (backupPath) console.log(`Backup otomatis: ${backupPath}`);
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (users <= 1) {
    console.log('Login pertama: username "admin", password default "admin123" (ganti di menu Pengaturan).');
  }
});

/* Backup berkala selain saat start, misal untuk server yang berjalan berhari-hari. */
setInterval(() => {
  const p = backupDb(db);
  if (p) console.log(`[ISSD] Backup berkala: ${p}`);
}, BACKUP_INTERVAL_MS).unref();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => {
      try { db.close(); } catch { /* sudah tertutup */ }
      process.exit(0);
    });
  });
}
