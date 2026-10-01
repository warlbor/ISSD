/* Client OpenAI-compatible untuk AI Assistant ISSD.
   Membaca OPENAI_API_KEY dan OPENAI_BASE_URL dari environment variable / .env.
   Mendukung banyak model melalui parameter `model`. */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL || 'https://open.api-github.com/v1';
const DEFAULT_API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 30000;
const MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS) || 1200;

const MODELS = {
  'gpt-4o': { baseUrl: DEFAULT_BASE_URL },
  'gpt-4o-mini': { baseUrl: DEFAULT_BASE_URL },
  'kimi-k2.7-code': { baseUrl: 'https://open.api-github.com/v1' },
  'kimi-k3': { baseUrl: 'https://open.api-github.com/v1' },
  'claude-sonnet-5': { baseUrl: 'https://open.api-github.com/v1' },
  'claude-opus-5': { baseUrl: 'https://open.api-github.com/v1' },
  'glm-5.3': { baseUrl: 'https://open.api-github.com/v1' }
};

class AiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getSettings(db) {
  const out = {};
  for (const r of db.prepare('SELECT * FROM app_settings').all()) {
    const n = Number(r.value);
    out[r.key] = Number.isFinite(n) && String(r.value).trim() !== '' ? n : r.value;
  }
  return out;
}

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function latestPair(rows) {
  const active = rows.filter((r) => !r.excluded);
  return { current: active.at(-1) || null, previous: active.at(-2) || null };
}

function buildEnergyContext(db) {
  const lines = ['## Energy Management'];
  const settings = getSettings(db);
  const monthly = db.prepare('SELECT * FROM energy_monthly ORDER BY year, month').all();
  const active = monthly.filter((r) => !r.excluded);
  const recent = active.slice(-6);

  lines.push(`Tarif: listrik Rp ${fmtNum(settings.tarif_listrik)}/kWh, gas Rp ${fmtNum(settings.harga_gas)}/MMbtu, air Rp ${fmtNum(settings.harga_air)}/m³.`);
  lines.push(`Target: penghematan listrik ${fmtNum(settings.target_hemat_listrik)}%, batas air ${fmtNum(settings.target_air)} m³/bulan, batas gas ${fmtNum(settings.target_gas)} MMbtu/bulan.`);

  lines.push('Rekap 6 bulan terakhir:');
  for (const r of recent) {
    lines.push(`- ${r.month}/${r.year}: listrik ${fmtNum(r.electricity_kwh)} kWh, gas ${fmtNum(r.gas_m3)} MMbtu, air ${fmtNum(r.water_m3)} m³`);
  }

  const { current, previous } = latestPair(active);
  if (current && previous) {
    const deltaE = ((current.electricity_kwh - previous.electricity_kwh) / previous.electricity_kwh) * 100;
    lines.push(`Bulan terakhir (${current.month}/${current.year}) vs sebelumnya: listrik ${deltaE >= 0 ? '+' : ''}${fmtNum(deltaE)}%.`);
  }

  if (current) {
    const yoyRow = active.find((r) => r.month === current.month && r.year === current.year - 1);
    if (yoyRow && yoyRow.electricity_kwh) {
      const yoyPct = ((current.electricity_kwh - yoyRow.electricity_kwh) / yoyRow.electricity_kwh) * 100;
      lines.push(`Perbandingan YoY (${current.month}/${current.year} vs ${current.month}/${current.year - 1}): listrik ${yoyPct >= 0 ? '+' : ''}${fmtNum(yoyPct)}%.`);
    }
    if (settings.co2_factor) {
      lines.push(`Estimasi emisi CO₂ listrik bulan terakhir: ${fmtNum((current.electricity_kwh * settings.co2_factor) / 1000)} ton (faktor ${fmtNum(settings.co2_factor)} kg CO₂/kWh).`);
    }
  }

  const depts = db.prepare('SELECT * FROM energy_departments ORDER BY year DESC, month DESC, kwh DESC LIMIT 10').all();
  if (depts.length) {
    lines.push('Konsumsi per departemen (periode terbaru):');
    for (const d of depts) lines.push(`- ${d.department}: ${fmtNum(d.kwh)} kWh (${fmtNum(d.share_pct)}%)`);
  }

  return lines.join('\n');
}

