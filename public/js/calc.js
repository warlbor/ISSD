/* Kalkulator pure — hanya membaca DOM dan mengembalikan string hasil. */
import { $ } from './ui.js';
import { t, tList, localeTag } from './i18n.js';

function num(n) {
  return Number(n || 0).toLocaleString(localeTag());
}

export function calcListrik(kwh, base, tarif) {
  const biaya = kwh * tarif;
  const selisih = base - kwh;
  const pct = base ? (selisih / base) * 100 : 0;
  const band = pct >= 3 ? 'good' : pct >= 0 ? 'ok' : 'over';
  return (
    t('calc.elec.use', { kwh: num(kwh) }) + '\n' +
    t('calc.elec.base', { base: num(base) }) + '\n' +
    t('calc.elec.tariff', { tarif: num(Math.round(tarif)) }) + '\n' +
    t('calc.rule') + '\n' +
    t('calc.elec.cost', { cost: num(Math.round(biaya)) }) + '\n' +
    t('calc.elec.diff', { sign: selisih >= 0 ? '-' : '+', kwh: num(Math.abs(selisih)) }) + '\n' +
    t('calc.elec.pct', {
      arrow: pct >= 0 ? '▼' : '▲',
      pct: Math.abs(pct).toFixed(2),
      verdict: t('calc.elec.verdict.' + band)
    }) + '\n' +
    t('calc.elec.end', { text: t('calc.elec.end.' + band) })
  );
}

export function calcGas(g, h, k) {
  const biaya = g * h;
  const mwh = g * k; // 1 MMbtu ≈ 0,2931 MWh (k = faktor konversi)
  return (
    t('calc.gas.use', { g: num(g) }) + '\n' +
    t('calc.gas.conv', { k }) + '\n' +
    t('calc.gas.price', { h: num(Math.round(h)) }) + '\n' +
    t('calc.rule') + '\n' +
    t('calc.gas.mwh', { mwh: mwh.toFixed(2) }) + '\n' +
    t('calc.gas.cost', { cost: num(Math.round(biaya)) }) + '\n' +
    t('calc.gas.note')
  );
}

export function calcEff(a, b, u) {
  const p = ((a - b) / a) * 100;
  const band = p >= 10 ? 'great' : p >= 5 ? 'good' : p > 0 ? 'some' : 'none';
  return (
    t('calc.eff.before', { a }) + '\n' +
    t('calc.eff.after', { b }) + '\n' +
    t('calc.eff.volume', { u: num(u) }) + '\n' +
    t('calc.rule') + '\n' +
    t('calc.eff.pct', { p: p.toFixed(2) }) + '\n' +
    t('calc.eff.saved', { n: num((a - b) * u) }) + '\n' +
    t('calc.eff.end', { text: t('calc.eff.end.' + band) })
  );
}

export function jsaText(job, desc, org, alat) {
  const bahaya = tList('jsa.hazard.' + job);
  const list = bahaya.length ? bahaya : tList('jsa.hazard.lain');
  const level = ['hotwork', 'workheight', 'confined', 'electrical', 'lifting'].includes(job) ? 'HIGH' : 'MEDIUM';
  const jobName = $('sJob')?.selectedOptions?.[0]?.text || job;
  return (
    t('calc.jsa.head') + '\n' +
    t('calc.rule') + '\n' +
    t('calc.jsa.job', { v: jobName }) + '\n' +
    t('calc.jsa.level', { v: level }) + '\n' +
    t('calc.jsa.where', { v: desc || t('calc.empty') }) + '\n' +
    t('calc.jsa.workers', { v: t('calc.people', { n: org || 1 }) }) + '\n' +
    t('calc.jsa.tools', { v: alat || t('calc.empty') }) + '\n' +
    t('calc.rule') + '\n' +
    t('calc.jsa.hazards') + '\n' +
    list.map((b, i) => `  ${i + 1}. ${b}`).join('\n') + '\n' +
    t('calc.rule') + '\n' +
    t('calc.jsa.control') + '\n' +
    t('calc.jsa.sign')
  );
}

export function itGuide(cat, prob, host) {
  const steps = tList('it.steps.' + cat);
  const list = steps.length ? steps : tList('it.steps.slow');
  const label = t('it.cat.' + cat);
  return (
    t('calc.it.head') + '\n' +
    t('calc.it.host', { v: host }) + '\n' +
    t('calc.it.cat', { v: label === 'it.cat.' + cat ? cat : label }) + '\n' +
    t('calc.it.sym', { v: prob || t('calc.empty') }) + '\n' +
    t('calc.rule') + '\n' +
    list.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n' +
    t('calc.it.sla')
  );
}

export function calcAC(p, l, tHigh, o, eq, sun, eqLabel, sunLabel) {
  const luas = p * l;
  let btusq = 500;
  if (String(sun).startsWith('Normal')) btusq = 600;
  if (String(sun).startsWith('Terbuka')) btusq = 700;
  let base = luas * btusq + o * 500;
  const eqFactor = { ringan: 1, sedang: 1.2, berat: 1.4 }[eq];
  base *= eqFactor;
  const pk = base / 9000;
  const pkRekom = Math.ceil(pk * 2) / 2;
  return (
    t('calc.ac.head') + '\n' +
    t('calc.ac.size', { p, l, t: tHigh, area: luas.toFixed(1) }) + '\n' +
    t('calc.ac.meta', { o, eq: eqLabel || eq, factor: eqFactor, sun: sunLabel || sun }) + '\n' +
    t('calc.ac.btu', { n: num(Math.round(base)) }) + '\n' +
    t('calc.ac.pk', { pk: pk.toFixed(2), rec: pkRekom.toFixed(1) })
  );
}
