/* Halaman Energy: kalkulator dan tabel dinamis bulan. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, fmtNum, monthLabel, toast, toastOk } from '../ui.js';
import { addButton, actionsCell } from '../crud.js';
import { calcListrik, calcGas, calcEff } from '../calc.js';
import { t, localizeMonthText, tx, getLang, localeTag } from '../i18n.js';

export const id = 'energy';

/* Progress bar target penghematan listrik: YTD tahun berjalan vs periode yang
   sama tahun sebelumnya, terhadap target_hemat_listrik di Pengaturan. */
function renderTarget(s, cur, active) {
  const el = $('energyTarget');
  if (!el) return;
  const target = Number(s.target_hemat_listrik) || 0;
  if (!target || !cur.year) {
    el.innerHTML = `<p class="small">${esc(t('energy.needTarget'))}</p>`;
    return;
  }
  const sumKwh = (rows) => rows.reduce((a, r) => a + (r.electricity_kwh || 0), 0);
  // Bandingkan hanya bulan yang datanya ada di KEDUA tahun supaya adil
  // (mis. Jan 2025 belum ada di laporan → Jan 2026 tidak ikut YTD).
  const monthsBoth = [];
  for (let m = 1; m <= cur.month; m++) {
    const hasThis = active.some((r) => r.year === cur.year && r.month === m);
    const hasLast = active.some((r) => r.year === cur.year - 1 && r.month === m);
    if (hasThis && hasLast) monthsBoth.push(m);
  }
  const ytdThis = sumKwh(active.filter((r) => r.year === cur.year && monthsBoth.includes(r.month)));
  const ytdLast = sumKwh(active.filter((r) => r.year === cur.year - 1 && monthsBoth.includes(r.month)));
  if (!ytdThis || !ytdLast) {
    el.innerHTML = `<p class="small">${esc(t('energy.needYtd', { year: cur.year, prev: cur.year - 1 }))}</p>`;
    return;
  }
  const saving = ((ytdLast - ytdThis) / ytdLast) * 100; // positif = hemat
  const progress = Math.max(0, Math.min(100, (saving / target) * 100));
  const color = saving >= target ? '#22c55e' : saving >= 0 ? '#38bdf8' : '#ef4444';
  const status = saving >= target ? t('energy.targetHit') : saving >= 0 ? t('energy.targetMiss') : t('energy.targetUp');
  const periodTxt = monthsBoth.map((m) => monthLabel(m)).join(', ');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:8px">
      <span style="font-size:22px;font-weight:800;color:${color}">${saving.toFixed(1)}%</span>
      <span class="small">${esc(t('energy.targetMeta', { status, target: fmtNum(target) }))}</span>
    </div>
    <div style="background:var(--line);border-radius:999px;height:12px;overflow:hidden">
      <div style="width:${progress}%;height:100%;background:${color};border-radius:999px;transition:width .4s"></div>
    </div>
    <p class="small mt-8">${esc(t('energy.ytdLine', { period: periodTxt, now: fmtNum(Math.round(ytdThis)), year: cur.year, prevKwh: fmtNum(Math.round(ytdLast)), prevYear: cur.year - 1 }))}</p>`;
}

function recalcListrik() {
  const kwh = parseFloat($('ekwh').value) || 0;
  const base = parseFloat($('ebase').value) || 0;
  const tarif = parseFloat($('etarif').value) || 0;
  $('eRes').textContent = calcListrik(kwh, base, tarif);
}

function recalcGas() {
  const g = parseFloat($('gas1').value) || 0;
  const h = parseFloat($('gas2').value) || 0;
  const k = parseFloat($('gas3').value) || 0;
  $('eRes2').textContent = calcGas(g, h, k);
}

function recalcEff() {
  const a = parseFloat($('eff1').value) || 1;
  const b = parseFloat($('eff2').value) || 0;
  const u = parseFloat($('eff3').value) || 1;
  $('eRes3').textContent = calcEff(a, b, u);
}

function bindTabs() {
  document.querySelectorAll('[data-etab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ['et0', 'et1', 'et2'].forEach((id, k) => $(id).classList.toggle('hidden', k !== Number(btn.dataset.etab)));
      btn.parentNode.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      resolve(btoa(binary));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function importEnergy() {
  const input = $('energyFile');
  const resultEl = $('importResult');
  if (!input.files[0]) {
    resultEl.textContent = t('energy.pickFile');
    return;
  }
  try {
    const base64 = await fileToBase64(input.files[0]);
    const res = await api.post('/api/energy/import', { file: base64 });
    const lines = [t('energy.importMonthly', { n: res.monthly }), t('energy.importDepts', { n: res.departments })];
    if (res.errors.length) lines.push(...res.errors.map((line) => tx(line)));
    resultEl.textContent = lines.join('\n');
    await load();
  } catch (err) {
    resultEl.textContent = err.message;
  }
}

function saveEnergy() {
  const body = {
    year: Number($('ey').value),
    month: Number($('em').value),
    electricity_kwh: Number($('eKwhSave').value),
    gas_m3: Number($('eGasSave').value),
    water_m3: Number($('eWaterSave').value),
    note: $('eNoteSave').value || null
  };
  api.post('/api/energy/monthly', body).then(() => {
    toast(t('energy.saved'));
    load();
  }).catch((err) => toast(err.message));
}

export async function load() {
  const d = await api.get('/api/energy');
  const cur = d.current || {};
  const prev = d.previous || {};
  if (cur.electricity_kwh) {
    $('ekwh').value = cur.electricity_kwh;
    $('ebase').value = prev.electricity_kwh || 0;
    $('gas1').value = cur.gas_m3 || 0;
  }
  const s = d.settings || {};
  const delta = d.delta || {};
  const cost = (cur.electricity_kwh || 0) * (s.tarif_listrik || 0) + (cur.gas_m3 || 0) * (s.harga_gas || 0) + (cur.water_m3 || 0) * (s.harga_air || 0);
  // YoY hanya muncul bila ada data bulan yang sama tahun sebelumnya.
  const yoyVariant = delta.yoyPct !== null && delta.yoyPct !== undefined
    ? [{ num: `${delta.yoyPct >= 0 ? '+' : ''}${fmtNum(delta.yoyPct)}%`, lbl: t('energy.kpi.yoy', { label: localizeMonthText(delta.yoyLabel) || t('energy.kpi.yoyFallback') }) }]
    : [];

  renderStats('energyStats', [
    { num: fmtNum(cur.electricity_kwh || 0), lbl: t('energy.kpi.kwhMonth', { month: monthLabel(cur.month) || '' }), cycle: [
      { num: fmtNum(cur.electricity_kwh || 0), lbl: t('home.kpi.kwh') },
      { num: `${((cur.electricity_kwh || 0) / 1000).toFixed(1)} MWh`, lbl: t('home.kpi.mwh') },
      { num: `Rp ${fmtNum(Math.round((cur.electricity_kwh || 0) * (s.tarif_listrik || 0)))}`, lbl: t('home.kpi.cost') },
      ...yoyVariant
    ]},
    { num: fmtNum(cur.gas_m3 || 0), lbl: t('energy.kpi.gas') },
    { num: fmtNum(cur.water_m3 || 0), lbl: t('energy.kpi.water'), color: 'blue' },
    { num: `Rp ${fmtNum(Math.round(cost / 1e6))} ${t('energy.unit.mio')}`, lbl: t('energy.kpi.cost'), color: 'green', cycle: [
      { num: `Rp ${fmtNum(Math.round(cost / 1e6))} ${t('energy.unit.mio')}`, lbl: t('energy.kpi.cost') },
      { num: `${fmtNum(delta.co2 || 0)} ton`, lbl: t('energy.kpi.co2') }
    ]}
  ]);

  renderTarget(s, cur, d.active || []);

  // Departemen & pemilihan bulan
  const deptMonthSel = $('deptMonth');
  if (deptMonthSel) {
    // Nilai option berformat YYYY-MM, sama dengan yang dibaca handler /api/energy.
    const selected = d.deptMonth ? `${d.deptMonth.year}-${String(d.deptMonth.month).padStart(2, '0')}` : '';
    const options = (d.deptMonths || [])
      .map((m) => `<option value="${esc(m)}"${m === selected ? ' selected' : ''}>${esc(m)}</option>`)
      .join('');
    deptMonthSel.innerHTML = `<option value="">${esc(t('energy.all'))}</option>${options}`;
  }

  renderInto(
    'deptTable',
    table(
      [t('energy.col.dept'), 'kWh', t('energy.col.share'), t('energy.col.vsPrev'), t('energy.col.action')],
      (d.departments || []).map((r) =>
        row([r.department, fmtNum(r.kwh), `${r.share_pct || '-'}%`, `${r.vs_prev_pct || '-'}%`, actionsCell('energy_departments', r)]).__html
      ),
      { empty: t('energy.deptEmpty') }
    )
  );
  renderInto('deptAdd', addButton('energy_departments', t('energy.addDept')));

  const ytd = (d.active || []).reduce(
    (a, r) => ({ k: a.k + r.electricity_kwh, g: a.g + r.gas_m3, w: a.w + r.water_m3 }),
    { k: 0, g: 0, w: 0 }
  );
  // Peta kWh tahun sebelumnya per bulan, untuk kolom "vs Thn Lalu".
  const kwhLastYear = new Map(
    (d.active || []).filter((r) => r.year === cur.year - 1).map((r) => [r.month, r.electricity_kwh])
  );
  renderInto(
    'monthTable',
    table(
      [t('energy.col.month'), t('energy.col.kwh'), t('energy.col.yoy'), t('energy.col.gas'), t('energy.col.water'), t('energy.col.action')],
      (d.monthly || []).map((r) => {
        const highlighted = r.id === cur.id;
        const last = kwhLastYear.get(r.month);
        const yoy = last ? ((r.electricity_kwh - last) / last) * 100 : null;
        const yoyTxt = yoy === null
          ? '—'
          : `<span style="color:${yoy > 0 ? '#ef4444' : '#22c55e'}">${yoy > 0 ? '▲' : '▼'} ${Math.abs(yoy).toFixed(1)}%</span>`;
        return `<tr${highlighted ? ' style="background:#eff6ff;font-weight:700"' : ''}${r.excluded ? ' class="excluded"' : ''}>
          <td>${monthLabel(r.month)} ${r.year}${r.note ? ' *' : ''}</td>
          <td>${fmtNum(r.electricity_kwh)}</td>
          <td>${yoyTxt}</td>
          <td>${fmtNum(r.gas_m3)}</td>
          <td>${fmtNum(r.water_m3)}</td>
          <td>${actionsCell('energy_monthly', r).__html}</td>
        </tr>`;
      }).concat([`<tr style="background:#f0fdf4"><td><b>${esc(t('energy.ytd'))}</b></td><td><b>${fmtNum(Math.round(ytd.k))}</b></td><td></td><td><b>${fmtNum(ytd.g)}</b></td><td><b>${fmtNum(ytd.w)}</b></td><td></td></tr>`])
    )
  );

  recalcListrik();
  recalcGas();
  loadLocations();
  loadFuels();
}

/* ===== Doughnut air seluruh pabrik (irisan yang sama dengan pie Excel) ===== */
const PIE_COLORS = {
  production: '#2ee6c7',
  boiler: '#38bdf8',
  otherPhase2: '#f5b942',
  otherPhase1: '#c4b5fd',
  technology: '#fb7185',
  quality: '#a3e635'
};

let waterPieSeq = 0;

function fmtPct(ratio) {
  return `${(Number(ratio) * 100).toLocaleString(localeTag(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function sliceName(slice) {
  const key = `energy.pie.cat.${slice.key}`;
  const name = t(key);
  if (name !== key) return name;
  return getLang() === 'en' ? (slice.labelEn || slice.label) : (slice.labelId || slice.label);
}

function pieMonthText(data) {
  if (!data || !data.year || !data.month) return '';
  return `${monthLabel(data.month)} ${data.year}`;
}

function donutSvg(slices, muted) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const track = muted ? 'rgba(148,184,214,0.12)' : 'rgba(148,184,214,0.18)';
  let cursor = 0;
  const rings = (slices || []).map((slice) => {
    const len = Math.max(0, Number(slice.percent) || 0) * circ;
    const start = cursor;
    cursor += len;
    if (len < 0.4) return '';
    const color = PIE_COLORS[slice.key] || '#8ea3bb';
    const full = len >= circ - 0.4;
    const dash = full ? '' : ` stroke-dasharray="${len.toFixed(3)} ${(circ - len).toFixed(3)}" stroke-dashoffset="${(-start).toFixed(3)}"`;
    return `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="16"${dash}></circle>`;
  }).join('');
  return `<svg class="water-pie-svg" viewBox="0 0 120 120" aria-hidden="true">
    <g transform="rotate(-90 60 60)">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${track}" stroke-width="16"></circle>
      ${rings}
    </g>
  </svg>`;
}

function renderWaterPie(data) {
  const el = $('waterPie');
  if (!el) return;
  const empty = !data || data.empty || !Number(data.total);
  el.classList.toggle('is-empty', empty);
  const when = pieMonthText(data);
  const title = t('energy.pie.title');
  const excel = data && data.title ? data.title : '';
  const totalTxt = empty ? '—' : fmtNum(data.total);
  const aria = empty
    ? (when ? t('energy.pie.empty', { month: when }) : t('energy.pie.emptyPlain'))
    : t('energy.pie.aria', { title, month: when, total: fmtNum(data.total) });
  const legend = empty
    ? `<p class="small water-pie-note">${esc(when ? t('energy.pie.empty', { month: when }) : t('energy.pie.emptyPlain'))}</p>`
    : `<ul class="water-pie-legend">${(data.slices || []).map((slice) => `
        <li>
          <span class="water-pie-swatch" style="background:${PIE_COLORS[slice.key] || '#8ea3bb'}"></span>
          <span class="water-pie-label">
            <span class="water-pie-name">${esc(sliceName(slice))}</span>
            <span class="water-pie-zh">${esc(slice.label || '')}</span>
          </span>
          <span class="water-pie-num"><b>${esc(fmtNum(slice.value))}</b><span>${esc(fmtPct(slice.percent))}</span></span>
        </li>`).join('')}</ul>`;
  renderInto('waterPie', html(`
    <div class="water-pie-head">
      <h4>${esc(title)}</h4>
      ${excel ? `<span class="water-pie-excel">${esc(excel)}</span>` : ''}
    </div>
    <div class="water-pie-chart" role="img" aria-label="${esc(aria)}">
      ${donutSvg(empty ? [] : data.slices, empty)}
      <div class="water-pie-center">
        <strong>${esc(totalTxt)}</strong>
        <span class="water-pie-unit">m³</span>
        ${when ? `<span class="water-pie-when">${esc(when)}</span>` : ''}
      </div>
    </div>
    ${legend}
  `));
}

async function loadWaterPie(month) {
  const seq = ++waterPieSeq;
  if (!month) {
    renderWaterPie(null);
    return;
  }
  try {
    const data = await api.get(`/api/energy/water-pie?month=${encodeURIComponent(month)}`);
    if (seq !== waterPieSeq) return;
    renderWaterPie(data);
  } catch (err) {
    if (seq !== waterPieSeq) return;
    renderWaterPie(null);
    toast(tx(err.message));
  }
}

/* ===== Pemakaian per lokasi/meter + selisih vs bulan sebelumnya ===== */
async function loadLocations(month) {
  try {
    const d = await api.get(`/api/energy/locations${month ? `?month=${encodeURIComponent(month)}` : ''}`);
    const sel = $('locMonth');
    if (sel && d.months.length) {
      const selected = d.month ? `${d.month.year}-${String(d.month.month).padStart(2, '0')}` : '';
      sel.innerHTML = d.months
        .map((m) => `<option value="${esc(m)}"${m === selected ? ' selected' : ''}>${esc(m)}</option>`)
        .join('');
      if (!sel.dataset.wired) {
        sel.dataset.wired = '1';
        sel.onchange = () => loadLocations(sel.value);
      }
    }
    const deltaTxt = (r) => {
      if (r.delta_pct === null || r.delta_pct === undefined) return '—';
      const up = r.delta_pct > 0;
      const color = up ? '#ef4444' : r.delta_pct < 0 ? '#22c55e' : '#64748b';
      return `<b style="color:${color}">${up ? '▲' : r.delta_pct < 0 ? '▼' : '•'} ${Math.abs(r.delta_pct).toFixed(1)}%</b> <span class="small">${up ? '+' : ''}${fmtNum(Math.round((r.qty - (r.prev_qty || 0)) * 10) / 10)}</span>`;
    };
    const makeTable = (source, caption) => {
      const rows = (d.locations || []).filter((r) => r.source === source);
      if (!rows.length) return '';
      return `<p class="small" style="margin:8px 0 4px"><b>${caption}</b></p>` + table(
        [t('energy.loc.col.meter'), t('energy.loc.col.use'), t('energy.loc.col.vs')],
        rows.map((r) => row([
          html(esc(r.location) + (r.department && r.source === 'listrik' ? ` <span class="small">(${esc(r.department)})</span>` : '')),
          `${fmtNum(Math.round(r.qty * 10) / 10)} ${r.source === 'listrik' ? 'kWh' : 'm³'}`,
          html(deltaTxt(r))
        ]))
      ).__html;
    };
    renderInto('locTable', html(
      makeTable('listrik', t('energy.loc.power')) + makeTable('air', t('energy.loc.water')) ||
      `<p class="small">${esc(t('energy.loc.empty'))}</p>`
    ));
    const selectedMonth = (sel && sel.value) || month || '';
    loadWaterPie(selectedMonth);
  } catch (err) {
    toast(err.message);
  }
}

/* ===== Bahan bakar: Solar, Petrol, dan lainnya ===== */
async function saveFuel() {
  try {
    await api.post('/api/energy/fuels', {
      year: Number($('fy').value),
      month: Number($('fm').value),
      fuel_type: $('ftype').value === 'Lainnya' ? ($('fnote').value || 'Lainnya') : $('ftype').value,
      qty: Number($('fqty').value) || 0,
      unit: $('funit').value || 'liter',
      note: $('fnote').value || ''
    });
    toastOk(t('energy.fuelSaved'));
    await loadFuels();
  } catch (err) {
    toast(err.message);
  }
}

async function loadFuels() {
  try {
    const rows = await api.get('/api/energy/fuels');
    const d = new Date();
    if (!$('fy').value) $('fy').value = d.getFullYear();
    if (!$('fm').value) $('fm').value = d.getMonth() + 1;
    renderInto(
      'fuelTable',
      table(
        [t('energy.col.month'), t('energy.col.fuel'), t('energy.col.amount'), t('energy.col.note'), t('energy.col.action')],
        (rows || []).slice(0, 30).map((r) =>
          row([
            `${monthLabel(r.month)} ${r.year}`,
            r.fuel_type,
            `${fmtNum(r.qty)} ${r.unit || ''}`,
            r.note || '',
            actionsCell('energy_fuels', r)
          ])
        ),
        { empty: t('energy.fuelEmpty') }
      )
    );
    renderInto('fuelAdd', addButton('energy_fuels', t('energy.addFuel')));
  } catch (err) {
    toast(err.message);
  }
}

/* ===== Generate laporan Excel sesuai format Energy Report ===== */
async function downloadReport() {
  try {
    toast(t('energy.exportPrep'));
    const sel = $('locMonth');
    const params = new URLSearchParams();
    const match = /^(\d{4})-(\d{1,2})$/.exec((sel && sel.value) || '');
    if (match) {
      params.set('year', match[1]);
      params.set('month', String(Number(match[2])));
    }
    const qs = params.toString();
    const res = await api.get(`/api/energy/report-export${qs ? `?${qs}` : ''}`);
    const binary = atob(res.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast(err.message);
  }
}

export function mount() {
  bindTabs();
  $('btnListrik').onclick = recalcListrik;
  $('btnGas').onclick = recalcGas;
  $('btnEff').onclick = recalcEff;
  $('btnSaveEnergy').onclick = saveEnergy;
  $('btnImportEnergy').onclick = importEnergy;
  $('btnExportReport').onclick = downloadReport;
  $('btnSaveFuel').onclick = saveFuel;
  if ($('deptMonth')) {
    $('deptMonth').onchange = () => {
      const v = $('deptMonth').value;
      // Handler /api/energy mengharapkan satu parameter month=YYYY-MM.
      api.get(`/api/energy?month=${encodeURIComponent(v)}`)
        .then((d) => {
          renderInto(
            'deptTable',
            table(
              [t('energy.col.dept'), 'kWh', t('energy.col.share'), t('energy.col.vsPrev'), t('energy.col.action')],
              (d.departments || []).map((r) => row([r.department, fmtNum(r.kwh), `${r.share_pct || '-'}%`, `${r.vs_prev_pct || '-'}%`, actionsCell('energy_departments', r)]).__html),
              { empty: t('energy.deptEmpty') }
            )
          );
        })
        .catch((err) => toast(err.message));
    };
  }
}
