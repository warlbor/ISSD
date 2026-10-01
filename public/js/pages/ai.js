/* Halaman AI Assistant: terhubung ke LLM melalui /api/ai/ask,
   menyisipkan konteks data ISSD secara otomatis. */

import { api } from '../api.js';
import { $, renderInto, table, row } from '../ui.js';
import { t } from '../i18n.js';

export const id = 'ai';

function mdToHtml(src) {
  /* Markdown ringan untuk jawaban AI: **tebal**, *miring*, `kode`,
     heading #, list "- " dan "1.". Semua di-escape dulu (aman untuk innerHTML). */
  const inline = (text) => text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s.,;:!?)]|$)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)]|$)/g, '$1<i>$2</i>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
  let out = '';
  let list = null;
  const closeList = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const raw of String(src || '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); out += '<div class="md-gap"></div>'; continue; }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (list !== want) { closeList(); out += `<${want}>`; list = want; }
      out += `<li>${inline(ul ? ul[1] : ol[1])}</li>`;
    } else if (h) {
      closeList();
      out += `<div class="md-h">${inline(h[1])}</div>`;
    } else {
      closeList();
      out += `<div>${inline(line)}</div>`;
    }
  }
  closeList();
  return out;
}

export function formatAnswer(data) {
  let html = `<div class="md-h">🤖 ISSD AI Assistant — ${String(data.model || 'AI').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`;
  html += mdToHtml(data.answer);
  // Baris token usage tidak ditampilkan di UI (diinginkan user; provider tertentu
  // memang tidak mengembalikan usage — lihat catatan di TODO.md).
  return html;
}

export async function load() {
  const logs = await api.get('/api/ai/logs');
  renderInto(
    'aiHistory',
    table(
      [t('ai.col.time'), t('ai.col.mod'), t('ai.col.q')],
      (logs || []).slice(0, 20).map((l) => row([l.created_at, l.module, l.question]).__html),
      { empty: t('ai.empty') }
    )
  );
}

export function mount() {
  $('btnAi').onclick = async () => {
    const q = $('aiQ').value.trim();
    if (!q) {
      $('aiRes').textContent = t('ai.needQ');
      return;
    }
    const m = $('aiModul').value;
    $('aiRes').textContent = t('ai.waiting');

    try {
      const res = await api.post('/api/ai/ask', { module: m, question: q });
      $('aiRes').innerHTML = formatAnswer(res);
    } catch (err) {
      $('aiRes').textContent = `❌ ${err.message}`;
    }
    load();
  };

  $('btnAiClear').onclick = () => {
    $('aiRes').innerHTML = '';
    $('aiQ').value = '';
  };
}