function buildSafetyContext(db) {
  const lines = ['## Safety & HSE'];
  const kpis = db.prepare('SELECT * FROM safety_kpis').all();
  const inspections = db
    .prepare('SELECT * FROM safety_inspections ORDER BY inspect_date DESC, id DESC LIMIT 15')
    .all();

  lines.push('KPI Safety:');
  for (const k of kpis) lines.push(`- ${k.label}: ${k.value}`);

  const open = inspections.filter((i) => i.status !== 'Closed');
  lines.push(`Temuan inspeksi aktif: ${open.length} dari ${inspections.length} terakhir.`);
  for (const i of open.slice(0, 5)) {
    lines.push(`- [${i.status}] ${i.area}: ${i.finding} (PIC: ${i.pic || '-'})`);
  }

  return lines.join('\n');
}

function buildItContext(db) {
  const lines = ['## IT Infrastructure'];
  const tickets = db.prepare('SELECT * FROM it_tickets ORDER BY id DESC LIMIT 20').all();
  const infra = db.prepare('SELECT * FROM it_infra').all();
  const sla = getSettings(db).sla_it || 4;

  lines.push(`SLA target: ≤ ${sla} jam.`);
  lines.push('Status infrastruktur:');
  for (const i of infra) lines.push(`- ${i.label}: ${i.value} (${i.severity})`);

  const open = tickets.filter((t) => !['Solved', 'Closed', 'Cancelled'].includes(t.status));
  lines.push(`Tiket terbuka: ${open.length} dari ${tickets.length} terakhir.`);
  for (const t of open.slice(0, 5)) {
    lines.push(`- [${t.status}] ${t.ticket_no} ${t.category}: ${t.issue.slice(0, 80)} (PIC: ${t.assigned_to || '-'})`);
  }

  return lines.join('\n');
}

function buildGaContext(db) {
  const lines = ['## General Affairs'];
  const stock = db.prepare('SELECT * FROM ga_stock ORDER BY item').all();
  const bookings = db.prepare('SELECT * FROM vehicle_bookings ORDER BY id DESC LIMIT 10').all();

  const low = stock.filter((s) => s.rop && s.stock <= s.rop);
  lines.push(`Stok ATK: ${stock.length} item, ${low.length} di bawah ROP.`);
  for (const s of low.slice(0, 5)) lines.push(`- ${s.item}: ${fmtNum(s.stock)} ${s.unit} (ROP ${fmtNum(s.rop)})`);

  const activeBookings = bookings.filter((b) => !['Returned', 'Cancelled', 'Rejected'].includes(b.status));
  lines.push(`Peminjaman kendaraan aktif: ${activeBookings.length}.`);
  for (const b of activeBookings.slice(0, 5)) {
    lines.push(`- ${b.vehicle} | ${b.borrower} | ${b.purpose} (${b.status})`);
  }

  return lines.join('\n');
}

function buildFacilityContext(db) {
  const lines = ['## Facility Management'];
  const pm = db.prepare('SELECT * FROM facility_pm ORDER BY id').all();
  const wos = db
    .prepare("SELECT * FROM work_orders WHERE module='Facility' ORDER BY id DESC LIMIT 10")
    .all();

  const behind = pm.filter((p) => Number(p.progress) < 100);
  lines.push(`Preventive Maintenance: ${behind.length} jadwal belum 100% dari ${pm.length} equipment.`);
  for (const p of behind.slice(0, 5)) {
    lines.push(`- ${p.equipment}: ${fmtNum(p.done)}/${fmtNum(p.total_units)} unit (${fmtNum(p.progress)}%), next: ${p.next_schedule || '-'}`);
  }

  const open = wos.filter((w) => w.status !== 'Closed');
  lines.push(`Work order fasilitas terbuka: ${open.length}.`);
  for (const w of open.slice(0, 5)) lines.push(`- [${w.priority}] ${w.description} (${w.status})`);

  return lines.join('\n');
}

