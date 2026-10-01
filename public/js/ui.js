/* Komponen UI dasar. Semua teks dari database di-escape lewat esc() sebelum
   masuk innerHTML, karena isinya sekarang bisa diketik pengguna lain di jaringan. */

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Penanda untuk sel yang memang berisi HTML buatan sendiri. */
export const html = (s) => ({ __html: String(s) });
export const isHtml = (c) => c !== null && typeof c === 'object' && '__html' in c;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const monthLabel = (m) => MONTHS[Number(m) - 1] || `Bln ${m}`;

export function fmtNum(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

export function rupiah(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}

export function compact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + ' M';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + ' Jt';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + ' Rb';
  return String(Math.round(v));
}

export function tagClass(mod) {
  const m = String(mod || '').toUpperCase();
  if (m.includes('SAFETY')) return 'tag-s';
  if (m.includes('ENERGY')) return 'tag-e';
  if (m.includes('GA') || m.includes('GENERAL')) return 'tag-g';
  if (m.includes('IT')) return 'tag-i';
  return 'tag-f';
}

export function statusClass(s) {
  const x = String(s || '').toLowerCase();
  if (/(closed|solved|approved|returned|selesai|done|\bok\b)/.test(x)) return 'ok';
  if (/(reject|cancel|danger|critical|overdue)/.test(x)) return 'danger';
  if (/(pending|progress|warn|assigned|low|review|in use|scheduled)/.test(x)) return 'warn';
  return 'info';
}

export function sevClass(s) {
  const x = String(s || '').toLowerCase();
  if (x === 'ok' || x === 'green') return 'green';
  if (x === 'danger' || x === 'red') return 'red';
  if (x === 'warn' || x === 'orange') return 'orange';
  if (x === 'info' || x === 'blue') return 'blue';
  return '';
}

export function pill(status) {
  return html(`<span class="status ${statusClass(status)}">${esc(status)}</span>`);
}

export function tag(module) {
  return html(`<span class="tag ${tagClass(module)}">${esc(module)}</span>`);
}

/* ===== Toast ===== */

let toastTimer = null;
export function toast(message, kind = '') {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = 'toast';
  }, 3400);
}

export const toastOk = (m) => toast(m, 'ok');
export const toastErr = (m) => toast(m, 'err');

/* ===== Tabel ===== */

function cellHtml(cell) {
  if (isHtml(cell)) {
    // Sel html() tetap harus dibungkus <td> — kecuali isinya sudah berupa
    // <td>/<th> utuh (mis. actionsCell/statusPicker). Tanpa ini, isi sel
    // "terfosfor" keluar tabel oleh parser HTML dan tabelnya hancur.
    const t = cell.__html.trimStart().toLowerCase();
    return t.startsWith('<td') || t.startsWith('<th') ? cell.__html : `<td>${cell.__html}</td>`;
  }
  if (Array.isArray(cell)) return cell.map(cellHtml).join('');
  return `<td>${esc(cell)}</td>`;
}

/* row(cells, attrs) — sel string di-escape, sel html() dibungkus <td> otomatis. */
export function row(cells, attrs = {}) {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');
  return html(`<tr${a ? ' ' + a : ''}>${cells.map(cellHtml).join('')}</tr>`);
}

export function td(cell) {
  return isHtml(cell) ? cell : html(`<td>${esc(cell)}</td>`);
}

export function table(headers, rows, opts = {}) {
  const body = rows.filter(Boolean);
  if (!body.length) {
    return html(`<p class="small empty">${esc(opts.empty || 'Belum ada data tersimpan.')}</p>`);
  }
  const head = `<tr>${headers
    .map((h, i) => `<th${opts.align && opts.align[i] ? ` class="ta-${opts.align[i]}"` : ''}>${esc(h)}</th>`)
    .join('')}</tr>`;
  return html(
    `<div class="table-scroll"><table class="table">${head}<tbody>${body.map((r) => (isHtml(r) ? r.__html : String(r || ''))).join('')}</tbody></table></div>`
  );
}

