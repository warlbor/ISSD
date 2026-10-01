/* Autentikasi sederhana untuk pemakaian LAN: akun username+password (scrypt)
   dan sesi token yang disimpan di SQLite. Nama pelaku di activity_log akhirnya
   tidak bisa dipalsukan lagi, karena diambil dari sesi yang terverifikasi. */
const crypto = require('crypto');
const { logActivity } = require('./db');

const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari
const MAX_FAILED = 5;                        // percobaan gagal per IP sebelum diblok
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const USERNAME_RE = /^[a-zA-Z0-9._-]{2,40}$/;

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(String(password), salt, 64);
  const expect = Buffer.from(hash, 'hex');
  return calc.length === expect.length && crypto.timingSafeEqual(calc, expect);
}

function createAuth(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      expires_at INTEGER NOT NULL
    );
  `);

  /* Akun admin bawaan hanya dibuat saat tabel users masih kosong (start pertama).
     Password-nya bisa diatur lewat ISSD_ADMIN_PASSWORD sebelum server dijalankan. */
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    db.prepare('INSERT INTO users (username, pass_hash, role) VALUES (?,?,?)').run(
      'admin',
      hashPassword(process.env.ISSD_ADMIN_PASSWORD || 'admin123'),
      'admin'
    );
  }

  /* Pelacak percobaan gagal per IP, hanya di memori (cukup untuk LAN internal). */
  const failedByIp = new Map();

  function recentFails(ip) {
    const now = Date.now();
    const list = (failedByIp.get(ip) || []).filter((t) => now - t < FAIL_WINDOW_MS);
    if (list.length) failedByIp.set(ip, list);
    else failedByIp.delete(ip);
    return list;
  }

  function login({ username, password, ip = 'unknown' }) {
    if (recentFails(ip).length >= MAX_FAILED) {
      throw new AuthError(429, 'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.');
    }
    const user = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || '').trim());
    if (!user || !verifyPassword(password, user.pass_hash)) {
      const list = recentFails(ip);
      list.push(Date.now());
      failedByIp.set(ip, list);
      throw new AuthError(401, 'Username atau password salah');
    }
    failedByIp.delete(ip);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());

    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(
      token,
      user.id,
      Date.now() + SESSION_MS
    );
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  }

  function verify(token) {
    if (!token) return null;
    const row = db
      .prepare(
        `SELECT u.id, u.username, u.role FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?`
      )
      .get(String(token), Date.now());
    return row || null;
  }

  function logout(token) {
    if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(String(token));
    return { ok: true };
  }

  function changePassword(userId, oldPassword, newPassword, currentToken) {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    if (!user) throw new AuthError(404, 'Pengguna tidak ditemukan');
    if (!verifyPassword(oldPassword, user.pass_hash)) {
      throw new AuthError(401, 'Password lama salah');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new AuthError(400, 'Password baru minimal 6 karakter');
    }
    db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword(newPassword), userId);
    // Semua sesi di perangkat lain dicabut; sesi aktif dibiarkan tetap berjalan.
    db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(userId, String(currentToken || ''));
    return { ok: true };
  }

  function listUsers() {
    return db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  }

  function addUser({ username, password, role = 'staff' }) {
    const name = String(username || '').trim();
    if (!USERNAME_RE.test(name)) {
      throw new AuthError(400, 'Username 2–40 karakter, hanya huruf/angka . _ -');
    }
    if (typeof password !== 'string' || password.length < 6) {
      throw new AuthError(400, 'Password minimal 6 karakter');
    }
    if (role !== 'admin' && role !== 'staff') {
      throw new AuthError(400, 'Role harus admin atau staff');
    }
    const exists = db.prepare('SELECT id FROM users WHERE username=?').get(name);
    if (exists) throw new AuthError(409, `Username "${name}" sudah dipakai`);
    db.prepare('INSERT INTO users (username, pass_hash, role) VALUES (?,?,?)').run(
      name,
      hashPassword(password),
      role
    );
    const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE username=?').get(name);
    logActivity(db, name, 'create', 'users', name, `role=${role}`);
    return user;
  }

  function deleteUser(id, meId) {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!user) throw new AuthError(404, 'Pengguna tidak ditemukan');
    if (user.id === meId) throw new AuthError(400, 'Tidak bisa menghapus akun sendiri');
    if (user.role === 'admin' && db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n <= 1) {
      throw new AuthError(400, 'Minimal harus tersisa satu admin');
    }
    db.prepare('DELETE FROM users WHERE id=?').run(id); // sesi ikut terhapus (cascade)
    logActivity(db, user.username, 'delete', 'users', user.username, null);
    return { ok: true, id };
  }

  return { login, verify, logout, changePassword, listUsers, addUser, deleteUser };
}

module.exports = { createAuth, AuthError };