function buildContext(db, module) {
  const parts = [];
  if (module === 'semua' || module === 'energy') parts.push(buildEnergyContext(db));
  if (module === 'semua' || module === 'safety') parts.push(buildSafetyContext(db));
  if (module === 'semua' || module === 'it') parts.push(buildItContext(db));
  if (module === 'semua' || module === 'ga') parts.push(buildGaContext(db));
  if (module === 'semua' || module === 'facility') parts.push(buildFacilityContext(db));
  return parts.join('\n\n');
}

async function callChatCompletions(model, messages) {
  if (!DEFAULT_API_KEY) throw new AiError(503, 'OPENAI_API_KEY belum dikonfigurasi');

  const baseUrl = (MODELS[model]?.baseUrl) || DEFAULT_BASE_URL;
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/\/$/, '') + '/chat/completions';

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.4,
    max_tokens: MAX_TOKENS
  });

  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${DEFAULT_API_KEY}`
        },
        timeout: TIMEOUT_MS
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              const msg = json?.error?.message || json?.error || `HTTP ${res.statusCode}`;
              return reject(new AiError(res.statusCode <= 599 ? res.statusCode : 502, msg));
            }
            const content = json.choices?.[0]?.message?.content?.trim();
            if (!content) throw new Error('Jawaban model kosong');
            resolve({ content, usage: json.usage || null });
          } catch (err) {
            reject(new AiError(502, `Respons API tidak valid: ${err.message}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(new AiError(502, `Gagal menghubungi API AI: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new AiError(504, 'Timeout menunggu jawaban dari AI'));
    });

    req.write(body);
    req.end();
  });
}

const SYSTEM_PROMPT = `Kamu adalah ISSD AI Assistant, asisten analitik untuk Integrated Site Services Dashboard di sebuah site industri/manufaktur.
Site memiliki modul: Energy, Safety & HSE, General Affairs (GA), IT Infrastructure, dan Facility Management.

Aturan menjawab:
1. Gunakan HANYA data konteks yang diberikan di bawah. Jangan membuat angka atau fakta yang tidak ada di konteks.
2. Jika data tidak cukup untuk menjawab, katakan dengan jujur dan sarankan data apa yang perlu dilengkapi.
3. Berikan jawaban singkat, praktis, dan actionable dalam Bahasa Indonesia.
4. Gunakan bullet point, bold, dan emoji secukupnya untuk highlight.
5. Untuk pertanyaan di luar modul ISSD, jawab sopan bahwa kamu hanya bisa membahas operasional site services.

Format rekomendasi bila diminta analisis:
- Temuan utama
- Root cause singkat (bila dapat disimpulkan dari data)
- Dampak operasional/biaya/safety
- Rekomendasi tindak lanjut (short/mid term)`;

async function ask(db, { module, question, model, sessionId }, actor) {
  model = MODELS[model] ? model : DEFAULT_MODEL;
  const context = buildContext(db, module);
  const moduleLabel = {
    semua: 'Semua Modul',
    energy: 'Energy Management',
    safety: 'Safety & HSE',
    ga: 'General Affairs',
    it: 'IT Infrastructure',
    facility: 'Facility Management'
  }[module] || module;

  const userPrompt = `Modul fokus: ${moduleLabel}\n\nPertanyaan pengguna:\n${question}\n\n--- KONTEKS DATA ISSD ---\n${context}\n--- AKHIR KONTEKS ---`;

  const { content, usage } = await callChatCompletions(model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ]);

  return {
    answer: content,
    model,
    usage,
    module,
    question,
    sessionId: sessionId || null,
    actor: actor || 'anonim'
  };
}

module.exports = { ask, buildContext, AiError };