/* ===== Kartu statistik ===== */

export function kpiBoxes(items) {
  return html(
    items
      .map((it) => {
        const cycle = it.cycle ? `<span class="cycle-hint">⟳ klik</span>` : '';
        const attrs = it.cycle ? ` data-cycle='${esc(JSON.stringify(it.cycle))}'` : '';
        return `<div class="stat-box${it.cycle ? ' energy-cycle' : ''}"${attrs}>
          ${cycle}
          <div class="stat-num ${it.color || ''}">${esc(it.num)}</div>
          <div class="stat-lbl">${esc(it.lbl)}</div>
        </div>`;
      })
      .join('')
  );
}

/* Menempelkan kembali perilaku rotasi ke elemen .energy-cycle hasil innerHTML. */
export function initCyclers(root) {
  $$('.energy-cycle', root).forEach((box, idx) => {
    let variants = [];
    try {
      variants = JSON.parse(box.getAttribute('data-cycle') || '[]');
    } catch {
      return;
    }
    if (!variants.length) return;
    let i = 0;
    let timer = null;
    const num = box.querySelector('.stat-num');
    const lbl = box.querySelector('.stat-lbl');
    const apply = () => {
      const v = variants[i];
      ['green', 'orange', 'red', 'blue', 'purple'].forEach((c) => num.classList.remove(c));
      num.textContent = v.num;
      lbl.textContent = v.lbl;
      if (v.cls) num.classList.add(v.cls);
    };
    const advance = () => {
      // Elemen hasil re-render sebelumnya sudah dilepas dari DOM;
      // hentikan intervalnya supaya timer tidak menumpuk (memory leak).
      if (!box.isConnected) {
        if (timer) clearInterval(timer);
        return;
      }
      i = (i + 1) % variants.length;
      box.classList.add('swap');
      setTimeout(() => {
        box.classList.remove('swap');
        apply();
      }, 200);
    };
    box.onclick = advance;
    setTimeout(() => {
      timer = setInterval(advance, 4000);
      box._stopCycle = () => clearInterval(timer);
    }, 400 + idx * 300);
  });
}

/* Menulis hasil render ke sebuah wadah dan mengaktifkan cyclernya. */
export function renderInto(id, content) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = isHtml(content) ? content.__html : String(content ?? '');
  initCyclers(el);
}

export function renderStats(id, items) {
  renderInto(id, kpiBoxes(items));
}

/* ===== Modal form generik ===== */

let modalEl = null;

function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'modal-backdrop hidden';
  modalEl.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head">
        <h3 id="modalTitle"></h3>
        <button type="button" class="icon-btn" id="modalClose" aria-label="Tutup">✕</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-foot">
        <span class="modal-hint" id="modalHint"></span>
        <button type="button" class="secondary" id="modalCancel">Batal</button>
        <button type="button" class="success" id="modalSubmit">Simpan</button>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  return modalEl;
}

