/* Pembungkus fetch dengan token login. Sesi diverifikasi server, jadi nama
   pengguna di activity_log tidak bisa dipalsukan dari header bebas. */

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

async function request(method, path, body) {
  const headers = {};
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error('Tidak bisa menghubungi server. Jalankan npm start.');
  }

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('issd:unauthorized'));
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Respons server tidak valid (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status})`);
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
    let res;
    try {
      res = await fetch(path);
    } catch {
      throw new Error('Tidak bisa menghubungi server. Jalankan npm start.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Respons server tidak valid (${res.status})`);
    }
    if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status})`);
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
      throw new Error('Tidak bisa menghubungi server. Jalankan npm start.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Respons server tidak valid (${res.status})`);
    }
    if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status})`);
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
      throw new Error('Tidak bisa menghubungi server. Jalankan npm start.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || 'Login gagal');
    saveSession(data.token, data.user);
    return data.user;
  },

  logout: async () => {
    const t = token();
    try {
      if (t) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } });
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
