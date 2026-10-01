/* Halaman Dashboard: data ringkasan dari /api/dashboard.
   Mode tamu memakai /api/public/dashboard (tanpa alert & work order). */
import { api } from '../api.js';
import { $, renderStats, renderInto, table, row, html, esc, tagClass, tag, pill, monthLabel, fmtNum } from '../ui.js';
import { t, localizeMonthText } from '../i18n.js';

export const id = 'home';

const fmt = fmtNum;

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
  if (!ed.kwh) return { lbl: t('home.kpi.kwh'), empty: true };
  const month = localizeMonthText(ed.month);
  const prev = localizeMonthText(ed.prevMonth) || t('home.kpi.prevMonth');
  const pctText = ed.pct != null ? `${ed.pct >= 0 ? '▲' : '▼'} ${Math.abs(ed.pct).toFixed(1)}%` : null;
  const cycle = [
    ...(pctText
      ? [{ num: pctText, lbl: t('home.kpi.elecMonth', { month }).trim(), cls: ed.pct > 0 ? 'orange' : 'green' }]
      : []),
    { num: fmt(Math.round(ed.kwh)), lbl: t('home.kpi.kwh'), cls: '' },
    { num: `${ed.mwh.toFixed(1)} MWh`, lbl: t('home.kpi.mwh'), cls: 'blue' },
    { num: `Rp ${fmt(Math.round(ed.cost))}`, lbl: t('home.kpi.cost'), cls: 'purple' },
    { num: `${ed.co2.toFixed(1)} ton`, lbl: t('home.kpi.co2'), cls: 'red' }
  ];
  const first = cycle[0];
  return {
    num: first.num,
    lbl: pctText
      ? t('home.kpi.elecCompare', { month, year: ed.year || '', prev }).replace(/\s+/g, ' ').trim()
      : t('home.kpi.kwh'),
    color: first.cls || '',
    cycle
  };
}

function energySummary(ed) {
  const when = [localizeMonthText(ed.month), ed.year].filter(Boolean).join(' ');
  const stats = [
    {
      num: fmt(Math.round(ed.kwh)),
      lbl: when ? t('home.kpi.kwhWhen', { when }) : t('home.kpi.kwh')
    }
  ];
  if (ed.pct != null) {
    stats.push({
      num: `${ed.pct >= 0 ? '▲' : '▼'} ${Math.abs(ed.pct).toFixed(1)}%`,
      lbl: t('home.kpi.vsPrev', { month: localizeMonthText(ed.prevMonth) || t('home.kpi.prevMonth') }),
      color: ed.pct > 0 ? 'orange' : 'green'
    });
  }
  /* Rp 0 / 0 ton berarti tarif atau faktor emisi belum diisi, bukan konsumsi nol. */
  if (Number(ed.cost) > 0) {
    stats.push({ num: `Rp ${fmt(Math.round(ed.cost))}`, lbl: t('home.kpi.cost'), color: 'purple' });
  }
  if (Number(ed.co2) > 0) {
    stats.push({ num: `${Number(ed.co2).toFixed(1)} ton`, lbl: t('home.kpi.co2') });
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
  if (safety) stats.push({ num: safety, lbl: t('home.kpi.safety'), color: 'green' });
  if (hasEnergy) {
    const when = [localizeMonthText(ed.month), ed.year].filter(Boolean).join(' ');
    stats.push({
      num: fmt(Math.round(ed.kwh)),
      lbl: when ? t('home.kpi.kwhWhen', { when }) : t('home.kpi.kwh')
    });
  }
  if (itOpen) stats.push({ num: itOpen, lbl: t('home.kpi.itOpen'), color: 'blue' });
  if (uptime) stats.push({ num: uptime, lbl: t('home.kpi.uptime'), color: 'purple' });
  return stats;
}

function renderEnergyChart(id, rows) {
  const data = rows || [];
  const el = $(id);
  if (!data.length) {
    if (el) el.classList.add('is-empty');
    renderInto(id, html(`<p class="small">${esc(t('home.chartEmpty'))}</p>`));
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
    siteStat(d.kpis.safety_compliance?.value, t('home.kpi.safety'), 'green'),
    energyCycle(ed),
    siteStat(d.kpis.it_open?.value, t('home.kpi.itOpen'), 'blue'),
    siteStat(d.kpis.facility_uptime?.value, t('home.kpi.uptime'), 'purple')
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
        .join('') || `<p class="small">${esc(t('home.noAlerts'))}</p>`
    )
  );

  renderInto(
    'homeWOs',
    table(
      [t('home.col.no'), t('home.col.module'), t('home.col.desc'), t('home.col.status'), t('home.col.priority')],
      (d.workOrders || []).map((w) =>
        row([w.wo_no, tag(w.module), w.description, pill(w.status), w.priority])
      ),
      { empty: t('home.noWo') }
    )
  );

  const targets = d.targets || {};
  renderInto(
    'targetList',
    html(
      (targets.items || [])
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
