/* Halaman Report: rekap rentang waktu. */
import { api } from '../api.js';
import { $, renderInto, html, esc, fmtNum } from '../ui.js';
import { t, localizeMonthText } from '../i18n.js';

export const id = 'report';

export async function load() {
  const from = $('rFrom')?.value || '2026-01';
  const to = $('rTo')?.value || '2026-12';
  const d = await api.get(`/api/report?from=${from}&to=${to}`);

  const el = $('reportRes');
  if (el) el.removeAttribute('data-i18n');
  const peak = d.peak ? t('report.peak', { label: localizeMonthText(d.peak.label) }) : '';
  renderInto(
    'reportRes',
    html(
      esc(t('report.body', {
        from: d.from,
        to: d.to,
        kwh: fmtNum(Math.round(d.totals.kwh)),
        gas: fmtNum(d.totals.gas),
        water: fmtNum(d.totals.water),
        costPower: fmtNum(Math.round(d.totals.biayaListrik)),
        costGas: fmtNum(Math.round(d.totals.biayaGas)),
        costWater: fmtNum(Math.round(d.totals.biayaAir)),
        cost: fmtNum(Math.round(d.totals.biaya)),
        co2: fmtNum(Number(d.totals.co2Ton).toFixed(1)),
        wo: d.workOrders.map((w) => `${w.module}/${w.status}=${w.n}`).join(', ') || '-',
        tickets: d.tickets.map((ticket) => `${ticket.status}=${ticket.n}`).join(', ') || '-',
        months: d.monthly.length,
        peak,
        at: d.generatedAt
      }))
    )
  );
}

export function mount() {
  $('btnReport').onclick = () => load();
}
