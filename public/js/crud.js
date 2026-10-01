/* Registry skema CRUD. Setiap entitas mendeklarasikan field-nya sekali, lalu
   tombol Tambah / Ubah / Hapus dan dropdown status cepat memakai definisi itu. */

import { api, meta } from './api.js';
import { html, esc, openForm, confirmDialog, toastOk, toastErr, monthLabel } from './ui.js';
import { t } from './i18n.js';

/* Cache meta dipakai bersama dengan api.js agar tidak ada dua fetch /api/meta. */
let _metaCache = null;

export function setMeta(meta) {
  _metaCache = meta;
}

async function getMeta() {
  if (!_metaCache) _metaCache = await meta();
  return _metaCache;
}

const PRIORITY = ['Low', 'Medium', 'High', 'Critical'];

/* fields boleh berupa fungsi agar opsi enum diambil dari /api/meta setelah dimuat. */
export const SCHEMAS = {
  work_orders: {
    get title() { return t('crud.wo'); },
    endpoint: '/api/work-orders',
    label: (r) => `${r.wo_no} — ${r.description}`,
    defaults: () => ({ module: 'Facility', status: 'Open', priority: 'Medium' }),
    fields: (meta) => [
      { name: 'wo_no', label: t('crud.wo.no'), disabled: true },
      { name: 'module', label: t('crud.wo.module'), type: 'select', options: meta.enums.woModule },
      { name: 'priority', label: t('crud.wo.priority'), type: 'select', options: PRIORITY },
      { name: 'status', label: t('crud.wo.status'), type: 'select', options: meta.enums.woStatus },
      { name: 'location', label: t('crud.wo.loc') },
      { name: 'assigned_to', label: t('crud.wo.owner') },
      { name: 'reporter', label: t('crud.wo.reporter') },
      { name: 'description', label: t('crud.wo.desc'), type: 'textarea', required: true, full: true }
    ]
  },

  it_tickets: {
    get title() { return t('crud.ticket'); },
    endpoint: '/api/it/tickets',
    label: (r) => `${r.ticket_no} — ${r.issue}`,
    defaults: () => ({ status: 'Open', category: 'other', priority: 'Medium' }),
    fields: (meta) => [
      { name: 'ticket_no', label: t('crud.ticket.no'), disabled: true },
      { name: 'user_name', label: t('crud.ticket.user'), required: true },
      { name: 'host', label: t('crud.ticket.host') },
      { name: 'category', label: t('crud.ticket.cat'), type: 'select', options: (meta.enums.ticketCategory || []).map((v) => ({ value: v, label: t('it.cat.' + v) })) },
      { name: 'status', label: t('crud.wo.status'), type: 'select', options: meta.enums.ticketStatus },
      { name: 'priority', label: t('crud.wo.priority'), type: 'select', options: PRIORITY },
      { name: 'assigned_to', label: t('crud.ticket.owner') },
      { name: 'issue', label: t('crud.ticket.issue'), type: 'textarea', required: true, full: true }
    ]
  },

  vehicle_bookings: {
    get title() { return t('crud.book'); },
    endpoint: '/api/ga/bookings',
    label: (r) => `${r.booking_no} — ${r.borrower}`,
    fields: (meta) => [
      { name: 'booking_no', label: t('crud.book.no'), disabled: true },
      { name: 'borrower', label: t('crud.book.who'), required: true },
      { name: 'use_at', label: t('crud.book.when'), type: 'datetime-local', required: true },
      { name: 'vehicle', label: t('crud.book.vehicle') },
      { name: 'driver', label: t('crud.book.driver') },
      { name: 'km', label: t('crud.book.km'), type: 'number', min: 0 },
      { name: 'status', label: t('crud.wo.status'), type: 'select', options: meta.enums.bookingStatus },
      { name: 'purpose', label: t('crud.book.purpose'), type: 'textarea', required: true, full: true }
    ]
  },

  ga_stock: {
    get title() { return t('crud.stock'); },
    endpoint: '/api/ga/stock',
    label: (r) => r.item,
    defaults: () => ({ stock: 0, rop: 0, unit: 'pcs' }),
    fields: () => [
      { name: 'item', label: t('crud.stock.item'), required: true, full: true },
      { name: 'stock', label: t('crud.stock.qty'), type: 'number', required: true },
      { name: 'rop', label: t('crud.stock.rop'), type: 'number', required: true },
      { name: 'unit', label: t('crud.stock.unit') }
    ]
  },

  safety_inspections: {
    get title() { return t('crud.insp'); },
    endpoint: '/api/safety/inspections',
    label: (r) => `${r.inspect_date} — ${r.area}`,
    defaults: () => ({ inspect_date: new Date().toISOString().slice(0, 10), status: 'Pending' }),
    fields: (meta) => [
      { name: 'inspect_date', label: t('crud.insp.date'), type: 'date', required: true },
      { name: 'area', label: t('crud.insp.area'), required: true },
      { name: 'status', label: t('crud.wo.status'), type: 'select', options: meta.enums.inspectionStatus },
      { name: 'pic', label: t('crud.insp.pic') },
      { name: 'finding', label: t('crud.insp.finding'), type: 'textarea', required: true, full: true }
    ]
  },

  facility_pm: {
    get title() { return t('crud.pm'); },
    endpoint: '/api/facility/pm',
    label: (r) => r.equipment,
    defaults: () => ({ done: '0', progress: '0%' }),
    fields: () => [
      { name: 'equipment', label: t('crud.pm.equip'), required: true, full: true },
      { name: 'total_units', label: t('crud.pm.total'), required: true },
      { name: 'done', label: t('crud.pm.done'), required: true },
      { name: 'progress', label: t('crud.pm.progress') },
      { name: 'next_schedule', label: t('crud.pm.next') }
    ]
  },

  energy_monthly: {
    get title() { return t('crud.energy'); },
    endpoint: '/api/energy/monthly',
    label: (r) => `${monthLabel(r.month)} ${r.year}`,
    defaults: () => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() + 1, electricity_kwh: 0, gas_m3: 0, water_m3: 0 };
    },
    fields: () => [
      { name: 'year', label: t('field.year'), type: 'number', required: true },
      { name: 'month', label: t('field.month'), type: 'number', required: true, min: 1, max: 12 },
      { name: 'electricity_kwh', label: t('crud.energy.kwh'), type: 'number', required: true },
      { name: 'gas_m3', label: t('crud.energy.gas'), type: 'number', required: true },
      { name: 'water_m3', label: t('crud.energy.water'), type: 'number', required: true },
      { name: 'excluded', label: t('crud.energy.exclude'), type: 'checkbox', full: true },
      { name: 'note', label: t('field.note'), full: true }
    ]
  },

  energy_departments: {
    get title() { return t('crud.dept'); },
    endpoint: '/api/energy/departments',
    label: (r) => `${r.department} (${monthLabel(r.month)} ${r.year})`,
    defaults: () => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() + 1, kwh: 0 };
    },
    fields: () => [
      { name: 'year', label: t('field.year'), type: 'number', required: true },
      { name: 'month', label: t('field.month'), type: 'number', required: true, min: 1, max: 12 },
      { name: 'department', label: t('crud.dept.name'), required: true, full: true },
      { name: 'kwh', label: t('crud.dept.kwh'), type: 'number', required: true },
      { name: 'share_pct', label: t('crud.dept.share'), type: 'number', step: '0.1' },
      { name: 'vs_prev_pct', label: t('crud.dept.vs'), type: 'number', step: '0.1' }
    ]
  },

  energy_fuels: {
    get title() { return t('crud.fuel'); },
    endpoint: '/api/energy/fuels',
    label: (r) => `${r.fuel_type} ${r.qty} ${r.unit} (${monthLabel(r.month)} ${r.year})`,
    defaults: () => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() + 1, fuel_type: 'Solar (HSD)', qty: 0, unit: 'liter' };
    },
    fields: () => [
      { name: 'year', label: t('field.year'), type: 'number', required: true },
      { name: 'month', label: t('field.month'), type: 'number', required: true, min: 1, max: 12 },
      { name: 'fuel_type', label: t('crud.fuel.type'), required: true },
      { name: 'qty', label: t('field.qty'), type: 'number', required: true },
      { name: 'unit', label: t('field.unit'), required: true },
      { name: 'note', label: t('field.note'), full: true }
    ]
  },

  alerts: {
    get title() { return t('crud.alert'); },
    endpoint: '/api/alerts',
    label: (r) => r.message,
    defaults: () => ({ module: 'FACILITY', severity: 'warn' }),
    fields: () => [
      { name: 'module', label: t('crud.wo.module'), required: true },
      { name: 'severity', label: t('crud.alert.level'), type: 'select', options: ['ok', 'warn', 'danger'] },
      { name: 'extra', label: t('crud.alert.extra') },
      { name: 'message', label: t('crud.alert.msg'), type: 'textarea', required: true, full: true }
    ]
  }
};

