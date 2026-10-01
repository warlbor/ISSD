/* Halaman Dashboard: data ringkasan dari /api/dashboard.
   Mode tamu memakai /api/public/dashboard (tanpa alert & work order). */
import { api } from '../api.js';
import { $, renderStats, renderInto, table, row, html, esc, tagClass, tag, pill, monthLabel } from '../ui.js';

export const id = 'home';

function fmt(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

/* Nilai placeholder dari purge data dummy — jangan ditampilkan sebagai angka. */
function blankKpi(value) {
  const v = String(value ?? '').trim();
  return !v || /^(n\/a|na|—|-)$/i.test(v);
}

function siteStat(value, lbl, color) {
  if (blankKpi(value)) return { lbl, empty: true };
  return { num: value, lbl, color };
}

function energyCycle(ed) {
  if (!ed.kwh) return { lbl: 'kWh Listrik', empty: true };
  const pctText = ed.pct != null ? `${ed.pct >= 0 ? '▲' : '▼'} ${Math.abs(ed.pct).toFixed(1)}%` : null;
  const cycle = [
    ...(pctText
      ? [{ num: pctText, lbl: `Listrik ${ed.month || ''}`.trim(), cls: ed.pct > 0 ? 'orange' : 'green' }]
      : []),
    { num: fmt(Math.round(ed.kwh)), lbl: 'kWh Listrik', cls: '' },
    { num: `${ed.mwh.toFixed(1)} MWh`, lbl: 'Mega Watt hour', cls: 'blue' },
    { num: `Rp ${fmt(Math.round(ed.cost))}`, lbl: 'Biaya Listrik', cls: 'purple' },
    { num: `${ed.co2.toFixed(1)} ton`, lbl: 'Estimasi CO₂', cls: 'red' }
  ];
  const first = cycle[0];
  return {
    num: first.num,
    lbl: pctText
      ? `Listrik ${ed.month || ''} ${ed.year || ''} vs ${ed.prevMonth || 'bulan lalu'}`.replace(/\s+/g, ' ').trim()
      : 'kWh Listrik',
    color: first.cls || '',
    cycle
  };
}

function energySummary(ed) {
  const when = [ed.month, ed.year].filter(Boolean).join(' ');
  const stats = [
    {
      num: fmt(Math.round(ed.kwh)),
      lbl: when ? `kWh Listrik · ${when}` : 'kWh Listrik'
    }
  ];
  if (ed.pct != null) {
    stats.push({
      num: `${ed.pct >= 0 ? '▲' : '▼'} ${Math.abs(ed.pct).toFixed(1)}%`,
      lbl: `vs ${ed.prevMonth || 'bulan lalu'}`,
      color: ed.pct > 0 ? 'orange' : 'green'
    });
  }
  /* Rp 0 / 0 ton berarti tarif atau faktor emisi belum diisi, bukan konsumsi nol. */
  if (Number(ed.cost) > 0) {
    stats.push({ num: `Rp ${fmt(Math.round(ed.cost))}`, lbl: 'Biaya Listrik', color: 'purple' });
  }
  if (Number(ed.co2) > 0) {
    stats.push({ num: `${Number(ed.co2).toFixed(1)} ton`, lbl: 'Estimasi CO₂' });
  }
  return stats;
}

/* Ringkasan tamu. KPI "N/A" disembunyikan. Bila slot site kosong, baris atas
   diisi angka listrik supaya tidak tersisa strip kosong. */
function publicStats(d) {
  const k = d.kpis || {};
  const ed = d.energyDelta;
  const hasEnergy = !!(ed && ed.kwh != null && Number(ed.kwh) > 0);
  const safety = blankKpi(k.safety_compliance?.value) ? null : k.safety_compliance.value;
  const itOpen = blankKpi(k.it_open?.value) ? null : k.it_open.value;
  const uptime = blankKpi(k.facility_uptime?.value) ? null : k.facility_uptime.value;

  if (!safety && !itOpen && !uptime && hasEnergy) return energySummary(ed);

  const stats = [];
  if (safety) stats.push({ num: safety, lbl: 'Kepatuhan Safety Bulan Ini', color: 'green' });
  if (hasEnergy) {
    const when = [ed.month, ed.year].filter(Boolean).join(' ');
    stats.push({
      num: fmt(Math.round(ed.kwh)),
      lbl: when ? `kWh Listrik · ${when}` : 'kWh Listrik'
    });
  }
  if (itOpen) stats.push({ num: itOpen, lbl: 'Tiket IT Open', color: 'blue' });
  if (uptime) stats.push({ num: uptime, lbl: 'Uptime Facility', color: 'purple' });
  return stats;
}

function renderEnergyChart(id, rows) {
  const data = rows || [];
  const el = $(id);
  if (!data.length) {
    if (el) el.classList.add('is-empty');
    renderInto(id, html('<p class="small">Belum ada data konsumsi listrik.</p>'));
    return;
  }
  if (el) el.classList.remove('is-empty');
  const chartMax = Math.max(700, ...data.map((r) => Math.round(r.electricity_kwh / 1000)));
  renderInto(
    id,
    html(
      data
        .map((r) => {
          const v = Math.round(r.electricity_kwh / 1000);
          const h = (v / chartMax) * 130 + 8;
          return `<div class="bar" style="height:${h}px"><span class="bar-val">${fmt(v)}</span><span class="bar-label">${monthLabel(r.month)}</span></div>`;
        })
        .join('')
    )
  );
}

export async function load() {
  const d = await api.get('/api/dashboard');
  const ed = d.energyDelta || {};

  renderStats('homeStats', [
    siteStat(d.kpis.safety_compliance?.value, 'Kepatuhan Safety Bulan Ini', 'green'),
    energyCycle(ed),
    siteStat(d.kpis.it_open?.value, 'Tiket IT Open', 'blue'),
    siteStat(d.kpis.facility_uptime?.value, 'Uptime Facility', 'purple')
  ]);

  renderEnergyChart('energyChart', d.energy);

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

/* Versi publik: KPI yang berisi data, grafik listrik, dan dua aksi tamu.
   Alert internal dan daftar work order tetap di panel staff-only. */
export async function loadPublic() {
  const d = await api.publicGet('/api/public/dashboard');
  renderStats('homeStats', publicStats(d));
  renderEnergyChart('publicEnergyChart', d.energy);
}

export function mountPublic() {}
