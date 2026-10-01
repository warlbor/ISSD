/* Pembungkus fetch dengan token login. Sesi diverifikasi server, jadi nama
   pengguna di activity_log tidak bisa dipalsukan dari header bebas. */

import { t, tx } from './i18n.js';

const TOKEN_KEY = 'issd-token';
const USER_KEY = 'issd-user';

export function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

function saveSession(t, user) {
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/* GitHub Pages tidak menjalankan server. Tampilan di sana membaca snapshot.json. */
export function isStaticHost() {
  return typeof location !== 'undefined' && /(^|\.)github\.io$/.test(location.hostname);
}

const staticMsg = () => t('err.previewOnly');

let snapPromise = null;
function loadSnapshot() {
  if (!snapPromise) {
    snapPromise = fetch(new URL('../snapshot.json', import.meta.url)).then(async (res) => {
      if (!res.ok) throw new Error(t('err.previewMissing'));
      return res.json();
    });
  }
  return snapPromise;
}

async function snapshotGet(path) {
  const snap = await loadSnapshot();
  if (Object.prototype.hasOwnProperty.call(snap, path)) return snap[path];
  const bare = String(path).split('?')[0];
  if (Object.prototype.hasOwnProperty.call(snap, bare)) return snap[bare];
  throw new Error(t('err.previewGap'));
}

async function request(method, path, body) {
  if (isStaticHost()) {
    if (method === 'GET') return snapshotGet(path);
    throw new Error(staticMsg());
  }
  const headers = {};
  const authToken = token();
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error(t('err.offline'));
  }

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('issd:unauthorized'));
    throw new Error(t('err.session'));
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(t('err.badResponse', { status: res.status }));
  }
  if (!res.ok) throw new Error(tx(data.error) || t('err.requestFail', { status: res.status }));
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),

  /* Permintaan tanpa Authorization header, untuk endpoint publik
     (dashboard ringkasan, captcha, input tiket IT tamu). */
  publicGet: async (path) => {
    if (isStaticHost()) return snapshotGet(path);
    let res;
    try {
      res = await fetch(path);
    } catch {
      throw new Error(t('err.offline'));
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      throw new Error(t('err.badResponse', { status: res.status }));
    }
    if (!res.ok) throw new Error(tx(data.error) || t('err.requestFail', { status: res.status }));
    return data;
  },

  publicPost: async (path, body) => {
    let res;
    try {
      res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    } catch {
      throw new Error(t('err.offline'));
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      throw new Error(t('err.badResponse', { status: res.status }));
    }
    if (!res.ok) throw new Error(tx(data.error) || t('err.requestFail', { status: res.status }));
    return data;
  },

  login: async (username, password) => {
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
    } catch {
      throw new Error(t('err.offline'));
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(tx(data && data.error) || t('err.loginFail'));
    saveSession(data.token, data.user);
    return data.user;
  },

  logout: async () => {
    const authToken = token();
    try {
      if (authToken) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
    } catch {
      /* sesi mungkin sudah hangus di sisi server */
    }
    clearSession();
  },

  me: () => request('GET', '/api/auth/me')
};

/* Data bersama yang hanya perlu diambil sekali per muat halaman. */
let _metaCache = null;
export async function meta(force = false) {
  if (!_metaCache || force) _metaCache = await api.get('/api/meta');
  return _metaCache;
}
