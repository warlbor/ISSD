/* Halaman Facility: PM dan work order fasilitas. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, toast } from '../ui.js';
import { actionsCell, statusPicker, addButton } from '../crud.js';
import { calcAC } from '../calc.js';
import { t } from '../i18n.js';

export const id = 'facility';

export async function load() {
  const d = await api.get('/api/facility');
  const kpis = d.kpis || {};

  renderStats('facStats', [
    { num: kpis.pm_month?.value || 'N/A', lbl: t('fac.kpi.pm'), color: 'green' },
    { num: kpis.ac_units?.value || 'N/A', lbl: t('fac.kpi.ac') },
    { num: String((d.workOrders || []).length), lbl: t('fac.kpi.wo'), color: 'blue' },
    { num: kpis.lift_avail?.value || 'N/A', lbl: t('fac.kpi.lift'), color: 'green' }
  ]);

  renderInto(
    'pmTable',
    table(
      [t('fac.col.equip'), t('fac.col.total'), t('fac.col.done'), t('fac.col.progress'), t('fac.col.next'), t('energy.col.action')],
      (d.pm || []).map((r) =>
        row([r.equipment, r.total_units, r.done, r.progress, r.next_schedule, actionsCell('facility_pm', r)]).__html
      ),
      { empty: t('fac.pmEmpty') }
    )
  );
  renderInto('pmAdd', addButton('facility_pm', t('fac.addPm')));

  renderInto(
    'facWoTable',
    table(
      [t('home.col.no'), t('fac.col.loc'), t('home.col.desc'), t('home.col.status'), t('energy.col.action')],
      (d.workOrders || []).map((w) =>
        row([w.wo_no, w.location, w.description, statusPicker('work_orders', w), actionsCell('work_orders', w)]).__html
      ),
      { empty: t('fac.woEmpty') }
    )
  );
}

function bindFacilityTabs() {
  document.querySelectorAll('[data-ftab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ['ft0', 'ft1'].forEach((id, k) => $(id).classList.toggle('hidden', k !== Number(btn.dataset.ftab)));
      btn.parentNode.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

export function mount() {
  bindFacilityTabs();
  $('btnAC').onclick = () => {
    const equip = $('fEquip');
    const sun = $('fSun');
    $('fRes').textContent = calcAC(
      Number($('fP').value),
      Number($('fL').value),
      Number($('fT').value),
      Number($('fO').value),
      equip.value,
      sun.value,
      equip.selectedOptions[0]?.text,
      sun.selectedOptions[0]?.text
    );
  };
  $('btnWO').onclick = async () => {
    try {
      const row = await api.post('/api/work-orders', {
        module: 'Facility',
        description: `${$('fMasalah').selectedOptions[0]?.text || $('fMasalah').value}: ${$('fWO').value}`,
        location: $('fLoc').value,
        reporter: $('fPelapor').value,
        priority: $('fUrgensi').value === 'Tinggi' ? 'High' : $('fUrgensi').value === 'Rendah' ? 'Low' : 'Medium'
      });
      $('fRes2').textContent = t('fac.savedBody', {
        no: row.wo_no,
        loc: row.location,
        status: row.status,
        tech: row.assigned_to
      });
      toast(t('fac.saved'));
      load();
    } catch (e) {
      $('fRes2').textContent = '❌ ' + e.message;
    }
  };
}
