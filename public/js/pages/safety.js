/* Halaman Safety: inspeksi, KPI safety, JSA. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, toast, pill } from '../ui.js';
import { actionsCell, statusPicker, addButton } from '../crud.js';
import { jsaText } from '../calc.js';
import { t } from '../i18n.js';

export const id = 'safety';

function renderKpiList(map) {
  const keys = ['work_hours', 'ltifr', 'trifr', 'safety_talk', 'new_training'];
  return html(
    `<h3>${esc(t('safety.yearStats'))}</h3>` +
    keys.map((k) => {
      const r = map[k];
      return r ? `<div class="kpi"><span class="kpi-label">${esc(r.label)}</span><b class="kpi-val">${esc(r.value)}</b></div>` : '';
    }).join('')
  );
}

export async function load() {
  const d = await api.get('/api/safety');
  const map = Object.fromEntries((d.kpis || []).map((k) => [k.key, k]));
  renderStats('safetyStats', [
    { num: map.lti?.value || 'N/A', lbl: map.lti?.label || t('safety.fallback.lti'), color: 'green' },
    { num: map.near_miss?.value || 'N/A', lbl: map.near_miss?.label || t('safety.fallback.near'), color: 'orange' },
    { num: map.permits?.value || 'N/A', lbl: map.permits?.label || t('safety.fallback.permit') },
    { num: map.ppe?.value || 'N/A', lbl: map.ppe?.label || t('safety.fallback.ppe'), color: 'blue' }
  ]);

  renderInto(
    'inspTable',
    table(
      [t('safety.col.date'), t('safety.col.area'), t('safety.col.finding'), t('safety.col.pic'), t('home.col.status'), t('energy.col.action')],
      (d.inspections || []).map((r) =>
        row([r.inspect_date, r.area, r.finding, r.pic || '-', statusPicker('safety_inspections', r), actionsCell('safety_inspections', r)]).__html
      ),
      { empty: t('safety.empty') }
    )
  );
  renderInto('inspAdd', addButton('safety_inspections', t('safety.add')));

  renderInto('safetyKpiList', renderKpiList(map));
}

export function mount() {
  $('btnJsa').onclick = async () => {
    const result = jsaText($('sJob').value, $('sDesc').value, Number($('sPekerja').value), $('sAlat').value);
    $('sRes').textContent = result;
    await api.post('/api/safety/jsa', {
      job_type: $('sJob').value,
      location_desc: $('sDesc').value,
      workers: Number($('sPekerja').value),
      tools: $('sAlat').value,
      result
    });
    toast(t('safety.saved'));
    load();
  };
}
