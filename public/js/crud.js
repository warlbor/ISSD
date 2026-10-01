/* Registry skema CRUD. Setiap entitas mendeklarasikan field-nya sekali, lalu
   tombol Tambah / Ubah / Hapus dan dropdown status cepat memakai definisi itu. */

import { api, meta } from './api.js';
import { html, esc, openForm, confirmDialog, toastOk, toastErr, monthLabel } from './ui.js';

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
    title: 'Work Order',
    endpoint: '/api/work-orders',
    label: (r) => `${r.wo_no} — ${r.description}`,
    defaults: () => ({ module: 'Facility', status: 'Open', priority: 'Medium' }),
    fields: (meta) => [
      { name: 'wo_no', label: 'Nomor', disabled: true },
      { name: 'module', label: 'Modul', type: 'select', options: meta.enums.woModule },
      { name: 'priority', label: 'Prioritas', type: 'select', options: PRIORITY },
      { name: 'status', label: 'Status', type: 'select', options: meta.enums.woStatus },
      { name: 'location', label: 'Lokasi' },
      { name: 'assigned_to', label: 'Ditangani oleh' },
      { name: 'reporter', label: 'Pelapor' },
      { name: 'description', label: 'Uraian', type: 'textarea', required: true, full: true }
    ]
  },

  it_tickets: {
    title: 'Tiket IT',
    endpoint: '/api/it/tickets',
    label: (r) => `${r.ticket_no} — ${r.issue}`,
    defaults: () => ({ status: 'Open', category: 'other', priority: 'Medium' }),
    fields: (meta) => [
      { name: 'ticket_no', label: 'Nomor Tiket', disabled: true },
      { name: 'user_name', label: 'Pengguna', required: true },
      { name: 'host', label: 'Hostname' },
      { name: 'category', label: 'Kategori', type: 'select', options: meta.enums.ticketCategory },
      { name: 'status', label: 'Status', type: 'select', options: meta.enums.ticketStatus },
      { name: 'priority', label: 'Prioritas', type: 'select', options: PRIORITY },
      { name: 'assigned_to', label: 'Ditangani oleh' },
      { name: 'issue', label: 'Masalah', type: 'textarea', required: true, full: true }
    ]
  },

  vehicle_bookings: {
    title: 'Peminjaman Kendaraan',
    endpoint: '/api/ga/bookings',
    label: (r) => `${r.booking_no} — ${r.borrower}`,
    fields: (meta) => [
      { name: 'booking_no', label: 'No. Booking', disabled: true },
      { name: 'borrower', label: 'Peminjam', required: true },
      { name: 'use_at', label: 'Tanggal & Jam Pakai', type: 'datetime-local', required: true },
      { name: 'vehicle', label: 'Kendaraan' },
      { name: 'driver', label: 'Supir' },
      { name: 'km', label: 'Estimasi Km', type: 'number', min: 0 },
      { name: 'status', label: 'Status', type: 'select', options: meta.enums.bookingStatus },
      { name: 'purpose', label: 'Tujuan', type: 'textarea', required: true, full: true }
    ]
  },

  ga_stock: {
    title: 'Stok ATK',
    endpoint: '/api/ga/stock',
    label: (r) => r.item,
    defaults: () => ({ stock: 0, rop: 0, unit: 'pcs' }),
    fields: () => [
      { name: 'item', label: 'Nama Item', required: true, full: true },
      { name: 'stock', label: 'Stok Sekarang', type: 'number', required: true },
      { name: 'rop', label: 'Reorder Point', type: 'number', required: true },
      { name: 'unit', label: 'Satuan' }
    ]
  },

  safety_inspections: {
    title: 'Inspeksi Safety',
    endpoint: '/api/safety/inspections',
    label: (r) => `${r.inspect_date} — ${r.area}`,
    defaults: () => ({ inspect_date: new Date().toISOString().slice(0, 10), status: 'Pending' }),
    fields: (meta) => [
      { name: 'inspect_date', label: 'Tanggal Inspeksi', type: 'date', required: true },
      { name: 'area', label: 'Area', required: true },
      { name: 'status', label: 'Status', type: 'select', options: meta.enums.inspectionStatus },
      { name: 'pic', label: 'PJT / PIC' },
      { name: 'finding', label: 'Temuan', type: 'textarea', required: true, full: true }
    ]
  },

  facility_pm: {
    title: 'Jadwal Preventive Maintenance',
    endpoint: '/api/facility/pm',
    label: (r) => r.equipment,
    defaults: () => ({ done: '0', progress: '0%' }),
    fields: () => [
      { name: 'equipment', label: 'Peralatan', required: true, full: true },
      { name: 'total_units', label: 'Total Unit', required: true },
      { name: 'done', label: 'Selesai', required: true },
      { name: 'progress', label: 'Progres' },
      { name: 'next_schedule', label: 'Jadwal Berikutnya' }
    ]
  },

  energy_monthly: {
    title: 'Data Energi Bulanan',
    endpoint: '/api/energy/monthly',
    label: (r) => `${monthLabel(r.month)} ${r.year}`,
    defaults: () => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() + 1, electricity_kwh: 0, gas_m3: 0, water_m3: 0 };
    },
    fields: () => [
      { name: 'year', label: 'Tahun', type: 'number', required: true },
      { name: 'month', label: 'Bulan (1–12)', type: 'number', required: true, min: 1, max: 12 },
      { name: 'electricity_kwh', label: 'Listrik (kWh)', type: 'number', required: true },
      { name: 'gas_m3', label: 'Gas (MMbtu)', type: 'number', required: true },
      { name: 'water_m3', label: 'Air (m³)', type: 'number', required: true },
      { name: 'excluded', label: 'Kecilkan bulan ini dari tren (mis. pembacaan meter kumulatif)', type: 'checkbox', full: true },
      { name: 'note', label: 'Catatan', full: true }
    ]
  },

  energy_departments: {
    title: 'Konsumsi per Departemen',
    endpoint: '/api/energy/departments',
    label: (r) => `${r.department} (${monthLabel(r.month)} ${r.year})`,
    defaults: () => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() + 1, kwh: 0 };
    },
    fields: () => [
      { name: 'year', label: 'Tahun', type: 'number', required: true },
      { name: 'month', label: 'Bulan (1–12)', type: 'number', required: true, min: 1, max: 12 },
      { name: 'department', label: 'Departemen', required: true, full: true },
      { name: 'kwh', label: 'Konsumsi (kWh)', type: 'number', required: true },
      { name: 'share_pct', label: 'Porsi (%)', type: 'number', step: '0.1' },
      { name: 'vs_prev_pct', label: 'vs Bulan Lalu (%)', type: 'number', step: '0.1' }
    ]
  },

  energy_fuels: {
    title: 'Pemakaian Bahan Bakar',
    endpoint: '/api/energy/fuels',
    label: (r) => `${r.fuel_type} ${r.qty} ${r.unit} (${monthLabel(r.month)} ${r.year})`,
    defaults: () => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() + 1, fuel_type: 'Solar (HSD)', qty: 0, unit: 'liter' };
    },
    fields: () => [
      { name: 'year', label: 'Tahun', type: 'number', required: true },
      { name: 'month', label: 'Bulan (1–12)', type: 'number', required: true, min: 1, max: 12 },
      { name: 'fuel_type', label: 'Jenis (Solar, Petrol, dsb.)', required: true },
      { name: 'qty', label: 'Jumlah', type: 'number', required: true },
      { name: 'unit', label: 'Satuan', required: true },
      { name: 'note', label: 'Catatan', full: true }
    ]
  },

  alerts: {
    title: 'Alert Manual',
    endpoint: '/api/alerts',
    label: (r) => r.message,
    defaults: () => ({ module: 'FACILITY', severity: 'warn' }),
    fields: () => [
      { name: 'module', label: 'Modul', required: true },
      { name: 'severity', label: 'Level', type: 'select', options: ['ok', 'warn', 'danger'] },
      { name: 'extra', label: 'Nilai Tambahan' },
      { name: 'message', label: 'Pesan', type: 'textarea', required: true, full: true }
    ]
  }
};

