/* Halaman Facility: PM dan work order fasilitas. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, toast } from '../ui.js';
import { actionsCell, statusPicker, addButton } from '../crud.js';
import { calcAC } from '../calc.js';

export const id = 'facility';

export async function load() {
  const d = await api.get('/api/facility');
  const kpis = d.kpis || {};

  renderStats('facStats', [
    { num: kpis.pm_month?.value || 'N/A', lbl: 'PM Bulan Ini', color: 'green' },
    { num: kpis.ac_units?.value || 'N/A', lbl: 'Unit AC Indoor' },
    { num: String((d.workOrders || []).length), lbl: 'WO Facility', color: 'blue' },
    { num: kpis.lift_avail?.value || 'N/A', lbl: 'Ketersediaan Lift', color: 'green' }
  ]);

  renderInto(
    'pmTable',
    table(
      ['Peralatan', 'Total', 'Selesai', 'Progress', 'Berikutnya', 'Aksi'],
      (d.pm || []).map((r) =>
        row([r.equipment, r.total_units, r.done, r.progress, r.next_schedule, actionsCell('facility_pm', r)]).__html
      ),
      { empty: 'Belum ada jadwal PM.' }
    )
  );
  renderInto('pmAdd', addButton('facility_pm', 'Tambah Jadwal'));

  renderInto(
    'facWoTable',
    table(
      ['No', 'Lokasi', 'Uraian', 'Status', 'Aksi'],
      (d.workOrders || []).map((w) =>
        row([w.wo_no, w.location, w.description, statusPicker('work_orders', w), actionsCell('work_orders', w)]).__html
      ),
      { empty: 'Belum ada work order fasilitas.' }
    )
  );
}

function bindFacilityTabs() {
  document.querySelectorAll('[data-ftab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ['ft0', 'ft1'].forEach((id, k) => $(id).classList.toggle('hidden', k !== Number(btn.dataset.ftab)));
      btn.parentNode.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

export function mount() {
  bindFacilityTabs();
  $('btnAC').onclick = () => {
    $('fRes').textContent = calcAC(
      Number($('fP').value),
      Number($('fL').value),
      Number($('fT').value),
      Number($('fO').value),
      $('fEquip').value,
      $('fSun').value
    );
  };
  $('btnWO').onclick = async () => {
    try {
      const row = await api.post('/api/work-orders', {
        module: 'Facility',
        description: `${$('fMasalah').value}: ${$('fWO').value}`,
        location: $('fLoc').value,
        reporter: $('fPelapor').value,
        priority: $('fUrgensi').value === 'Tinggi' ? 'High' : $('fUrgensi').value === 'Rendah' ? 'Low' : 'Medium'
      });
      $('fRes2').textContent = `✅ WORK ORDER TERSIMPAN\nNo: ${row.wo_no}\nLokasi: ${row.location}\nStatus: ${row.status}\nTeknisi: ${row.assigned_to}`;
      toast('Work order tersimpan');
      load();
    } catch (e) {
      $('fRes2').textContent = '❌ ' + e.message;
    }
  };
}
