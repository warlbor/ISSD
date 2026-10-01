const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'issd-auth-'));
process.env.ISSD_DB = path.join(tmpDir, 'test.db');

const { getDb, init } = require('../server/db');
const { createAuth } = require('../server/auth');

const db = getDb();
init(db);
const auth = createAuth(db);

const assertStatus = (status, fn) => {
  try {
    fn();
  } catch (err) {
    assert.strictEqual(err.status, status, `status seharusnya ${status}, dapat ${err.status}: ${err.message}`);
    return err;
  }
  assert.fail(`seharusnya melempar error ${status}`);
};

test.after(() => {
  try { db.close(); } catch { /* sudah tertutup */ }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('admin bawaan dibuat saat database masih kosong', () => {
  const s = auth.login({ username: 'admin', password: 'admin123', ip: '10.0.0.1' });
  assert.match(s.token, /^[a-f0-9]{64}$/);
  assert.strictEqual(s.user.username, 'admin');
  assert.strictEqual(s.user.role, 'admin');
});

test('password salah dan username tak dikenal ditolak dengan pesan generik', () => {
  const a = assertStatus(401, () => auth.login({ username: 'admin', password: 'salah', ip: '10.0.0.2' }));
  const b = assertStatus(401, () => auth.login({ username: 'hacker', password: 'apapun', ip: '10.0.0.2' }));
  assert.strictEqual(a.message, b.message, 'pesan tidak boleh membocorkan ada tidaknya user');
});

test('verify mengembalikan user dari token valid dan null dari token palsu', () => {
  const s = auth.login({ username: 'admin', password: 'admin123', ip: '10.0.0.1' });
  const user = auth.verify(s.token);
  assert.strictEqual(user.username, 'admin');
  assert.strictEqual(auth.verify('bukan-token'), null);
  assert.strictEqual(auth.verify(null), null);
});

test('lima percobaan gagal berturut-turut memblokir IP sementara', () => {
  for (let i = 0; i < 5; i++) {
    assertStatus(401, () => auth.login({ username: 'admin', password: 'ngasal', ip: '10.9.9.9' }));
  }
  assertStatus(429, () => auth.login({ username: 'admin', password: 'admin123', ip: '10.9.9.9' }));
  // IP lain tidak terpengaruh
  const ok = auth.login({ username: 'admin', password: 'admin123', ip: '10.0.0.3' });
  assert.ok(ok.token);
});

test('login sukses menghapus hitungan gagal pada IP tersebut', () => {
  for (let i = 0; i < 4; i++) {
    assertStatus(401, () => auth.login({ username: 'admin', password: 'ngasal', ip: '10.8.8.8' }));
  }
  auth.login({ username: 'admin', password: 'admin123', ip: '10.8.8.8' });
  assertStatus(401, () => auth.login({ username: 'admin', password: 'ngasal', ip: '10.8.8.8' }));
  // masih di bawah 5 karena hitungan sudah direset
  auth.login({ username: 'admin', password: 'admin123', ip: '10.8.8.8' });
});

test('admin bisa menambah pengguna dengan validasi', () => {
  const u = auth.addUser({ username: 'sari', password: 'rahasia99', role: 'staff' });
  assert.strictEqual(u.username, 'sari');
  assert.strictEqual(u.role, 'staff');
  assert.ok(!('pass_hash' in u), 'hash tidak boleh ikut dikembalikan');

  assertStatus(409, () => auth.addUser({ username: 'sari', password: 'lain123', role: 'staff' }));
  assertStatus(400, () => auth.addUser({ username: 'x', password: 'rahasia99' }), 'username terlalu pendek');
  assertStatus(400, () => auth.addUser({ username: 'budi', password: '123' }), 'password terlalu pendek');
  assertStatus(400, () => auth.addUser({ username: 'budi', password: 'rahasia99', role: 'bos' }), 'role tidak valid');
});

test('pengguna baru bisa login dan tercatat sebagai staff', () => {
  const s = auth.login({ username: 'sari', password: 'rahasia99', ip: '10.0.0.4' });
  assert.strictEqual(auth.verify(s.token).role, 'staff');
});

test('hapus pengguna: tidak bisa hapus diri sendiri atau admin terakhir', () => {
  const admin = db.prepare("SELECT id FROM users WHERE username='admin'").get();
  const sari = db.prepare("SELECT id FROM users WHERE username='sari'").get();
  assertStatus(400, () => auth.deleteUser(admin.id, admin.id));
  assertStatus(400, () => auth.deleteUser(admin.id, sari.id), 'admin masih satu-satunya');

  auth.addUser({ username: 'budi', password: 'rahasia77', role: 'admin' });
  // sekarang ada 2 admin, hapus budi boleh
  const budi = db.prepare("SELECT id FROM users WHERE username='budi'").get();
  assert.deepStrictEqual(auth.deleteUser(budi.id, admin.id), { ok: true, id: budi.id });
});

test('menghapus pengguna mencabut sesinya (cascade)', () => {
  const s = auth.login({ username: 'sari', password: 'rahasia99', ip: '10.0.0.5' });
  assert.ok(auth.verify(s.token));
  const sari = db.prepare("SELECT id FROM users WHERE username='sari'").get();
  const admin = db.prepare("SELECT id FROM users WHERE username='admin'").get();
  auth.deleteUser(sari.id, admin.id);
  assert.strictEqual(auth.verify(s.token), null);
});

test('ganti password: verifikasi lama, sesi lain dicabut, sesi aktif tetap', () => {
  auth.addUser({ username: 'rudi', password: 'password1', role: 'staff' });
  const rudi = db.prepare("SELECT id FROM users WHERE username='rudi'").get();

  const diHP = auth.login({ username: 'rudi', password: 'password1', ip: '10.0.0.6' });
  const diKantor = auth.login({ username: 'rudi', password: 'password1', ip: '10.0.0.7' });

  assertStatus(401, () => auth.changePassword(rudi.id, 'salah', 'password2', diKantor.token));
  assertStatus(400, () => auth.changePassword(rudi.id, 'password1', '123', diKantor.token), 'password baru terlalu pendek');

  auth.changePassword(rudi.id, 'password1', 'password2', diKantor.token);
  assert.ok(auth.verify(diKantor.token), 'sesi aktif tetap berjalan');
  assert.strictEqual(auth.verify(diHP.token), null, 'sesi perangkat lain dicabut');
  assertStatus(401, () => auth.login({ username: 'rudi', password: 'password1', ip: '10.0.0.8' }));
  const baru = auth.login({ username: 'rudi', password: 'password2', ip: '10.0.0.8' });
  assert.ok(baru.token);
});

test('logout menghapus sesi tetapi tidak mengganggu pengguna lain', () => {
  const a = auth.login({ username: 'admin', password: 'admin123', ip: '10.0.0.9' });
  const b = auth.login({ username: 'rudi', password: 'password2', ip: '10.0.0.9' });
  auth.logout(a.token);
  assert.strictEqual(auth.verify(a.token), null);
  assert.ok(auth.verify(b.token));
});

test('listUsers tidak membocorkan hash password', () => {
  const users = auth.listUsers();
  assert.ok(users.length >= 1);
  for (const u of users) {
    assert.ok(!('pass_hash' in u));
  }
  assert.ok(users.some((u) => u.username === 'admin'));
});