function schemaOf(entity) {
  const s = SCHEMAS[entity];
  if (!s) throw new Error(`Skema "${entity}" tidak dikenal`);
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
      <button type="button" class="icon-btn" data-act="edit" data-entity="${esc(entity)}" data-id="${esc(r.id)}" title="Ubah">✏️</button>
      <button type="button" class="icon-btn del" data-act="del" data-entity="${esc(entity)}" data-id="${esc(r.id)}" data-label="${label}" title="Hapus">🗑</button>
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
          title: `Tambah ${s.title}`,
          fields: fields.filter((f) => !f.disabled),
          values: def,
          submitLabel: 'Simpan',
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
        if (!current) throw new Error('Data tidak ditemukan, muat ulang halaman.');
        openForm({
          title: `Ubah ${s.title} · ${s.label(current)}`,
          fields: fieldsOf(entity),
          values: current,
          wide: true,
          hint: 'Perubahan dicatat beserta nama Anda di log aktivitas.',
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
          title: `Hapus ${s.title}?`,
          message: `${label}\n\nData dihapus permanen dari database. Riwayat perubahannya tetap tercatat di log aktivitas.`,
          onConfirm: async () => {
            await api.del(`${s.endpoint}/${id}`);
            toastOk('Data dihapus');
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
      toastOk(`${s.title} → ${sel.value}`);
      await reload(entity);
    } catch (err) {
      toastErr(err.message);
      sel.disabled = false;
    }
  });
}
