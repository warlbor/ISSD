/* Halaman Dashboard: data ringkasan dari /api/dashboard. */
import { api } from '../api.js';
import { $, renderStats, renderInto, table, row, html, esc, tagClass, tag, pill, kpiBoxes, monthLabel } from '../ui.js';

export const id = 'home';

function fmt(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

export async function load() {
  const d = await api.get('/api/dashboard');
  const ed = d.energyDelta || {};
  const pctText = ed.pct != null ? `${ed.pct >= 0 ? '▲' : '▼'} ${Math.abs(ed.pct).toFixed(1)}%` : '—';

  const homeStats = [
    { num: d.kpis.safety_compliance?.value || 'N/A', lbl: 'Kepatuhan Safety Bulan Ini', color: 'green' },
    {
      num: pctText,
      lbl: `Listrik ${ed.month || ''} ${ed.year || ''} vs ${ed.prevMonth || 'prev'}`,
      color: ed.pct > 0 ? 'orange' : 'green',
      cycle: ed.kwh
        ? [
            { num: pctText, lbl: `Listrik ${ed.month}`, cls: ed.pct > 0 ? 'orange' : 'green' },
            { num: fmt(Math.round(ed.kwh)), lbl: 'kWh Listrik', cls: '' },
            { num: `${ed.mwh.toFixed(1)} MWh`, lbl: 'Mega Watt hour', cls: 'blue' },
            { num: `Rp ${fmt(Math.round(ed.cost))}`, lbl: 'Biaya Listrik', cls: 'purple' },
            { num: `${ed.co2.toFixed(1)} ton`, lbl: 'Estimasi CO₂', cls: 'red' }
          ]
        : null
    },
    { num: d.kpis.it_open?.value || 'N/A', lbl: 'Tiket IT Open', color: 'blue' },
    { num: d.kpis.facility_uptime?.value || 'N/A', lbl: 'Uptime Facility', color: 'purple' }
  ];
  renderStats('homeStats', homeStats);

  const chartMax = Math.max(700, ...(d.energy || []).map((r) => Math.round(r.electricity_kwh / 1000)));
  renderInto(
    'energyChart',
    html(
      (d.energy || []).map((r) => {
        const v = Math.round(r.electricity_kwh / 1000);
        const h = (v / chartMax) * 130 + 8;
        return `<div class="bar" style="height:${h}px"><span class="bar-val">${fmt(v)}</span><span class="bar-label">${monthLabel(r.month)}</span></div>`;
      }).join('')
    )
  );

  renderInto(
    'homeAlerts',
    html(
      (d.alerts || [])
        .map((a) => {
          const cls = a.severity === 'ok' ? 'green' : a.severity === 'danger' ? 'red' : 'orange';
          return `<div class="kpi">
            <span class="kpi-label"><span class="tag ${tagClass(a.module)}">${esc(a.module)}</span> ${esc(a.message)}</span>
            <b class="kpi-val ${cls}">${esc(a.extra || '')}</b>
          </div>`;
        })
        .join('') || '<p class="small">Tidak ada alert aktif.</p>'
    )
  );

  renderInto(
    'homeWOs',
    table(
      ['No', 'Modul', 'Uraian', 'Status', 'Prioritas'],
      (d.workOrders || []).map((w) =>
        row([w.wo_no, tag(w.module), w.description, pill(w.status), w.priority])
      ),
      { empty: 'Belum ada work order terbaru.' }
    )
  );

  const t = d.targets || {};
  renderInto(
    'targetList',
    html(
      (t.items || [])
        .map((i) => `<div class="kpi"><span class="kpi-label">${esc(i.label)}</span><b class="kpi-val ${i.color || ''}">${esc(i.value)}</b></div>`)
        .join('') || ''
    )
  );
}

export function mount() {}

/* Versi publik: ambil ringkasan dari /api/public/dashboard.
   Alert internal dan daftar work order sengaja tidak dirender (panelnya
   disembunyikan lewat CSS class is-public di body). */
export async function loadPublic() {
  const d = await api.publicGet('/api/public/dashboard');
  const ed = d.energyDelta || {};
  const pctText = ed.pct != null ? `${ed.pct >= 0 ? '▲' : '▼'} ${Math.abs(ed.pct).toFixed(1)}%` : '—';

  const homeStats = [
    { num: d.kpis.safety_compliance?.value || 'N/A', lbl: 'Kepatuhan Safety Bulan Ini', color: 'green' },
    {
      num: pctText,
      lbl: `Listrik ${ed.month || ''} ${ed.year || ''} vs ${ed.prevMonth || 'prev'}`,
      color: ed.pct > 0 ? 'orange' : 'green',
      cycle: ed.kwh
        ? [
            { num: pctText, lbl: `Listrik ${ed.month}`, cls: ed.pct > 0 ? 'orange' : 'green' },
            { num: fmt(Math.round(ed.kwh)), lbl: 'kWh Listrik', cls: '' },
            { num: `Rp ${fmt(Math.round(ed.cost))}`, lbl: 'Biaya Listrik', cls: 'purple' },
            { num: `${ed.co2.toFixed(1)} ton`, lbl: 'Estimasi CO₂', cls: 'red' }
          ]
        : null
    },
    { num: d.kpis.it_open?.value || 'N/A', lbl: 'Tiket IT Open', color: 'blue' },
    { num: d.kpis.facility_uptime?.value || 'N/A', lbl: 'Uptime Facility', color: 'purple' }
  ];
  renderStats('homeStats', homeStats);

  const chartMax = Math.max(700, ...(d.energy || []).map((r) => Math.round(r.electricity_kwh / 1000)));
  renderInto(
    'energyChart',
    html(
      (d.energy || []).map((r) => {
        const v = Math.round(r.electricity_kwh / 1000);
        const h = (v / chartMax) * 130 + 8;
        return `<div class="bar" style="height:${h}px"><span class="bar-val">${fmt(v)}</span><span class="bar-label">${monthLabel(r.month)}</span></div>`;
      }).join('')
    )
  );
}

export function mountPublic() {}