function fieldInput(f, value) {
  const v = value === undefined || value === null ? '' : value;
  const req = f.required ? ' required' : '';
  const lock = f.disabled ? ' disabled' : '';
  if (f.disabled) {
    return `<label for="mf_${f.name}">${esc(f.label)} <span class="help">otomatis</span></label>
      <input type="text" id="mf_${f.name}" name="${esc(f.name)}" value="${esc(v)}" disabled>`;
  }
  switch (f.type) {
    case 'textarea':
      return `<label for="mf_${f.name}">${esc(f.label)}${f.help ? ` <span class="help">${esc(f.help)}</span>` : ''}</label>
        <textarea id="mf_${f.name}" name="${esc(f.name)}" rows="${f.rows || 3}"${req} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
    case 'select':
      return `<label for="mf_${f.name}">${esc(f.label)}${f.help ? ` <span class="help">${esc(f.help)}</span>` : ''}</label>
        <select id="mf_${f.name}" name="${esc(f.name)}"${req}>${(f.options || [])
          .map((o) => {
            const val = typeof o === 'object' ? o.value : o;
            const lbl = typeof o === 'object' ? o.label : o;
            return `<option value="${esc(val)}"${String(v) === String(val) ? ' selected' : ''}>${esc(lbl)}</option>`;
          })
          .join('')}</select>`;
    case 'checkbox':
      return `<label class="check"><input type="checkbox" id="mf_${f.name}" name="${esc(f.name)}"${v ? ' checked' : ''}> ${esc(f.label)}</label>`;
    default:
      return `<label for="mf_${f.name}">${esc(f.label)}${f.help ? ` <span class="help">${esc(f.help)}</span>` : ''}</label>
        <input type="${esc(f.type || 'text')}" id="mf_${f.name}" name="${esc(f.name)}" value="${esc(v)}"${req}${
          f.min !== undefined ? ` min="${esc(f.min)}"` : ''
        }${f.max !== undefined ? ` max="${esc(f.max)}"` : ''}${f.step !== undefined ? ` step="${esc(f.step)}"` : ''} placeholder="${esc(f.placeholder || '')}">`;
  }
}

function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === 'checkbox') {
      out[f.name] = el.checked ? 1 : 0;
    } else if (f.type === 'number') {
      out[f.name] = el.value === '' ? null : Number(el.value);
    } else {
      out[f.name] = el.value;
    }
  }
  return out;
}

/* openForm({ title, fields, values, submitLabel, hint, width, onSubmit })
   onSubmit(values) boleh async; error dari onSubmit ditampilkan di dalam modal. */
export function openForm(opts) {
  const backdrop = ensureModal();
  $('modalTitle').textContent = opts.title || 'Ubah Data';
  $('modalSubmit').textContent = opts.submitLabel || 'Simpan';
  $('modalHint').textContent = opts.hint || '';
  $('modalBody').innerHTML = `<form id="modalForm" class="form-grid${opts.wide ? ' wide' : ''}">${opts.fields
    .map((f) => `<div class="fg${f.full ? ' full' : ''}">${fieldInput(f, (opts.values || {})[f.name])}</div>`)
    .join('')}</form>`;
  backdrop.classList.remove('hidden');
  backdrop.classList.add('show');
  const form = $('modalForm');
  const submit = $('modalSubmit');

  const close = () => {
    backdrop.classList.add('hidden');
    backdrop.classList.remove('show');
  };

  const run = async () => {
    if (!form.reportValidity()) return;
    submit.disabled = true;
    submit.textContent = 'Menyimpan…';
    try {
      await opts.onSubmit(readForm(form, opts.fields));
      close();
      toastOk(opts.doneMessage || 'Tersimpan di database');
    } catch (err) {
      submit.disabled = false;
      submit.textContent = opts.submitLabel || 'Simpan';
      toastErr(err.message);
    }
  };

  submit.onclick = run;
  $('modalCancel').onclick = close;
  $('modalClose').onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    run();
  };
  setTimeout(() => {
    const first = form.querySelector('input, select, textarea');
    if (first) first.focus();
  }, 60);
}

export function confirmDialog({ title = 'Konfirmasi', message, confirmLabel = 'Hapus', onConfirm }) {
  const backdrop = ensureModal();
  $('modalTitle').textContent = title;
  $('modalHint').textContent = '';
  $('modalBody').innerHTML = `<p class="confirm-text">${esc(message)}</p>`;
  backdrop.classList.remove('hidden');
  backdrop.classList.add('show');
  const submit = $('modalSubmit');
  submit.textContent = confirmLabel;
  submit.className = 'danger-btn';
  const close = () => {
    backdrop.classList.add('hidden');
    backdrop.classList.remove('show');
    submit.className = 'success';
  };
  submit.onclick = async () => {
    submit.disabled = true;
    try {
      await onConfirm();
      close();
    } catch (err) {
      submit.disabled = false;
      toastErr(err.message);
    }
  };
  $('modalCancel').onclick = close;
  $('modalClose').onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };
}

/* ===== Hasil kalkulator ===== */

export function showResult(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

export { MONTHS };
