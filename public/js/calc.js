/* Kalkulator pure — hanya membaca DOM dan mengembalikan string hasil. */
import { $ } from './ui.js';

export function calcListrik(kwh, base, tarif) {
  const biaya = kwh * tarif;
  const selisih = base - kwh;
  const pct = base ? (selisih / base) * 100 : 0;
  return (
    `Pemakaian listrik saat ini : ${kwh.toLocaleString('id-ID')} kWh\n` +
    `Baseline / Target           : ${base.toLocaleString('id-ID')} kWh\n` +
    `Tarif rata-rata             : Rp ${Math.round(tarif).toLocaleString('id-ID')} / kWh\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Estimasi Biaya Bulan Ini    : Rp ${Math.round(biaya).toLocaleString('id-ID')}\n` +
    `Selisih vs Baseline         : ${selisih >= 0 ? '-' : '+'} ${Math.abs(selisih).toLocaleString('id-ID')} kWh\n` +
    `Persentase Perubahan        : ${pct >= 0 ? '▼' : '▲'} ${Math.abs(pct).toFixed(2)} % → ${pct >= 3 ? 'HEMAT' : pct >= 0 ? 'CUKUP' : 'OVER'}\n` +
    `Kesimpulan                  : ${pct >= 3 ? '✅ Bagus — target hemat ≥3% tercapai.' : pct >= 0 ? '⚠️ Cukup — mendekati target hemat ≥3%.' : '❌ Melebihi baseline. Segera lakukan audit energi!'}`
  );
}

export function calcGas(g, h, k) {
  const biaya = g * h;
  const mwh = g * k; // 1 MMbtu ≈ 0,2931 MWh (k = faktor konversi)
  return (
    `Pemakaian gas         : ${g.toLocaleString('id-ID')} MMbtu\n` +
    `Konversi              : ${k} MWh/MMbtu\n` +
    `Harga satuan          : Rp ${Math.round(h).toLocaleString('id-ID')}/MMbtu\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Energi ekuivalen      : ${mwh.toFixed(2)} MWh\n` +
    `Estimasi Biaya        : Rp ${Math.round(biaya).toLocaleString('id-ID')}\n` +
    `Rekomendasi           : Laporan bulanan memakai satuan MMbtu (WII-QR04-39).`
  );
}

export function calcEff(a, b, u) {
  const p = ((a - b) / a) * 100;
  return (
    `Sebelum Perbaikan  : ${a} satuan energi / unit\n` +
    `Sesudah Perbaikan  : ${b} satuan energi / unit\n` +
    `Volume Aktivitas   : ${u.toLocaleString('id-ID')} unit\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Efisiensi Per Unit : ${p.toFixed(2)} %\n` +
    `Total Penghematan  : ${((a - b) * u).toLocaleString('id-ID')} satuan energi\n` +
    `Kesimpulan         : ${p >= 10 ? '✅ SANGAT BAGUS' : p >= 5 ? '👍 BAIK' : p > 0 ? '📈 Ada perbaikan' : '⚠️ Belum ada peningkatan'}`
  );
}