function schemaOf(entity) {
  const s = SCHEMAS[entity];
  if (!s) throw new Error(t('modal.unknownSchema', { name: entity }));
  return s;
}

function fieldsOf(entity) {
  const s = schemaOf(entity);
  return typeof s.fields === 'function' ? s.fields(_metaCache) : s.fields;
}

/* Sel aksi di ujung setiap baris tabel. */
export function actionsCell(entity, r) {
  const s = schemaOf(entity);
  const label = esc(s.label(r));
  return html(
    `<td class="row-actions">
      <button type="button" class="icon-btn" data-act="edit" data-entity="${esc(entity)}" data-id="${esc(r.id)}" title="${esc(t('crud.edit'))}">✏️</button>
      <button type="button" class="icon-btn del" data-act="del" data-entity="${esc(entity)}" data-id="${esc(r.id)}" data-label="${label}" title="${esc(t('crud.delete'))}">🗑</button>
    </td>`
  );
}

export function addButton(entity, label) {
  const s = schemaOf(entity);
  return html(
    `<button type="button" class="tiny" data-act="add" data-entity="${esc(entity)}">+ ${esc(label || s.title)}</button>`
  );
}

/* Dropdown ganti status langsung di dalam tabel. */
export function statusPicker(entity, r, field = 'status') {
  const s = schemaOf(entity);
  const opts = typeof s.fields === 'function' ? s.fields(_metaCache) : s.fields;
  const def = opts.find((f) => f.name === field);
  if (!def) return html('');
  return html(
    `<select class="inline-status" data-entity="${esc(entity)}" data-id="${esc(r.id)}" data-field="${esc(field)}">
      ${(def.options || [])
        .map((o) => `<option${String(o) === String(r[field]) ? ' selected' : ''}>${esc(o)}</option>`)
        .join('')}</select>`
  );
}

