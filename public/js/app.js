/* Entry point aplikasi. Tiap halaman di-load saat pertama kali diakses.
   Sebelum login, seluruh aplikasi tertutup gerbang login. */
import { api, meta, currentUser, token } from './api.js';
import { $, $$, toastErr } from './ui.js';
import { initCrud, setMeta } from './crud.js';

import * as home from './pages/home.js';
import * as energy from './pages/energy.js';
import * as safety from './pages/safety.js';
import * as ga from './pages/ga.js';
import * as it from './pages/it.js';
import * as facility from './pages/facility.js';
import * as report from './pages/report.js';
import * as settings from './pages/settings.js';
import * as ai from './pages/ai.js';

const pages = { home, energy, safety, ga, it, facility, report, settings, ai };
let currentId = 'home';
let appReady = false;
let publicMode = false;

/* Halaman yang boleh dibuka tanpa login. */
const PUBLIC_PAGES = new Set(['home', 'it']);

/* Terapkan visibilitas elemen sesuai mode publik vs login. */
function applyModeStyles() {
  document.body.classList.toggle('is-public', publicMode);
  $$('.nav').forEach((el) => {
    const page = el.dataset.page;
    el.classList.toggle('d-none', publicMode ? !PUBLIC_PAGES.has(page) : false);
  });
  const badge = $('userBadge');
  if (badge && publicMode) {
    badge.textContent = 'Tamu';
    const av = $('userAvatar');
    if (av) av.textContent = '👤';
  }
}

function setDateInfo() {
  const now = new Date();
  const el = $('today');
  if (el) {
    el.textContent =
      now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
      ' · ' + now.toLocaleTimeString('id-ID').slice(0, 5);
  }
}

export function show(id) {
  // Di mode publik, halaman selain dashboard & tiket IT diblokir.
  if (publicMode && !PUBLIC_PAGES.has(id)) {
    toastErr('Silakan login sebagai staff untuk membuka halaman ini.');
    showGate();
    return;
  }
  if (!pages[id]) {
    console.warn(`Halaman "${id}" tidak ditemukan`);
    return;
  }
  $$(`main section`).forEach((x) => x.classList.add('hidden'));
  $(id).classList.remove('hidden');
  $$('.nav').forEach((x) => x.classList.toggle('active', x.dataset.page === id));
  $('side').classList.remove('open');
  const fab = $('aiFab'); // FAB tidak perlu tampil saat sudah di halaman AI
  if (fab) fab.classList.toggle('d-none', id === 'ai');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  currentId = id;
  loadCurrent();
}

async function loadCurrent() {
  const p = pages[currentId];
  if (!p) return;
  // Mode publik hanya pakai loadPublic(); jangan panggil load() versi staff
  // karena akan fetch endpoint protected dan memicu 401 → toast error.
  if (publicMode && p.loadPublic) {
    try {
      await p.loadPublic();
    } catch (err) {
      console.error(err);
      toastErr('Tidak bisa memuat data. Server mungkin sedang sibuk.');
    }
    return;
  }
  if (p.load) {
    try {
      await p.load();
    } catch (err) {
      console.error(err);
      toastErr('Tidak bisa memuat data. Server mungkin sedang sibuk.');
    }
  }
}

function wireNav() {
  $$('[data-page]').forEach((el) => {
    el.addEventListener('click', () => {
      show(el.dataset.page);
      $('side').classList.remove('open'); // di mobile: tutup panel setelah pilih menu
    });
  });
  $('menuBtn').addEventListener('click', () => {
    if (window.matchMedia('(max-width: 860px)').matches) {
      $('side').classList.toggle('open');
    }
  });
  const staffBtn = $('btnStaffLogin');
  if (staffBtn) {
    staffBtn.onclick = () => showGate();
  }
}

function wireLogout() {
  const btn = $('btnLogout');
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true;
    await api.logout();
    location.reload();
  };
}

function showGate(msg = '') {
  const gate = $('loginGate');
  if (!gate) return;
  $('loginMsg').textContent = msg;
  $('loginPass').value = '';
  gate.classList.remove('hidden');
  setTimeout(() => ($('loginUser').value ? $('loginPass') : $('loginUser')).focus(), 60);
}

const hideGate = () => $('loginGate')?.classList.add('hidden');

function wireLoginGate() {
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Memeriksa…';
    $('loginMsg').textContent = '';
    try {
      await api.login($('loginUser').value.trim(), $('loginPass').value);
      hideGate();
      await initApp();
    } catch (err) {
      $('loginMsg').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  });
}

async function initApp() {
  if (appReady) {
    loadCurrent();
    return;
  }
  // Login berhasil: keluar dari mode publik agar menu staff kembali tampil.
  publicMode = false;
  applyModeStyles();
  const user = currentUser();
  const badge = $('userBadge');
  if (badge && user) {
    badge.textContent = user.username;
  }
  const roleEl = $('userRole');
  if (roleEl && user) {
    roleEl.textContent = user.role === 'admin' ? 'Admin' : 'Staff';
  }
  const av = $('userAvatar');
  if (av && user) {
    av.textContent = (user.username || '?').charAt(0).toUpperCase();
  }
  const hdr = $('hdrUser');
  if (hdr && user) {
    hdr.textContent = user.username;
  }
  const hdrAv = $('hdrAvatar');
  if (hdrAv && user) {
    hdrAv.textContent = (user.username || '?').charAt(0).toUpperCase();
  }
  try {
    const metaData = await meta();
    setMeta(metaData);
    setDateInfo();
    wireNav();
    wireLogout();
    initCrud(() => loadCurrent());

    for (const p of Object.values(pages)) {
      if (p.mount) p.mount();
    }
    appReady = true;

    const target = location.hash?.slice(1);
    show(pages[target] ? target : 'home');
  } catch (err) {
    console.error(err);
    toastErr('Server belum merespons. Jalankan npm start lalu refresh halaman.');
  }
}

/* Mode publik: dashboard ringkasan + form lapor IT, tanpa modul operasional. */
async function initPublicApp() {
  publicMode = true;
  applyModeStyles();
  setDateInfo();
  wireNav();
  home.mountPublic?.();
  it.mountPublic?.();
  show(location.hash?.slice(1) === 'it' ? 'it' : 'home');
}

async function boot() {
  wireLoginGate();
  window.addEventListener('issd:unauthorized', () => {
    // Endpoint publik tidak mengirim 401, jadi ini selalu berarti sesi staff habis.
    if (publicMode) return;
    publicMode = true;
    applyModeStyles();
    showGate('Sesi habis. Silakan login lagi.');
  });

  if (token()) {
    try {
      await api.me();
      hideGate();
      return initApp();
    } catch {
      clearLoginState();
    }
  }
  // Tanpa token valid, masuk mode publik alih-alih mengunci seluruh aplikasi.
  hideGate();
  return initPublicApp();
}

/* Token lama yang sudah ditolak dibersihkan agar layar login mulai dari kosong. */
function clearLoginState() {
  try { localStorage.removeItem('issd-token'); localStorage.removeItem('issd-user'); } catch { /* abaikan */ }
}

window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('error', (e) => toastErr(e.message));
