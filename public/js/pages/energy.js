/* Halaman Energy: kalkulator dan tabel dinamis bulan. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, fmtNum, monthLabel, toast, toastOk } from '../ui.js';
import { addButton, actionsCell } from '../crud.js';
import { calcListrik, calcGas, calcEff } from '../calc.js';

export const id = 'energy';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/* Progress bar target penghematan listrik: YTD tahun berjalan vs periode yang
   sama tahun sebelumnya, terhadap target_hemat_listrik di Pengaturan. */
function renderTarget(s, cur, active) {
  const el = $('energyTarget');
  if (!el) return;
  const target = Number(s.target_hemat_listrik) || 0;
  if (!target || !cur.year) {
    el.innerHTML = '<p class="small">Atur Target Penghematan Listrik di menu Pengaturan untuk melihat progres di sini.</p>';
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
    el.innerHTML = `<p class="small">Belum cukup data untuk membandingkan YTD ${cur.year} vs ${cur.year - 1}.
      Penghematan dihitung dari total kWh bulan-bulan yang ada datanya di kedua tahun.</p>`;
    return;
  }
  const saving = ((ytdLast - ytdThis) / ytdLast) * 100; // positif = hemat
  const progress = Math.max(0, Math.min(100, (saving / target) * 100));
  const color = saving >= target ? '#22c55e' : saving >= 0 ? '#38bdf8' : '#ef4444';
  const status = saving >= target ? '✅ Target tercapai' : saving >= 0 ? '⏳ Belum capai target' : '⚠️ Konsumsi naik vs tahun lalu';
  const periodTxt = monthsBoth.map((m) => MONTHS[m] || m).join(', ');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:8px">
      <span style="font-size:22px;font-weight:800;color:${color}">${saving.toFixed(1)}%</span>
      <span class="small">${status} · target hemat ${fmtNum(target)}%</span>
    </div>
    <div style="background:var(--line);border-radius:999px;height:12px;overflow:hidden">
      <div style="width:${progress}%;height:100%;background:${color};border-radius:999px;transition:width .4s"></div>
    </div>
    <p class="small mt-8">${periodTxt}: ${fmtNum(Math.round(ytdThis))} kWh (${cur.year}) vs ${fmtNum(Math.round(ytdLast))} kWh (${cur.year - 1}).</p>`;
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
      btn.parentNode.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
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
    resultEl.textContent = 'Pilih file Excel terlebih dahulu.';
    return;
  }
  try {
    const base64 = await fileToBase64(input.files[0]);
    const res = await api.post('/api/energy/import', { file: base64 });
    const lines = [`Monthly: ${res.monthly} baris`, `Departments: ${res.departments} baris`];
    if (res.errors.length) lines.push(...res.errors);
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
    toast('Data energi tersimpan');
    load();
  }).catch((err) => toast(err.message));
}

export async function load() {
  const d = await api.get('/api/energy');
  const months = MONTHS;

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
    ? [{ num: `${delta.yoyPct >= 0 ? '+' : ''}${fmtNum(delta.yoyPct)}%`, lbl: `vs ${delta.yoyLabel || 'tahun lalu'} (YoY)` }]
    : [];

  renderStats('energyStats', [
    { num: fmtNum(cur.electricity_kwh || 0), lbl: `kWh Listrik ${months[cur.month] || ''}`, cycle: [
      { num: fmtNum(cur.electricity_kwh || 0), lbl: 'kWh Listrik' },
      { num: `${((cur.electricity_kwh || 0) / 1000).toFixed(1)} MWh`, lbl: 'Mega Watt hour' },
      { num: `Rp ${fmtNum(Math.round((cur.electricity_kwh || 0) * (s.tarif_listrik || 0)))}`, lbl: 'Biaya Listrik' },
      ...yoyVariant
    ]},
    { num: fmtNum(cur.gas_m3 || 0), lbl: 'MMbtu Gas Alam' },
    { num: fmtNum(cur.water_m3 || 0), lbl: 'm³ Air', color: 'blue' },
    { num: `Rp ${fmtNum(Math.round(cost / 1e6))} Jt`, lbl: 'Estimasi Total Biaya', color: 'green', cycle: [
      { num: `Rp ${fmtNum(Math.round(cost / 1e6))} Jt`, lbl: 'Estimasi Total Biaya' },
      { num: `${fmtNum(delta.co2 || 0)} ton`, lbl: 'Estimasi Emisi CO₂ (listrik)' }
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
    deptMonthSel.innerHTML = `<option value="">Semua</option>${options}`;
  }

  renderInto(
    'deptTable',
    table(
      ['Departemen', 'kWh', 'Porsi', 'vs prev', 'Aksi'],
      (d.departments || []).map((r) =>
        row([r.department, fmtNum(r.kwh), `${r.share_pct || '-'}%`, `${r.vs_prev_pct || '-'}%`, actionsCell('energy_departments', r)]).__html
      ),
      { empty: 'Belum ada data departemen.' }
    )
  );
  renderInto('deptAdd', addButton('energy_departments', 'Tambah Departemen'));

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
      ['Bulan', 'Listrik (kWh)', 'vs Thn Lalu', 'Gas (MMbtu)', 'Air (m³)', 'Aksi'],
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
      }).concat([`<tr style="background:#f0fdf4"><td><b>YTD TOTAL</b></td><td><b>${fmtNum(Math.round(ytd.k))}</b></td><td></td><td><b>${fmtNum(ytd.g)}</b></td><td><b>${fmtNum(ytd.w)}</b></td><td></td></tr>`])
    )
  );

  recalcListrik();
  recalcGas();
  loadLocations();
  loadFuels();
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
        ['Lokasi / Meter', 'Pemakaian', 'vs Bulan Lalu'],
        rows.map((r) => row([
          html(esc(r.location) + (r.department && r.source === 'listrik' ? ` <span class="small">(${esc(r.department)})</span>` : '')),
          `${fmtNum(Math.round(r.qty * 10) / 10)} ${r.source === 'listrik' ? 'kWh' : 'm³'}`,
          html(deltaTxt(r))
        ]))
      ).__html;
    };
    renderInto('locTable', html(
      makeTable('listrik', 'Listrik (kWh)') + makeTable('air', 'Air (m³)') ||
      '<p class="small">Belum ada data lokasi. Import file Energy Report untuk mengisinya.</p>'
    ));
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
    toastOk('Pemakaian bahan bakar tersimpan.');
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
        ['Bulan', 'Jenis', 'Jumlah', 'Catatan', 'Aksi'],
        (rows || []).slice(0, 30).map((r) =>
          row([
            `${monthLabel(r.month)} ${r.year}`,
            r.fuel_type,
            `${fmtNum(r.qty)} ${r.unit || ''}`,
            r.note || '',
            actionsCell('energy_fuels', r)
          ])
        ),
        { empty: 'Belum ada pemakaian bahan bakar tercatat.' }
      )
    );
    renderInto('fuelAdd', addButton('energy_fuels', 'Tambah Bahan Bakar'));
  } catch (err) {
    toast(err.message);
  }
}

/* ===== Generate laporan Excel sesuai format Energy Report ===== */
async function downloadReport() {
  try {
    toast('Menyiapkan laporan Excel…');
    const res = await api.get('/api/energy/report-export');
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
              ['Departemen', 'kWh', 'Porsi', 'vs prev', 'Aksi'],
              (d.departments || []).map((r) => row([r.department, fmtNum(r.kwh), `${r.share_pct || '-'}%`, `${r.vs_prev_pct || '-'}%`, actionsCell('energy_departments', r)]).__html),
              { empty: 'Belum ada data departemen.' }
            )
          );
        })
        .catch((err) => toast(err.message));
    };
  }
}
