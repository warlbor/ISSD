/* Halaman IT: tiket helpdesk dan infrastruktur. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, toast, sevClass } from '../ui.js';
import { actionsCell, statusPicker } from '../crud.js';
import { itGuide } from '../calc.js';
import { t } from '../i18n.js';

export const id = 'it';

export async function load() {
  const d = await api.get('/api/it');
  const kpis = d.kpis || {};

  renderStats('itStats', [
    { num: kpis.net_uptime?.value || 'N/A', lbl: t('it.kpi.uptime'), color: 'green' },
    { num: String((d.tickets || []).filter((ticket) => ticket.status !== 'Solved' && ticket.status !== 'Closed').length), lbl: t('it.kpi.open') },
    { num: kpis.devices?.value || 'N/A', lbl: t('it.kpi.devices'), color: 'blue' },
    { num: kpis.sec_alerts?.value || 'N/A', lbl: t('it.kpi.sec'), color: 'orange' }
  ]);

  renderInto(
    'infraList',
    html(
      (d.infra || []).map((i) =>
        `<div class="kpi" data-key="${esc(i.key)}">
          <span class="kpi-label">${esc(i.label)}</span>
          <b class="kpi-val ${sevClass(i.severity)}">${esc(i.value)}</b>
        </div>`
      ).join('') || `<p class="small">${esc(t('it.noInfra'))}</p>`
    )
  );

  renderInto(
    'ticketTable',
    table(
      [t('it.col.id'), t('it.col.user'), t('it.col.issue'), t('home.col.status'), t('energy.col.action')],
      (d.tickets || []).map((ticket) =>
        row([ticket.ticket_no, ticket.user_name, ticket.issue, statusPicker('it_tickets', ticket), actionsCell('it_tickets', ticket)]).__html
      ),
      { empty: t('it.noTickets') }
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
        user_name: $('iUser').value || t('it.anonymous'),
        issue: $('iProb').value || $('iCat').selectedOptions[0].text,
        host: $('iHost').value,
        category: $('iCat').value
      });
      $('iRes').textContent = t('it.ticketSaved', { no: row.ticket_no });
      toast(t('it.toastSaved'));
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
    $('captchaQuestion').textContent = t('it.captchaFail');
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
    if (!name) { toast(t('it.nameRequired')); return; }
    if (!issue) { toast(t('it.issueRequired')); return; }
    if (!$('pubCaptcha').value.trim()) { toast(t('it.captchaRequired')); return; }
    submit.disabled = true;
    submit.dataset.i18n = 'it.sending';
    submit.textContent = t('it.sending');
    try {
      const row = await api.publicPost('/api/it/tickets/public', {
        user_name: name,
        issue: issue,
        host: $('pubHost').value,
        category: $('pubCat').value,
        captcha_token: $('captchaToken').value,
        captcha_answer: $('pubCaptcha').value.trim()
      });
      $('pubRes').textContent = t('it.reportOk', { no: row.ticket_no });
      toast(t('it.reportSent'));
      $('pubUser').value = '';
      $('pubIssue').value = '';
      $('pubHost').value = '';
      await refreshCaptcha();
    } catch (err) {
      toast(err.message);
      await refreshCaptcha();
    } finally {
      submit.disabled = false;
      submit.dataset.i18n = 'it.send';
      submit.textContent = t('it.send');
    }
  };
}
