/* Halaman Settings: nilai KPI, tarif, target, infra IT, akun, dan pengguna. */
import { api, currentUser } from '../api.js';
import { $, renderInto, table, row, html, esc, toast, toastErr, openForm, confirmDialog } from '../ui.js';

export const id = 'settings';

function valueCell(kind, item) {
  return html(
    `<span class="clickable" data-kind="${esc(kind)}" data-key="${esc(item.key)}" data-value="${esc(item.value)}" title="Klik untuk mengubah">${esc(item.value)}</span>`
  );
}

async function editValue(kind, key, current) {
  const fields = [{ name: 'value', label: `Nilai baru untuk ${key}`, required: true, value: current }];
  let endpoint = '';
  let body = {};
  if (kind === 'setting') endpoint = `/api/settings/${key}`;
  if (kind === 'kpi') endpoint = `/api/kpis/${key}`;
  if (kind === 'infra') {
    endpoint = `/api/it/infra/${key}`;
    fields.push({
      name: 'severity',
      label: 'Severity',
      type: 'select',
      options: ['ok', 'warn', 'danger', 'info'],
      value: 'info'
    });
  }
  openForm({
    title: `Ubah ${kind === 'infra' ? 'Infrastruktur' : kind === 'kpi' ? 'KPI' : 'Setting'}`,
    fields,
    values: { value: current },
    hint: 'Perubahan tercatat di log aktivitas.',
    onSubmit: async (values) => {
      body = { value: values.value };
      if (kind === 'infra') body.severity = values.severity;
      await api.patch(endpoint, body);
      toast('Tersimpan');
      await load();
    }
  });
}

async function loadUsers() {
  const me = currentUser();
  const panel = $('usersPanel');
  if (!panel) return;
  if (!me || me.role !== 'admin') {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  try {
    const users = await api.get('/api/auth/users');
    renderInto(
      'usersTable',
      table(
        ['Username', 'Role', 'Dibuat', 'Aksi'],
        users.map((u) =>
          row([
            u.username,
            u.role === 'admin' ? 'Admin' : 'Staff',
            u.created_at,
            html(`<td class="row-actions">${
              u.id === me.id
                ? '<span class="small">akun sendiri</span>'
                : `<button type="button" class="icon-btn del" data-act="delUser" data-id="${esc(u.id)}" data-label="${esc(u.username)}" title="Hapus">🗑</button>`
            }</td>`)
          ]).__html
        ),
        { empty: 'Belum ada pengguna lain.' }
      )
    );
  } catch (err) {
    panel.classList.add('hidden');
  }
}

function addUserDialog() {
  openForm({
    title: 'Tambah Pengguna',
    fields: [
      { name: 'username', label: 'Username', required: true, placeholder: 'mis. budi' },
      { name: 'password', label: 'Password (min. 6 karakter)', type: 'password', required: true, min: 6 },
      { name: 'role', label: 'Role', type: 'select', options: ['staff', 'admin'] }
    ],
    submitLabel: 'Tambah',
    onSubmit: async (values) => {
      await api.post('/api/auth/users', values);
      toast(`Pengguna "${values.username}" ditambahkan`);
      await loadUsers();
    }
  });
}

function changePasswordDialog() {
  openForm({
    title: 'Ganti Password',
    fields: [
      { name: 'old_password', label: 'Password Lama', type: 'password', required: true },
      { name: 'new_password', label: 'Password Baru (min. 6 karakter)', type: 'password', required: true, min: 6 }
    ],
    submitLabel: 'Simpan Password',
    onSubmit: async (values) => {
      await api.post('/api/auth/password', values);
      toast('Password diganti. Perangkat lain akan diminta login ulang.');
    }
  });
}

export async function load() {
  const d = await api.get('/api/settings');
  const rows = (d.settings || []).map((s) =>
    row([s.key, s.label, s.value, s.unit || '-', valueCell('setting', s)]).__html
  );
  renderInto('settingsTable', table(['Key', 'Label', 'Nilai', 'Unit', 'Aksi'], rows, { empty: 'Tidak ada setting.' }));

  const kpiRows = (d.kpis || []).map((k) =>
    row([k.key, k.label, k.value, k.color || '-', valueCell('kpi', k)]).__html
  );
  renderInto('kpiTable', table(['Key', 'Label', 'Nilai', 'Color', 'Aksi'], kpiRows, { empty: 'Tidak ada KPI.' }));

  const infraRows = (d.infra || []).map((i) =>
    row([i.key, i.label, i.value, i.severity, valueCell('infra', i)]).__html
  );
  renderInto('infraTable', table(['Key', 'Label', 'Nilai', 'Severity', 'Aksi'], infraRows, { empty: 'Tidak ada infra IT.' }));

  await loadUsers();
}

export function mount() {
  const root = document.getElementById('settingsContainer');
  if (!root) return;

  root.addEventListener('click', async (e) => {
    const span = e.target.closest('[data-kind]');
    if (span) {
      const kind = span.dataset.kind;
      const key = span.dataset.key;
      const value = span.dataset.value || span.textContent;
      editValue(kind, key, value).catch((err) => toastErr(err.message));
      return;
    }

    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'pwchange') {
      changePasswordDialog();
      return;
    }

    if (act === 'addUser') {
      addUserDialog();
      return;
    }

    if (act === 'delUser') {
      const id = btn.dataset.id;
      const label = btn.dataset.label || '';
      confirmDialog({
        title: 'Hapus pengguna?',
        message: `${label}\n\nSesi login pengguna ini juga dicabut.`,
        onConfirm: async () => {
          await api.del(`/api/auth/users/${id}`);
          toast('Pengguna dihapus');
          await loadUsers();
        }
      });
    }
  });
}