export function initCrud(reload) {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, entity, id } = btn.dataset;
    try {
      if (act === 'add') {
        await getMeta();
        const s = schemaOf(entity);
        const def = s.defaults ? s.defaults() : {};
        const fields = fieldsOf(entity).filter((f) => f.name !== 'id');
        openForm({
          title: t('modal.add', { title: s.title }),
          fields: fields.filter((f) => !f.disabled),
          values: def,
          submitLabel: t('modal.save'),
          wide: true,
          onSubmit: async (values) => {
            await api.post(s.endpoint, values);
            await reload(entity);
          }
        });
        return;
      }

      if (act === 'edit') {
        await getMeta();
        const s = schemaOf(entity);
        const rows = await api.get(s.endpoint);
        const current = Array.isArray(rows) ? rows.find((x) => String(x.id) === String(id)) : null;
        if (!current) throw new Error(t('modal.missing'));
        openForm({
          title: t('modal.editNamed', { title: s.title, label: s.label(current) }),
          fields: fieldsOf(entity),
          values: current,
          wide: true,
          hint: t('modal.editHint'),
          onSubmit: async (values) => {
            const body = {};
            for (const f of fieldsOf(entity)) {
              if (f.disabled) continue;
              if (values[f.name] !== undefined) body[f.name] = values[f.name];
            }
            await api.patch(`${s.endpoint}/${id}`, body);
            await reload(entity);
          }
        });
        return;
      }

      if (act === 'del') {
        const s = schemaOf(entity);
        const label = btn.dataset.label || '';
        confirmDialog({
          title: t('modal.delTitle', { title: s.title }),
          message: t('modal.delMsg', { label }),
          onConfirm: async () => {
            await api.del(`${s.endpoint}/${id}`);
            toastOk(t('modal.deleted'));
            await reload(entity);
          }
        });
      }
    } catch (err) {
      toastErr(err.message);
    }
  });

  document.addEventListener('change', async (e) => {
    const sel = e.target.closest('.inline-status');
    if (!sel) return;
    const { entity, id, field } = sel.dataset;
    const s = schemaOf(entity);
    sel.disabled = true;
    try {
      await api.patch(`${s.endpoint}/${id}`, { [field]: sel.value });
      toastOk(t('crud.updated', { title: s.title, value: sel.value }));
      await reload(entity);
    } catch (err) {
      toastErr(err.message);
      sel.disabled = false;
    }
  });
}
