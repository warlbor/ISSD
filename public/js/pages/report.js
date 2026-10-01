/* Halaman Report: rekap rentang waktu. */
import { api } from '../api.js';
import { $, renderInto, table, row, html, esc, fmtNum } from '../ui.js';

export const id = 'report';

export async function load() {
  const from = $('rFrom')?.value || '2026-01';
  const to = $('rTo')?.value || '2026-12';
  const d = await api.get(`/api/report?from=${from}&to=${to}`);

  renderInto(
    'reportRes',
    html(
      `📑 LAPORAN ISSD ${esc(d.from)} s/d ${esc(d.to)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Total Listrik : ${fmtNum(Math.round(d.totals.kwh))} kWh\n` +
      `Total Gas     : ${fmtNum(d.totals.gas)} MMbtu\n` +
      `Total Air     : ${fmtNum(d.totals.water)} m³\n` +
      `Biaya Listrik : Rp ${fmtNum(Math.round(d.totals.biayaListrik))}\n` +
      `Biaya Gas     : Rp ${fmtNum(Math.round(d.totals.biayaGas))}\n` +
      `Biaya Air     : Rp ${fmtNum(Math.round(d.totals.biayaAir))}\n` +
      `Total Biaya   : Rp ${fmtNum(Math.round(d.totals.biaya))}\n` +
      `CO₂           : ${fmtNum(d.totals.co2Ton.toFixed(1))} ton\n` +
      `Work orders   : ${d.workOrders.map((w) => `${esc(w.module)}/${esc(w.status)}=${w.n}`).join(', ') || '-'}\n` +
      `Tiket IT      : ${d.tickets.map((t) => `${esc(t.status)}=${t.n}`).join(', ') || '-'}\n` +
      `Baris energi  : ${d.monthly.length} bulan${d.peak ? ` · puncak: ${esc(d.peak.label)}` : ''}\n` +
      `Dibuat        : ${esc(d.generatedAt)}`
    )
  );
}

export function mount() {
  $('btnReport').onclick = () => load();
}
