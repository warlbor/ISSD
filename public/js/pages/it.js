/* Halaman IT: tiket helpdesk dan infrastruktur. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, toast, sevClass } from '../ui.js';
import { actionsCell, statusPicker } from '../crud.js';
import { itGuide } from '../calc.js';

export const id = 'it';

export async function load() {
  const d = await api.get('/api/it');
  const kpis = d.kpis || {};

  renderStats('itStats', [
    { num: kpis.net_uptime?.value || 'N/A', lbl: 'Uptime Jaringan', color: 'green' },
    { num: String((d.tickets || []).filter((t) => t.status !== 'Solved' && t.status !== 'Closed').length), lbl: 'Tiket Open' },
    { num: kpis.devices?.value || 'N/A', lbl: 'Perangkat Aktif', color: 'blue' },
    { num: kpis.sec_alerts?.value || 'N/A', lbl: 'Alert Keamanan', color: 'orange' }
  ]);

  renderInto(
    'infraList',
    html(
      (d.infra || []).map((i) =>
        `<div class="kpi" data-key="${esc(i.key)}">
          <span class="kpi-label">${esc(i.label)}</span>
          <b class="kpi-val ${sevClass(i.severity)}">${esc(i.value)}</b>
        </div>`
      ).join('') || '<p class="small">Belum ada data infrastruktur.</p>'
    )
  );

  renderInto(
    'ticketTable',
    table(
      ['ID', 'User', 'Masalah', 'Status', 'Aksi'],
      (d.tickets || []).map((t) =>
        row([t.ticket_no, t.user_name, t.issue, statusPicker('it_tickets', t), actionsCell('it_tickets', t)]).__html
      ),
      { empty: 'Belum ada tiket.' }
    )
  );
}

export function mount() {
  $('btnIt').onclick = async () => {
    $('iRes').textContent = itGuide($('iCat').value, $('iProb').value, $('iHost').value);
  };
  $('btnTicket').onclick = async () => {
    try {
      const row = await api.post('/api/it/tickets', {
        user_name: $('iUser').value || 'Anonim',
        issue: $('iProb').value || $('iCat').selectedOptions[0].text,
        host: $('iHost').value,
        category: $('iCat').value
      });
      $('iRes').textContent = `✅ Tiket ${row.ticket_no} dibuat dan disimpan.`;
      toast('Tiket IT tersimpan');
      load();
    } catch (e) {
      toast(e.message);
    }
  };
}

/* ===== Mode publik ===== */

async function refreshCaptcha() {
  try {
    const c = await api.publicGet('/api/captcha');
    $('captchaToken').value = c.token;
    $('captchaQuestion').textContent = c.question;
    $('pubCaptcha').value = '';
  } catch (err) {
    $('captchaQuestion').textContent = '(gagal memuat)';
  }
}

export async function loadPublic() {
  await refreshCaptcha();
}

export function mountPublic() {
  const refreshBtn = $('btnRefreshCaptcha');
  if (refreshBtn) refreshBtn.onclick = refreshCaptcha;
  const submit = $('btnPubTicket');
  if (!submit) return;
  submit.onclick = async () => {
    const name = $('pubUser').value.trim();
    const issue = $('pubIssue').value.trim();
    if (!name) { toast('Nama wajib diisi'); return; }
    if (!issue) { toast('Uraian masalah wajib diisi'); return; }
    if (!$('pubCaptcha').value.trim()) { toast('Jawab pertanyaan keamanan'); return; }
    submit.disabled = true;
    submit.textContent = 'Mengirim…';
    try {
      const row = await api.publicPost('/api/it/tickets/public', {
        user_name: name,
        issue: issue,
        host: $('pubHost').value,
        category: $('pubCat').value,
        captcha_token: $('captchaToken').value,
        captcha_answer: $('pubCaptcha').value.trim()
      });
      $('pubRes').textContent = `✅ Laporan diterima. Nomor tiket: ${row.ticket_no}. Tim IT akan menghubungi Anda.`;
      toast('Laporan terkirim');
      $('pubUser').value = '';
      $('pubIssue').value = '';
      $('pubHost').value = '';
      await refreshCaptcha();
    } catch (err) {
      toast(err.message);
      await refreshCaptcha();
    } finally {
      submit.disabled = false;
      submit.textContent = 'Kirim Laporan';
    }
  };
}