export function jsaText(job, desc, org, alat) {
  const DB = {
    hotwork: ['Bahaya kebakaran & ledakan', 'Panas radiasi & UV', 'Kebocoran gas mudah terbakar', 'Asap & fumes', 'Luka bakar / cedera mata'],
    workheight: ['Terjatuh dari ketinggian', 'Jatuhnya tools', 'Kerusakan scaffolding', 'Angin kencang', 'Kelelahan pekerja'],
    confined: ['Kekurangan oksigen', 'Gas beracun', 'Aliran cairan tiba-tiba', 'Terjebak', 'Panas berlebih'],
    electrical: ['Sengatan listrik', 'Arc flash', 'Korsleting panel', 'Isolasi rusak', 'Mati mendadak'],
    lifting: ['Sling putus', 'Crane roboh', 'Beban jatuh', 'Tabrakan struktur', 'Operator tidak kompeten'],
    lain: ['Identifikasi bahaya spesifik', 'PPE sesuai SOP', 'Toolbox meeting', 'Checklist peralatan']
  };
  const bahaya = DB[job] || DB.lain;
  const level = ['hotwork', 'workheight', 'confined', 'electrical', 'lifting'].includes(job) ? 'HIGH' : 'MEDIUM';
  const jobName = $('sJob')?.selectedOptions?.[0]?.text || job;
  return (
    `⚠️ JOB SAFETY ANALYSIS (JSA)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Jenis Pekerjaan : ${jobName}\n` +
    `Level Risiko    : 🔴 ${level}\n` +
    `Lokasi/Kondisi  : ${desc || '(tidak diisi)'}\n` +
    `Pekerja         : ${org || 1} orang\n` +
    `Peralatan       : ${alat || '(tidak diisi)'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `IDENTIFIKASI BAHAYA:\n` +
    `${bahaya.map((b, i) => `  ${i + 1}. ${b}`).join('\n')}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `CONTROL: Eliminasi → Substitusi → Engineering → Administrasi (izin kerja, TBM) → PPE\n` +
    `SIGN-OFF: Pekerja / Pengawas / HSE Officer`
  );
}

export function itGuide(cat, prob, host, meta) {
  const guide = {
    net: ['Cek kabel / lampu NIC', 'ipconfig /all — IP valid?', 'Ping gateway & 8.8.8.8', 'nslookup DNS', 'Ganti port/kabel', 'Eskalasi Network Team'],
    email: ['Cek internet & akun AD', 'Profile Outlook baru', 'Uji OWA browser', 'Repair Office', 'Cek ukuran OST'],
    wifi: ['Forget SSID + reconnect', 'Coba 5 GHz', 'flushdns + winsock reset', 'Update driver wireless', 'Cek AP/DHCP'],
    print: ['Printer Ready?', 'Ping IP printer', 'Restart Print Spooler', 'Reinstall driver', 'Uji print Notepad'],
    vpn: ['Internet stabil?', 'User + 2FA', 'Update client VPN', 'Uji hotspot HP', 'Kirim log Event Viewer'],
    slow: ['Task Manager CPU/RAM/Disk', 'Disk Cleanup + SFC', 'Disable startup junk', 'Defender Offline Scan', 'Cek kesehatan SSD'],
    pw: ['Verifikasi identitas helpdesk', 'SSPR portal', 'Reset AD + must change password', 'Unlock account', 'Bersihkan Credential Manager']
  };
  const label = meta?.enums?.ticketCategory?.find((o) => o.value === cat)?.label || cat;
  return (
    `🔍 DIAGNOSA IT ISSD\n` +
    `Host: ${host}\n` +
    `Kategori: ${label}\n` +
    `Gejala: ${prob || '(tidak diisi)'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${(guide[cat] || guide.slow).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n` +
    `SLA: Low 24j | Medium 8j | High 2j | Critical 30m`
  );
}

export function calcAC(p, l, t, o, eq, sun) {
  const luas = p * l;
  let btusq = 500;
  if (sun.startsWith('Normal')) btusq = 600;
  if (sun.startsWith('Terbuka')) btusq = 700;
  let base = luas * btusq + o * 500;
  const eqFactor = { ringan: 1, sedang: 1.2, berat: 1.4 }[eq];
  base *= eqFactor;
  const pk = base / 9000;
  const pkRekom = Math.ceil(pk * 2) / 2;
  return (
    `❄️ PERHITUNGAN KEBUTUHAN AC\n` +
    `Ukuran: ${p} x ${l} x ${t} m → ${luas.toFixed(1)} m²\n` +
    `Orang: ${o} · Peralatan: ${eq} ×${eqFactor} · Matahari: ${sun}\n` +
    `BTU/jam: ${Math.round(base).toLocaleString('id-ID')}\n` +
    `Exact: ${pk.toFixed(2)} PK · Rekomendasi: ${pkRekom.toFixed(1)} PK`
  );
}
