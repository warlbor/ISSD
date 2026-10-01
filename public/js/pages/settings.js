/* Halaman Settings: nilai KPI, tarif, target, infra IT, akun, dan pengguna. */
import { api, currentUser } from '../api.js';
import { $, renderInto, table, row, html, esc, toast, toastErr, openForm, confirmDialog } from '../ui.js';
import { t } from '../i18n.js';

export const id = 'settings';

function valueCell(kind, item) {
  return html(
    `<span class="clickable" data-kind="${esc(kind)}" data-key="${esc(item.key)}" data-value="${esc(item.value)}" title="${esc(t('settings.click'))}">${esc(item.value)}</span>`
  );
}

async function editValue(kind, key, current) {
  const fields = [{ name: 'value', label: t('settings.newValue', { key }), required: true, value: current }];
  let endpoint = '';
  let body = {};
  if (kind === 'setting') endpoint = `/api/settings/${key}`;
  if (kind === 'kpi') endpoint = `/api/kpis/${key}`;
  if (kind === 'infra') {
    endpoint = `/api/it/infra/${key}`;
    fields.push({
      name: 'severity',
      label: t('settings.severity'),
      type: 'select',
      options: ['ok', 'warn', 'danger', 'info'],
      value: 'info'
    });
  }
  openForm({
    title: kind === 'infra' ? t('settings.editInfra') : kind === 'kpi' ? t('settings.editKpi') : t('settings.editSetting'),
    fields,
    values: { value: current },
    hint: t('settings.audit'),
    onSubmit: async (values) => {
      body = { value: values.value };
      if (kind === 'infra') body.severity = values.severity;
      await api.patch(endpoint, body);
      toast(t('settings.saved'));
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
        [t('settings.col.user'), t('settings.col.role'), t('settings.col.created'), t('energy.col.action')],
        users.map((u) =>
          row([
            u.username,
            u.role === 'admin' ? t('role.admin') : t('role.staff'),
            u.created_at,
            html(`<td class="row-actions">${
              u.id === me.id
                ? `<span class="small">${esc(t('settings.self'))}</span>`
                : `<button type="button" class="icon-btn del" data-act="delUser" data-id="${esc(u.id)}" data-label="${esc(u.username)}" title="${esc(t('crud.delete'))}">🗑</button>`
            }</td>`)
          ]).__html
        ),
        { empty: t('settings.noUsers') }
      )
    );
  } catch (err) {
    panel.classList.add('hidden');
  }
}

function addUserDialog() {
  openForm({
    title: t('settings.addTitle'),
    fields: [
      { name: 'username', label: t('login.user'), required: true, placeholder: t('ph.example') },
      { name: 'password', label: t('settings.pwMin'), type: 'password', required: true, min: 6 },
      { name: 'role', label: t('settings.col.role'), type: 'select', options: ['staff', 'admin'] }
    ],
    submitLabel: t('settings.add'),
    onSubmit: async (values) => {
      await api.post('/api/auth/users', values);
      toast(t('settings.userAdded', { name: values.username }));
      await loadUsers();
    }
  });
}

function changePasswordDialog() {
  openForm({
    title: t('settings.pw'),
    fields: [
      { name: 'old_password', label: t('settings.oldPw'), type: 'password', required: true },
      { name: 'new_password', label: t('settings.newPw'), type: 'password', required: true, min: 6 }
    ],
    submitLabel: t('settings.savePw'),
    onSubmit: async (values) => {
      await api.post('/api/auth/password', values);
      toast(t('settings.pwChanged'));
    }
  });
}

export async function load() {
  const d = await api.get('/api/settings');
  const rows = (d.settings || []).map((s) =>
    row([s.key, s.label, s.value, s.unit || '-', valueCell('setting', s)]).__html
  );
  renderInto('settingsTable', table([t('settings.col.key'), t('settings.col.label'), t('settings.col.value'), t('settings.col.unit'), t('energy.col.action')], rows, { empty: t('settings.noSettings') }));

  const kpiRows = (d.kpis || []).map((k) =>
    row([k.key, k.label, k.value, k.color || '-', valueCell('kpi', k)]).__html
  );
  renderInto('kpiTable', table([t('settings.col.key'), t('settings.col.label'), t('settings.col.value'), t('settings.col.color'), t('energy.col.action')], kpiRows, { empty: t('settings.noKpi') }));

  const infraRows = (d.infra || []).map((i) =>
    row([i.key, i.label, i.value, i.severity, valueCell('infra', i)]).__html
  );
  renderInto('infraTable', table([t('settings.col.key'), t('settings.col.label'), t('settings.col.value'), t('settings.severity'), t('energy.col.action')], infraRows, { empty: t('settings.noInfra') }));

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
        title: t('settings.delTitle'),
        message: t('settings.delMsg', { label }),
        onConfirm: async () => {
          await api.del(`/api/auth/users/${id}`);
          toast(t('settings.deleted'));
          await loadUsers();
        }
      });
    }
  });
}
