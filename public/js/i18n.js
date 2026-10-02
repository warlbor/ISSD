/* Bahasa Indonesia (default) + English.
   Preference is stored in localStorage. Static nodes use data-i18n*.
   Scripts call t(key) / tList(key) when they render. */

const STORAGE_KEY = 'issd-lang';

/* Each entry is [Bahasa Indonesia, English]. Indonesian matches the copy
   that was already on screen, so the default language does not rewrite it. */
const PAIRS = {
  'app.docTitle': [
    'ISSD — Integrated Site Services Dashboard',
    'ISSD — Integrated Site Services Dashboard'
  ],
  'app.needStaff': [
    'Silakan login sebagai staff untuk membuka halaman ini.',
    'Sign in as staff to open this page.'
  ],
  'app.loadFail': [
    'Tidak bisa memuat data. Server mungkin sedang sibuk.',
    'Couldn’t load the data. The server may be busy.'
  ],
  'app.serverDown': [
    'Server belum merespons. Jalankan npm start lalu refresh halaman.',
    'The server isn’t responding. Run npm start, then refresh the page.'
  ],
  'app.previewFail': [
    'Data pratinjau tidak bisa dimuat.',
    'Preview data couldn’t be loaded.'
  ],

  'lang.switch': ['Bahasa', 'Language'],

  'menu.aria': ['Menu', 'Menu'],
  'nav.aria': ['Menu utama', 'Main menu'],
  'nav.main': ['Menu Utama', 'Main menu'],
  'nav.home': ['Dashboard', 'Dashboard'],
  'nav.energy': ['Energy', 'Energy'],
  'nav.safety': ['Safety', 'Safety'],
  'nav.ga': ['GA', 'GA'],
  'nav.it': ['IT', 'IT'],
  'nav.facility': ['Facility', 'Facility'],
  'nav.more': ['Lainnya', 'More'],
  'nav.report': ['Laporan', 'Reports'],
  'nav.settings': ['Pengaturan', 'Settings'],
  'nav.ai': ['AI Assistant', 'AI Assistant'],

  'chrome.guestMode': ['Mode tamu — data terbatas', 'Guest mode — limited data'],
  'chrome.guest': ['Tamu', 'Guest'],
  'chrome.staffLogin': ['Login Staff', 'Staff sign-in'],
  'chrome.logout': ['Keluar', 'Sign out'],
  'chrome.live': ['LIVE · SQLite', 'LIVE · SQLite'],
  'chrome.previewBadge': ['PRATINJAU', 'PREVIEW'],
  'chrome.previewUser': ['Pratinjau', 'Preview'],
  'role.admin': ['Admin', 'Admin'],
  'role.staff': ['Staff', 'Staff'],

  'login.user': ['Username', 'Username'],
  'login.pass': ['Password', 'Password'],
  'login.submit': ['Masuk', 'Sign in'],
  'login.checking': ['Memeriksa…', 'Checking…'],
  'login.sessionExpired': ['Sesi habis. Silakan login lagi.', 'Your session expired. Please sign in again.'],

  'foot.left': ['ISSD · Integrated Site Services', 'ISSD · Integrated Site Services'],
  'foot.right': ['v2.0.0 · © 2026', 'v2.0.0 · © 2026'],

  'empty.stored': ['Belum ada data tersimpan.', 'Nothing saved yet.'],
  'empty.kpi': ['Belum ada data', 'No data yet'],
  'kpi.cycle': ['⟳ klik', '⟳ click'],
  'month.fallback': ['Bln {m}', 'Mon {m}'],

  'home.title': ['Dashboard Ringkasan Site Services', 'Site services overview'],
  'home.subStaff': [
    'Pandangan terpadu Energy · Safety · GA · IT · Facility — data dari database, bukan HTML statis.',
    'Energy, Safety, GA, IT, and Facility in one view — live data from the database.'
  ],
  'home.subGuest': [
    'Ringkasan energi untuk tamu. Login staff untuk modul operasional.',
    'Energy summary for guests. Sign in as staff to open the operational modules.'
  ],
  'home.card.energy': ['Energy', 'Energy'],
  'home.card.energyDesc': [
    'Listrik · Gas · Air · Panel Surya · Efisiensi',
    'Electricity · Gas · Water · Solar · Efficiency'
  ],
  'home.card.safety': ['Safety & HSE', 'Safety & HSE'],
  'home.card.safetyDesc': [
    'Insiden · Near Miss · PPE · Inspeksi · Izin Kerja',
    'Incidents · Near misses · PPE · Inspections · Work permits'
  ],
  'home.card.ga': ['General Affairs', 'General Affairs'],
  'home.card.gaDesc': [
    'Kendaraan · ATK · Resepsionis · Kantor · Catering',
    'Vehicles · Stationery · Reception · Office · Catering'
  ],
  'home.card.it': ['IT Infrastructure', 'IT Infrastructure'],
  'home.card.itDesc': [
    'Jaringan · Server · Tiket · Inventaris · Keamanan',
    'Network · Servers · Tickets · Inventory · Security'
  ],
  'home.card.fac': ['Facility', 'Facility'],
  'home.card.facDesc': [
    'AC · Plumbing · Lift · Genset · Perawatan Gedung',
    'HVAC · Plumbing · Lifts · Generators · Building upkeep'
  ],
  'home.chart': ['Konsumsi Listrik 6 Bulan Terakhir (ribu kWh)', 'Electricity use, last 6 months (thousand kWh)'],
  'home.chartEmpty': ['Belum ada data konsumsi listrik.', 'No electricity use on record yet.'],
  'home.guestTitle': ['Akses tamu', 'Guest access'],
  'home.guestHelp': [
    'Yang bisa dilakukan tanpa login. Modul lain terbuka setelah masuk sebagai staff.',
    'What you can do without signing in. The other modules open after you sign in as staff.'
  ],
  'home.reportIt': ['Laporkan masalah IT', 'Report an IT problem'],
  'home.reportItHint': [
    'Jaringan, email, atau perangkat — tiket langsung ke tim IT.',
    'Network, email, or a device — the ticket goes straight to the IT team.'
  ],
  'home.fullLogin': ['Login untuk modul lengkap', 'Sign in for full access'],
  'home.fullHint': ['Energy · Safety · GA · Facility', 'Energy · Safety · GA · Facility'],
  'home.alerts': ["Today's Site Alert", "Today's site alerts"],
  'home.latest': ['Tiket & Work Order Terbaru', 'Latest tickets & work orders'],
  'home.targets': ['Target vs Realisasi', 'Target vs actual'],
  'home.noAlerts': ['Tidak ada alert aktif.', 'No active alerts.'],
  'home.noWo': ['Belum ada work order terbaru.', 'No recent work orders.'],
  'home.col.no': ['No', 'No.'],
  'home.col.module': ['Modul', 'Module'],
  'home.col.desc': ['Uraian', 'Description'],
  'home.col.status': ['Status', 'Status'],
  'home.col.priority': ['Prioritas', 'Priority'],
  'home.kpi.safety': ['Kepatuhan Safety Bulan Ini', 'Safety compliance this month'],
  'home.kpi.itOpen': ['Tiket IT Open', 'Open IT tickets'],
  'home.kpi.uptime': ['Uptime Facility', 'Facility uptime'],
  'home.kpi.kwh': ['kWh Listrik', 'Electricity (kWh)'],
  'home.kpi.kwhWhen': ['kWh Listrik · {when}', 'Electricity (kWh) · {when}'],
  'home.kpi.vsPrev': ['vs {month}', 'vs {month}'],
  'home.kpi.prevMonth': ['bulan lalu', 'last month'],
  'home.kpi.cost': ['Biaya Listrik', 'Electricity cost'],
  'home.kpi.mwh': ['Mega Watt hour', 'Megawatt-hours'],
  'home.kpi.co2': ['Estimasi CO₂', 'Estimated CO₂'],
  'home.kpi.elecMonth': ['Listrik {month}', 'Electricity {month}'],
  'home.kpi.elecCompare': ['Listrik {month} {year} vs {prev}', 'Electricity {month} {year} vs {prev}'],

  'energy.title': ['⚡ Energy Management', '⚡ Energy Management'],
  'energy.sub': [
    'Pemantauan konsumsi energi dari tabel <b>energy_monthly</b> di SQLite.',
    'Energy use from the <b>energy_monthly</b> table in SQLite.'
  ],
  'energy.importTitle': ['Import Data Energi dari Excel', 'Import energy data from Excel'],
  'energy.importHelp': [
    'Upload file Excel (format Energy Report). Sheet <b>Monthly</b> dan <b>Departments</b> akan diimpor.',
    'Upload an Excel file (Energy Report layout). The <b>Monthly</b> and <b>Departments</b> sheets are imported.'
  ],
  'energy.importBtn': ['⬆ Import Excel', '⬆ Import Excel'],
  'energy.exportBtn': [
    '📤 Generate Laporan Excel (format Energy Report)',
    '📤 Export Excel report (Energy Report layout)'
  ],
  'energy.targetTitle': ['Progres Target Penghematan Listrik', 'Electricity saving target'],
  'energy.locTitle': ['Pemakaian per Lokasi / Meter', 'Use by location / meter'],
  'energy.locHelp': [
    'Selisih pemakaian vs bulan sebelumnya per titik ukur. ▲ naik · ▼ turun.',
    'Change versus the previous month at each meter. ▲ up · ▼ down.'
  ],
  'energy.fuelTitle': ['Bahan Bakar (Solar, Petrol, dll.)', 'Fuel (diesel, petrol, and others)'],
  'energy.fuelType': ['Jenis', 'Type'],
  'energy.fuel.solar': ['Solar (HSD)', 'Diesel (HSD)'],
  'energy.fuel.petrol': ['Petrol', 'Petrol'],
  'energy.fuel.other': ['Lainnya', 'Other'],
  'energy.saveFuel': ['Simpan Bahan Bakar', 'Save fuel'],
  'energy.calcTitle': ['Kalkulator Analisis Konsumsi Energi', 'Energy use calculator'],
  'energy.tab.power': ['Listrik', 'Electricity'],
  'energy.tab.gas': ['Gas Alam', 'Natural gas'],
  'energy.tab.eff': ['Efisiensi & Air', 'Efficiency & water'],
  'energy.kwh': ['Pemakaian Listrik (kWh)', 'Electricity use (kWh)'],
  'energy.baseline': ['Baseline Bulan Lalu (kWh)', 'Last month baseline (kWh)'],
  'energy.tariff': ['Tarif per kWh (Rp)', 'Tariff per kWh (Rp)'],
  'energy.analyze': ['Hitung Analisis', 'Run analysis'],
  'energy.gasUse': ['Pemakaian Gas (MMbtu)', 'Gas use (MMbtu)'],
  'energy.gasPrice': ['Harga Gas per MMbtu (Rp)', 'Gas price per MMbtu (Rp)'],
  'energy.gasConv': ['Konversi (MWh per MMbtu)', 'Conversion (MWh per MMbtu)'],
  'energy.calc': ['Hitung', 'Calculate'],
  'energy.effBefore': ['Konsumsi Awal', 'Use before'],
  'energy.effAfter': ['Konsumsi Setelah Perbaikan', 'Use after the improvement'],
  'energy.effVolume': ['Volume Aktivitas', 'Activity volume'],
  'energy.calcEff': ['Hitung Efisiensi', 'Calculate efficiency'],
  'energy.saveMonth': ['Simpan / Perbarui Data Bulanan', 'Save or update monthly data'],
  'energy.kwhField': ['Listrik kWh', 'Electricity kWh'],
  'energy.gasField': ['Gas (MMbtu)', 'Gas (MMbtu)'],
  'energy.waterField': ['Air m³', 'Water m³'],
  'energy.saveDb': ['Simpan ke Database', 'Save to database'],
  'energy.deptTitle': ['Pembagian Konsumsi per Departemen', 'Use by department'],
  'energy.monthRecap': ['Rekap Bulanan', 'Monthly recap'],
  'energy.zeroNote': [
    'Jan 2026 ditandai sebagai pembacaan meter kumulatif (zero reset) dan tidak ikut dalam tren.',
    'January 2026 is a cumulative meter reading (zero reset) and is left out of the trend.'
  ],
  'energy.needTarget': [
    'Atur Target Penghematan Listrik di menu Pengaturan untuk melihat progres di sini.',
    'Set the electricity saving target in Settings to see progress here.'
  ],
  'energy.needYtd': [
    'Belum cukup data untuk membandingkan YTD {year} vs {prev}. Penghematan dihitung dari total kWh bulan-bulan yang ada datanya di kedua tahun.',
    'Not enough data to compare YTD {year} with {prev}. Savings use only months that exist in both years.'
  ],
  'energy.targetHit': ['✅ Target tercapai', '✅ Target met'],
  'energy.targetMiss': ['⏳ Belum capai target', '⏳ Short of the target'],
  'energy.targetUp': ['⚠️ Konsumsi naik vs tahun lalu', '⚠️ Use is up versus last year'],
  'energy.targetMeta': ['{status} · target hemat {target}%', '{status} · saving target {target}%'],
  'energy.ytdLine': [
    '{period}: {now} kWh ({year}) vs {prevKwh} kWh ({prevYear}).',
    '{period}: {now} kWh ({year}) vs {prevKwh} kWh ({prevYear}).'
  ],
  'energy.pickFile': ['Pilih file Excel terlebih dahulu.', 'Choose an Excel file first.'],
  'energy.importMonthly': ['Monthly: {n} baris', 'Monthly: {n} rows'],
  'energy.importDepts': ['Departments: {n} baris', 'Departments: {n} rows'],
  'energy.saved': ['Data energi tersimpan', 'Energy data saved'],
  'energy.all': ['Semua', 'All'],
  'energy.deptEmpty': ['Belum ada data departemen.', 'No department data yet.'],
  'energy.addDept': ['Tambah Departemen', 'Add department'],
  'energy.ytd': ['YTD TOTAL', 'YTD TOTAL'],
  'energy.col.dept': ['Departemen', 'Department'],
  'energy.col.share': ['Porsi', 'Share'],
  'energy.col.vsPrev': ['vs prev', 'vs last month'],
  'energy.col.action': ['Aksi', 'Actions'],
  'energy.col.month': ['Bulan', 'Month'],
  'energy.col.kwh': ['Listrik (kWh)', 'Electricity (kWh)'],
  'energy.col.yoy': ['vs Thn Lalu', 'vs last year'],
  'energy.col.gas': ['Gas (MMbtu)', 'Gas (MMbtu)'],
  'energy.col.water': ['Air (m³)', 'Water (m³)'],
  'energy.kpi.kwhMonth': ['kWh Listrik {month}', 'Electricity (kWh) {month}'],
  'energy.kpi.gas': ['MMbtu Gas Alam', 'Natural gas (MMbtu)'],
  'energy.kpi.water': ['m³ Air', 'Water (m³)'],
  'energy.kpi.cost': ['Estimasi Total Biaya', 'Estimated total cost'],
  'energy.kpi.co2': ['Estimasi Emisi CO₂ (listrik)', 'Estimated CO₂ (electricity)'],
  'energy.kpi.yoy': ['vs {label} (YoY)', 'vs {label} (YoY)'],
  'energy.kpi.yoyFallback': ['tahun lalu', 'last year'],
  'energy.unit.mio': ['Jt', 'm'],
  'energy.loc.power': ['Listrik (kWh)', 'Electricity (kWh)'],
  'energy.loc.water': ['Air (m³)', 'Water (m³)'],
  'energy.loc.col.meter': ['Lokasi / Meter', 'Location / meter'],
  'energy.loc.col.use': ['Pemakaian', 'Use'],
  'energy.loc.col.vs': ['vs Bulan Lalu', 'vs last month'],
  'energy.loc.empty': [
    'Belum ada data lokasi. Import file Energy Report untuk mengisinya.',
    'No location data yet. Import an Energy Report file to fill it in.'
  ],
  'energy.pie.title': ['Air seluruh pabrik', 'Plant-wide water'],
  'energy.pie.empty': ['Belum ada pemakaian air untuk {month}.', 'No plant water use for {month}.'],
  'energy.pie.emptyPlain': [
    'Belum ada pemakaian air untuk bulan ini.',
    'No plant water use for this month.'
  ],
  'energy.pie.aria': ['{title}, {month}, total {total} m³', '{title}, {month}, total {total} m³'],
  'energy.pie.cat.production': ['Produksi', 'Production'],
  'energy.pie.cat.boiler': ['Boiler', 'Boiler'],
  'energy.pie.cat.otherPhase2': ['Air lain fase 2', 'Other water, phase 2'],
  'energy.pie.cat.otherPhase1': ['Air lain fase 1', 'Other water, phase 1'],
  'energy.pie.cat.technology': ['Teknik', 'Technology'],
  'energy.pie.cat.quality': ['Pengendalian mutu', 'Quality control'],
  'energy.fuelSaved': ['Pemakaian bahan bakar tersimpan.', 'Fuel use saved.'],
  'energy.fuelEmpty': ['Belum ada pemakaian bahan bakar tercatat.', 'No fuel use recorded yet.'],
  'energy.addFuel': ['Tambah Bahan Bakar', 'Add fuel'],
  'energy.col.fuel': ['Jenis', 'Type'],
  'energy.col.amount': ['Jumlah', 'Amount'],
  'energy.col.note': ['Catatan', 'Note'],
  'energy.exportPrep': ['Menyiapkan laporan Excel…', 'Preparing the Excel report…'],

  'ph.optional': ['opsional', 'optional'],
  'ph.kwhNow': ['isi dari data bulan ini', 'from this month’s data'],
  'ph.lastMonth': ['bulan lalu', 'last month'],
  'ph.gasNow': ['MMbtu bulan ini', 'MMbtu this month'],
  'ph.effBefore': ['konsumsi awal', 'use before'],
  'ph.effAfter': ['setelah perbaikan', 'after the improvement'],
  'ph.effVolume': ['volume aktivitas', 'activity volume'],
  'ph.example': ['mis. budi', 'e.g. budi'],

  'field.year': ['Tahun', 'Year'],
  'field.month': ['Bulan (1–12)', 'Month (1–12)'],
  'field.note': ['Catatan', 'Note'],
  'field.qty': ['Jumlah', 'Quantity'],
  'field.unit': ['Satuan', 'Unit'],
  'field.category': ['Kategori', 'Category'],

  'safety.title': ['🛡 Safety & HSE', '🛡 Safety & HSE'],
  'safety.sub': ['Inspeksi dan KPI safety tersimpan di database.', 'Inspections and safety KPIs are stored in the database.'],
  'safety.jsaTitle': ['Analisis Risiko Pekerjaan (JSA)', 'Job safety analysis (JSA)'],
  'safety.job': ['Jenis Pekerjaan', 'Job type'],
  'safety.job.hot': ['Hot Work (Welding, Grinding, Cutting)', 'Hot work (welding, grinding, cutting)'],
  'safety.job.height': ['Bekerja di Ketinggian (≥ 2 m)', 'Work at height (≥ 2 m)'],
  'safety.job.confined': ['Confined Space', 'Confined space'],
  'safety.job.electrical': ['Pekerjaan Listrik', 'Electrical work'],
  'safety.job.lifting': ['Lifting / Rigging', 'Lifting / rigging'],
  'safety.job.other': ['Pekerjaan Lainnya', 'Other work'],
  'safety.where': ['Lokasi & Kondisi', 'Location & conditions'],
  'safety.workers': ['Jumlah Pekerja', 'Number of workers'],
  'safety.tools': ['Peralatan', 'Equipment'],
  'safety.generate': ['Generate & Simpan JSA', 'Generate & save JSA'],
  'safety.latest': ['Inspeksi Safety Terbaru', 'Latest safety inspections'],
  'safety.yearStats': ['Statistik Safety Tahun Ini', 'Safety figures this year'],
  'safety.saved': ['JSA disimpan ke database', 'JSA saved to the database'],
  'safety.empty': ['Belum ada temuan inspeksi.', 'No inspection findings yet.'],
  'safety.add': ['Tambah Temuan', 'Add finding'],
  'safety.col.date': ['Tanggal', 'Date'],
  'safety.col.area': ['Area', 'Area'],
  'safety.col.finding': ['Temuan', 'Finding'],
  'safety.col.pic': ['PIC', 'PIC'],
  'safety.fallback.lti': ['LTI', 'LTI'],
  'safety.fallback.near': ['Near Miss', 'Near miss'],
  'safety.fallback.permit': ['Izin Kerja', 'Work permits'],
  'safety.fallback.ppe': ['PPE', 'PPE'],
  'ph.jsa': ['Contoh: Welding di area pipa LPG...', 'Example: welding beside the LPG pipe...'],
  'safety.toolsDefault': ['Mesin las, gerinda tangan, APAR 6 kg', 'Welding set, angle grinder, 6 kg extinguisher'],

  'ga.title': ['🏢 General Affairs (GA)', '🏢 General Affairs (GA)'],
  'ga.sub': ['Peminjaman kendaraan tersimpan permanen di SQLite.', 'Vehicle bookings are stored in SQLite.'],
  'ga.form': ['Form Peminjaman Kendaraan', 'Vehicle booking'],
  'ga.borrower': ['Nama Peminjam & Departemen', 'Borrower & department'],
  'ga.when': ['Tanggal & Jam Pakai', 'Date & time of use'],
  'ga.purpose': ['Tujuan', 'Purpose'],
  'ga.vehicle': ['Jenis Kendaraan', 'Vehicle'],
  'ga.driver': ['Supir', 'Driver'],
  'ga.km': ['Estimasi Kilometer', 'Estimated kilometres'],
  'ga.submit': ['Ajukan & Simpan', 'Submit & save'],
  'ga.stockTitle': ['Stok ATK Kritis', 'Stationery running low'],
  'ga.history': ['Riwayat Peminjaman', 'Booking history'],
  'ga.veh.pickup': ['Pick Up (Barang) — B 1234 XYZ', 'Pickup (cargo) — B 1234 XYZ'],
  'ga.veh.avanza': ['Avanza (Penumpang) — B 5678 ABC', 'Avanza (passengers) — B 5678 ABC'],
  'ga.veh.apv': ['APV (6 Penumpang) — B 9012 DEF', 'APV (6 passengers) — B 9012 DEF'],
  'ga.veh.box': ['Box Truck 4 Roda — B 3456 GHI', '4-wheel box truck — B 3456 GHI'],
  'ga.drv.self': ['Tidak Pakai Supir (Self Drive)', 'No driver (self-drive)'],
  'ga.drv.ahmad': ['Ahmad (SIM A)', 'Ahmad (licence A)'],
  'ga.drv.soleh': ['Soleh (SIM A/B1)', 'Soleh (licence A/B1)'],
  'ga.drv.joko': ['Joko (SIM B2)', 'Joko (licence B2)'],
  'ph.borrower': ['Budi Santoso — Dept. Production', 'Budi Santoso — Production'],
  'ga.kpi.vehicles': ['Unit Kendaraan', 'Vehicles'],
  'ga.kpi.attendance': ['Kehadiran', 'Attendance'],
  'ga.kpi.visitors': ['Pengunjung Bulan Ini', 'Visitors this month'],
  'ga.kpi.low': ['ATK Stok Menipis', 'Stationery running low'],
  'ga.orderNow': ['Order Now', 'Order now'],
  'ga.low': ['Low', 'Low'],
  'ga.ok': ['OK', 'OK'],
  'ga.stockEmpty': ['Belum ada data stok.', 'No stock on record yet.'],
  'ga.addStock': ['Tambah ATK', 'Add item'],
  'ga.bookEmpty': ['Belum ada peminjaman.', 'No bookings yet.'],
  'ga.col.item': ['Item', 'Item'],
  'ga.col.stock': ['Stok', 'Stock'],
  'ga.col.rop': ['ROP', 'ROP'],
  'ga.col.unit': ['Satuan', 'Unit'],
  'ga.col.driver': ['Driver', 'Driver'],
  'ga.saved': ['Booking tersimpan', 'Booking saved'],
  'ga.savedBody': [
    '✅ PEMINJAMAN TERSIMPAN\nNo. Booking : {no}\nPeminjam    : {who}\nKendaraan   : {vehicle}\nStatus      : {status}\nEstimasi BBM: {fuel}',
    '✅ BOOKING SAVED\nBooking no. : {no}\nBorrower    : {who}\nVehicle     : {vehicle}\nStatus      : {status}\nFuel estimate: {fuel}'
  ],

  'it.title': ['💻 IT Infrastructure & Helpdesk', '💻 IT Infrastructure & Helpdesk'],
  'it.sub': ['Tiket helpdesk tersimpan di tabel it_tickets.', 'Helpdesk tickets are stored in it_tickets.'],
  'it.reportTitle': ['Laporkan Masalah IT', 'Report an IT problem'],
  'it.reportHelp': [
    'Tidak bisa login? Laporkan masalah IT Anda di sini. Tim IT akan menindaklanjuti.',
    'Can’t sign in? Describe the IT problem here. The team will follow up.'
  ],
  'it.yourName': ['Nama Anda', 'Your name'],
  'it.issue': ['Uraian Masalah', 'What went wrong'],
  'it.hostOpt': ['Hostname / Komputer (opsional)', 'Hostname / computer (optional)'],
  'it.captcha': ['Pertanyaan keamanan:', 'Security check:'],
  'it.captchaRefresh': ['↻ Ganti', '↻ New question'],
  'it.send': ['Kirim Laporan', 'Send report'],
  'it.sending': ['Mengirim…', 'Sending…'],
  'it.staffTitle': ['Troubleshooting AI + Tiket', 'Troubleshooting & ticket'],
  'it.symptom': ['Gejala', 'Symptoms'],
  'it.user': ['Nama User', 'User name'],
  'it.host': ['Hostname', 'Hostname'],
  'it.diagnose': ['Diagnosa', 'Diagnose'],
  'it.create': ['Buat Tiket ke Database', 'Create ticket'],
  'it.infraTitle': ['Kondisi Infrastruktur', 'Infrastructure'],
  'it.ticketsTitle': ['Tiket Helpdesk', 'Helpdesk tickets'],
  'it.cat.net': ['Tidak bisa akses Internet / Jaringan', 'No internet or network access'],
  'it.cat.email': ['Email tidak bisa send/receive', 'Email won’t send or receive'],
  'it.cat.wifi': ['WiFi connect tapi tidak ada internet', 'Wi-Fi connects, but no internet'],
  'it.cat.print': ['Printer tidak bisa mencetak', 'Printer won’t print'],
  'it.cat.vpn': ['Akses VPN gagal', 'VPN access failed'],
  'it.cat.slow': ['Komputer / Aplikasi lambat', 'Computer or app is slow'],
  'it.cat.pw': ['Lupa password / akun terkunci', 'Forgot password / account locked'],
  'it.cat.other': ['Lainnya', 'Something else'],
  'ph.nameDept': ['Nama lengkap & departemen', 'Full name & department'],
  'ph.issue': ['Jelaskan keluhan Anda…', 'Describe the problem…'],
  'ph.host': ['mis. PC-PROD-087', 'e.g. PC-PROD-087'],
  'ph.answer': ['jawaban', 'answer'],
  'ph.reporter': ['Nama pelapor', 'Reporter’s name'],
  'it.kpi.uptime': ['Uptime Jaringan', 'Network uptime'],
  'it.kpi.open': ['Tiket Open', 'Open tickets'],
  'it.kpi.devices': ['Perangkat Aktif', 'Active devices'],
  'it.kpi.sec': ['Alert Keamanan', 'Security alerts'],
  'it.noInfra': ['Belum ada data infrastruktur.', 'No infrastructure data yet.'],
  'it.noTickets': ['Belum ada tiket.', 'No tickets yet.'],
  'it.col.id': ['ID', 'ID'],
  'it.col.user': ['User', 'User'],
  'it.col.issue': ['Masalah', 'Issue'],
  'it.ticketSaved': ['✅ Tiket {no} dibuat dan disimpan.', '✅ Ticket {no} created and saved.'],
  'it.toastSaved': ['Tiket IT tersimpan', 'IT ticket saved'],
  'it.nameRequired': ['Nama wajib diisi', 'Name is required'],
  'it.issueRequired': ['Uraian masalah wajib diisi', 'Describe the problem before sending'],
  'it.captchaRequired': ['Jawab pertanyaan keamanan', 'Answer the security check'],
  'it.reportOk': [
    '✅ Laporan diterima. Nomor tiket: {no}. Tim IT akan menghubungi Anda.',
    '✅ Report received. Ticket number: {no}. IT will contact you.'
  ],
  'it.reportSent': ['Laporan terkirim', 'Report sent'],
  'it.captchaFail': ['(gagal memuat)', '(couldn’t load)'],
  'it.anonymous': ['Anonim', 'Anonymous'],

  'fac.title': ['🔧 Facility Management', '🔧 Facility Management'],
  'fac.sub': ['Work order fasilitas tersimpan dan muncul di dashboard.', 'Facility work orders are saved and show up on the dashboard.'],
  'fac.monitor': ['Monitoring AC & Work Order', 'HVAC check & work order'],
  'fac.tab.ac': ['Kalkulasi Beban AC', 'Cooling load'],
  'fac.tab.wo': ['Form Work Order', 'Work order form'],
  'fac.len': ['Panjang (m)', 'Length (m)'],
  'fac.wid': ['Lebar (m)', 'Width (m)'],
  'fac.hei': ['Tinggi (m)', 'Height (m)'],
  'fac.people': ['Jumlah Orang', 'People in the room'],
  'fac.equip': ['Peralatan', 'Equipment'],
  'fac.sun': ['Sinar Matahari', 'Sunlight'],
  'fac.eq.light': ['Ringan', 'Light'],
  'fac.eq.mid': ['Sedang', 'Medium'],
  'fac.eq.heavy': ['Berat', 'Heavy'],
  'fac.sun.open': ['Terbuka (banyak jendela)', 'Open (lots of windows)'],
  'fac.sun.normal': ['Normal (sebagian tertutup)', 'Normal (partly shaded)'],
  'fac.sun.closed': ['Tertutup (tanpa jendela)', 'Enclosed (no windows)'],
  'fac.calcPk': ['Hitung Kebutuhan PK', 'Calculate PK'],
  'fac.loc': ['Lokasi', 'Location'],
  'fac.problem': ['Jenis Masalah', 'Problem type'],
  'fac.detail': ['Detail', 'Details'],
  'fac.reporter': ['Pelapor', 'Reported by'],
  'fac.urgency': ['Urgensi', 'Urgency'],
  'fac.urg.low': ['Rendah', 'Low'],
  'fac.urg.mid': ['Sedang', 'Medium'],
  'fac.urg.high': ['Tinggi', 'High'],
  'fac.create': ['Buat Work Order', 'Create work order'],
  'fac.pm': ['Jadwal Preventive Maintenance', 'Preventive maintenance'],
  'fac.woTitle': ['Work Order Fasilitas', 'Facility work orders'],
  'fac.prob.ac': ['AC Tidak Dingin / Bocor', 'AC not cooling / leaking'],
  'fac.prob.light': ['Lampu Mati / Kelistrikan', 'Lights out / electrical'],
  'fac.prob.plumb': ['Plumbing (Toilet / Keran / Air)', 'Plumbing (toilet, tap, water)'],
  'fac.prob.lift': ['Lift / Escalator', 'Lift / escalator'],
  'fac.prob.door': ['Pintu / Jendela / Furniture', 'Door, window, or furniture'],
  'fac.prob.clean': ['Kebersihan / Kebun', 'Cleaning / grounds'],
  'fac.prob.other': ['Lainnya', 'Other'],
  'ph.room': ['Lantai 2 — Ruang Rapat Merah', 'Level 2 — Red meeting room'],
  'ph.phone': ['Nama & Nomor HP', 'Name & mobile number'],
  'fac.kpi.pm': ['PM Bulan Ini', 'PM this month'],
  'fac.kpi.ac': ['Unit AC Indoor', 'Indoor AC units'],
  'fac.kpi.wo': ['WO Facility', 'Facility work orders'],
  'fac.kpi.lift': ['Ketersediaan Lift', 'Lift availability'],
  'fac.pmEmpty': ['Belum ada jadwal PM.', 'No PM schedule yet.'],
  'fac.addPm': ['Tambah Jadwal', 'Add schedule'],
  'fac.woEmpty': ['Belum ada work order fasilitas.', 'No facility work orders yet.'],
  'fac.col.equip': ['Peralatan', 'Equipment'],
  'fac.col.total': ['Total', 'Total'],
  'fac.col.done': ['Selesai', 'Done'],
  'fac.col.progress': ['Progress', 'Progress'],
  'fac.col.next': ['Berikutnya', 'Next'],
  'fac.col.loc': ['Lokasi', 'Location'],
  'fac.saved': ['Work order tersimpan', 'Work order saved'],
  'fac.savedBody': [
    '✅ WORK ORDER TERSIMPAN\nNo: {no}\nLokasi: {loc}\nStatus: {status}\nTeknisi: {tech}',
    '✅ WORK ORDER SAVED\nNo: {no}\nLocation: {loc}\nStatus: {status}\nTechnician: {tech}'
  ],

  'report.title': ['📊 Laporan & Summary', '📊 Reports'],
  'report.sub': ['Rekap dari database sesuai periode yang dipilih.', 'A recap from the database for the period you choose.'],
  'report.filter': ['Filter Laporan', 'Report filter'],
  'report.from': ['Periode Awal', 'From'],
  'report.to': ['Periode Akhir', 'To'],
  'report.go': ['Generate dari Database', 'Generate from database'],
  'report.prompt': ['Pilih periode lalu tekan Generate.', 'Choose a period, then press Generate.'],
  'report.body': [
    '📑 LAPORAN ISSD {from} s/d {to}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTotal Listrik : {kwh} kWh\nTotal Gas     : {gas} MMbtu\nTotal Air     : {water} m³\nBiaya Listrik : Rp {costPower}\nBiaya Gas     : Rp {costGas}\nBiaya Air     : Rp {costWater}\nTotal Biaya   : Rp {cost}\nCO₂           : {co2} ton\nWork orders   : {wo}\nTiket IT      : {tickets}\nBaris energi  : {months} bulan{peak}\nDibuat        : {at}',
    '📑 ISSD REPORT {from} to {to}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nElectricity : {kwh} kWh\nGas         : {gas} MMbtu\nWater       : {water} m³\nPower cost  : Rp {costPower}\nGas cost    : Rp {costGas}\nWater cost  : Rp {costWater}\nTotal cost  : Rp {cost}\nCO₂         : {co2} t\nWork orders : {wo}\nIT tickets  : {tickets}\nEnergy rows : {months} months{peak}\nGenerated   : {at}'
  ],
  'report.peak': [' · puncak: {label}', ' · peak: {label}'],

  'ai.title': ['🤖 AI Assistant ISSD', '🤖 ISSD AI assistant'],
  'ai.sub': [
    'Tanyakan apa saja tentang data ISSD — dijawab otomatis dari data terkini.',
    'Ask about ISSD data — answers use the latest figures.'
  ],
  'ai.chat': ['Percakapan', 'Conversation'],
  'ai.focus': ['Modul Fokus', 'Focus on'],
  'ai.q': ['Pertanyaan', 'Question'],
  'ai.send': ['Kirim', 'Send'],
  'ai.clear': ['Bersihkan', 'Clear'],
  'ai.history': ['Riwayat Pertanyaan', 'Question history'],
  'ai.mod.all': ['Semua Modul', 'All modules'],
  'ai.mod.energy': ['Energy', 'Energy'],
  'ai.mod.safety': ['Safety & HSE', 'Safety & HSE'],
  'ai.mod.ga': ['General Affairs', 'General Affairs'],
  'ai.mod.it': ['IT', 'IT'],
  'ai.mod.fac': ['Facility', 'Facility'],
  'ai.needQ': ['Silakan tuliskan pertanyaan terlebih dahulu.', 'Write a question first.'],
  'ai.waiting': ['⏳ Meminta jawaban ke AI…', '⏳ Asking the assistant…'],
  'ai.empty': ['Belum ada percakapan.', 'No questions yet.'],
  'ai.col.time': ['Waktu', 'Time'],
  'ai.col.mod': ['Modul', 'Module'],
  'ai.col.q': ['Pertanyaan', 'Question'],

  'settings.title': ['⚙ Pengaturan', '⚙ Settings'],
  'settings.sub': [
    'Tarif, target, KPI, dan infrastruktur IT. Klik nilai untuk mengubah.',
    'Tariffs, targets, KPIs, and IT infrastructure. Click a value to change it.'
  ],
  'settings.tariff': ['Tarif & Target', 'Tariffs & targets'],
  'settings.kpi': ['Site KPI', 'Site KPIs'],
  'settings.infra': ['Infrastruktur IT', 'IT infrastructure'],
  'settings.account': ['Akun Saya', 'My account'],
  'settings.pw': ['Ganti Password', 'Change password'],
  'settings.pwHelp': [
    'Password lama diverifikasi dulu. Setelah diganti, perangkat lain diminta login ulang.',
    'Your current password is checked first. Other devices are asked to sign in again.'
  ],
  'settings.users': ['Manajemen Pengguna', 'Users'],
  'settings.addUser': ['+ Tambah Pengguna', '+ Add user'],
  'settings.roleHelp': [
    'Role <b>admin</b> boleh menghapus data dan mengubah pengaturan; <b>staff</b> hanya menambah/mengubah data operasional.',
    'An <b>admin</b> can delete records and change settings; <b>staff</b> can only add or edit operational data.'
  ],
  'settings.click': ['Klik untuk mengubah', 'Click to edit'],
  'settings.newValue': ['Nilai baru untuk {key}', 'New value for {key}'],
  'settings.severity': ['Severity', 'Severity'],
  'settings.editInfra': ['Ubah Infrastruktur', 'Edit infrastructure'],
  'settings.editKpi': ['Ubah KPI', 'Edit KPI'],
  'settings.editSetting': ['Ubah Setting', 'Edit setting'],
  'settings.audit': ['Perubahan tercatat di log aktivitas.', 'The change is written to the activity log.'],
  'settings.saved': ['Tersimpan', 'Saved'],
  'settings.col.user': ['Username', 'Username'],
  'settings.col.role': ['Role', 'Role'],
  'settings.col.created': ['Dibuat', 'Created'],
  'settings.col.key': ['Key', 'Key'],
  'settings.col.label': ['Label', 'Label'],
  'settings.col.value': ['Nilai', 'Value'],
  'settings.col.unit': ['Unit', 'Unit'],
  'settings.col.color': ['Color', 'Color'],
  'settings.noSettings': ['Tidak ada setting.', 'No settings.'],
  'settings.noKpi': ['Tidak ada KPI.', 'No KPIs.'],
  'settings.noInfra': ['Tidak ada infra IT.', 'No IT infrastructure rows.'],
  'settings.noUsers': ['Belum ada pengguna lain.', 'No other users yet.'],
  'settings.self': ['akun sendiri', 'this account'],
  'settings.addTitle': ['Tambah Pengguna', 'Add user'],
  'settings.pwMin': ['Password (min. 6 karakter)', 'Password (at least 6 characters)'],
  'settings.add': ['Tambah', 'Add'],
  'settings.userAdded': ['Pengguna "{name}" ditambahkan', 'User “{name}” added'],
  'settings.oldPw': ['Password Lama', 'Current password'],
  'settings.newPw': ['Password Baru (min. 6 karakter)', 'New password (at least 6 characters)'],
  'settings.savePw': ['Simpan Password', 'Save password'],
  'settings.pwChanged': [
    'Password diganti. Perangkat lain akan diminta login ulang.',
    'Password updated. Other devices will be asked to sign in again.'
  ],
  'settings.delTitle': ['Hapus pengguna?', 'Delete this user?'],
  'settings.delMsg': ['{label}\n\nSesi login pengguna ini juga dicabut.', '{label}\n\nTheir sign-in sessions are revoked too.'],
  'settings.deleted': ['Pengguna dihapus', 'User deleted'],

  'modal.edit': ['Ubah Data', 'Edit'],
  'modal.save': ['Simpan', 'Save'],
  'modal.saving': ['Menyimpan…', 'Saving…'],
  'modal.saved': ['Tersimpan di database', 'Saved to the database'],
  'modal.cancel': ['Batal', 'Cancel'],
  'modal.close': ['Tutup', 'Close'],
  'modal.confirm': ['Konfirmasi', 'Please confirm'],
  'modal.delete': ['Hapus', 'Delete'],
  'modal.auto': ['otomatis', 'filled in for you'],
  'modal.add': ['Tambah {title}', 'Add {title}'],
  'modal.editNamed': ['Ubah {title} · {label}', 'Edit {title} · {label}'],
  'modal.editHint': [
    'Perubahan dicatat beserta nama Anda di log aktivitas.',
    'The change is logged with your name.'
  ],
  'modal.delTitle': ['Hapus {title}?', 'Delete {title}?'],
  'modal.delMsg': [
    '{label}\n\nData dihapus permanen dari database. Riwayat perubahannya tetap tercatat di log aktivitas.',
    '{label}\n\nThis is removed from the database. The change stays in the activity log.'
  ],
  'modal.deleted': ['Data dihapus', 'Deleted'],
  'modal.missing': ['Data tidak ditemukan, muat ulang halaman.', 'That record wasn’t found. Refresh the page.'],
  'modal.unknownSchema': ['Skema "{name}" tidak dikenal', 'Unknown form “{name}”'],
  'crud.edit': ['Ubah', 'Edit'],
  'crud.delete': ['Hapus', 'Delete'],
  'crud.updated': ['{title} → {value}', '{title} → {value}'],

  'crud.wo': ['Work Order', 'Work order'],
  'crud.wo.no': ['Nomor', 'Number'],
  'crud.wo.module': ['Modul', 'Module'],
  'crud.wo.priority': ['Prioritas', 'Priority'],
  'crud.wo.status': ['Status', 'Status'],
  'crud.wo.loc': ['Lokasi', 'Location'],
  'crud.wo.owner': ['Ditangani oleh', 'Assigned to'],
  'crud.wo.reporter': ['Pelapor', 'Reported by'],
  'crud.wo.desc': ['Uraian', 'Description'],
  'crud.ticket': ['Tiket IT', 'IT ticket'],
  'crud.ticket.no': ['Nomor Tiket', 'Ticket number'],
  'crud.ticket.user': ['Pengguna', 'User'],
  'crud.ticket.host': ['Hostname', 'Hostname'],
  'crud.ticket.cat': ['Kategori', 'Category'],
  'crud.ticket.owner': ['Ditangani oleh', 'Assigned to'],
  'crud.ticket.issue': ['Masalah', 'Issue'],
  'crud.book': ['Peminjaman Kendaraan', 'Vehicle booking'],
  'crud.book.no': ['No. Booking', 'Booking no.'],
  'crud.book.who': ['Peminjam', 'Borrower'],
  'crud.book.when': ['Tanggal & Jam Pakai', 'Date & time of use'],
  'crud.book.vehicle': ['Kendaraan', 'Vehicle'],
  'crud.book.driver': ['Supir', 'Driver'],
  'crud.book.km': ['Estimasi Km', 'Estimated km'],
  'crud.book.purpose': ['Tujuan', 'Purpose'],
  'crud.stock': ['Stok ATK', 'Stationery stock'],
  'crud.stock.item': ['Nama Item', 'Item'],
  'crud.stock.qty': ['Stok Sekarang', 'On hand'],
  'crud.stock.rop': ['Reorder Point', 'Reorder point'],
  'crud.stock.unit': ['Satuan', 'Unit'],
  'crud.insp': ['Inspeksi Safety', 'Safety inspection'],
  'crud.insp.date': ['Tanggal Inspeksi', 'Inspection date'],
  'crud.insp.area': ['Area', 'Area'],
  'crud.insp.pic': ['PJT / PIC', 'PIC'],
  'crud.insp.finding': ['Temuan', 'Finding'],
  'crud.pm': ['Jadwal Preventive Maintenance', 'Preventive maintenance'],
  'crud.pm.equip': ['Peralatan', 'Equipment'],
  'crud.pm.total': ['Total Unit', 'Total units'],
  'crud.pm.done': ['Selesai', 'Done'],
  'crud.pm.progress': ['Progres', 'Progress'],
  'crud.pm.next': ['Jadwal Berikutnya', 'Next date'],
  'crud.energy': ['Data Energi Bulanan', 'Monthly energy'],
  'crud.energy.kwh': ['Listrik (kWh)', 'Electricity (kWh)'],
  'crud.energy.gas': ['Gas (MMbtu)', 'Gas (MMbtu)'],
  'crud.energy.water': ['Air (m³)', 'Water (m³)'],
  'crud.energy.exclude': [
    'Kecilkan bulan ini dari tren (mis. pembacaan meter kumulatif)',
    'Leave this month out of the trend (for example a cumulative meter reading)'
  ],
  'crud.dept': ['Konsumsi per Departemen', 'Use by department'],
  'crud.dept.name': ['Departemen', 'Department'],
  'crud.dept.kwh': ['Konsumsi (kWh)', 'Use (kWh)'],
  'crud.dept.share': ['Porsi (%)', 'Share (%)'],
  'crud.dept.vs': ['vs Bulan Lalu (%)', 'vs last month (%)'],
  'crud.fuel': ['Pemakaian Bahan Bakar', 'Fuel use'],
  'crud.fuel.type': ['Jenis (Solar, Petrol, dsb.)', 'Type (diesel, petrol, etc.)'],
  'crud.alert': ['Alert Manual', 'Manual alert'],
  'crud.alert.level': ['Level', 'Level'],
  'crud.alert.extra': ['Nilai Tambahan', 'Extra value'],
  'crud.alert.msg': ['Pesan', 'Message'],

  'calc.empty': ['(tidak diisi)', '(not provided)'],
  'calc.people': ['{n} orang', '{n} people'],
  'calc.elec.use': ['Pemakaian listrik saat ini : {kwh} kWh', 'Electricity use now        : {kwh} kWh'],
  'calc.elec.base': ['Baseline / Target           : {base} kWh', 'Baseline / target          : {base} kWh'],
  'calc.elec.tariff': ['Tarif rata-rata             : Rp {tarif} / kWh', 'Average tariff             : Rp {tarif} / kWh'],
  'calc.rule': ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'],
  'calc.elec.cost': ['Estimasi Biaya Bulan Ini    : Rp {cost}', 'Estimated cost this month  : Rp {cost}'],
  'calc.elec.diff': ['Selisih vs Baseline         : {sign} {kwh} kWh', 'Versus baseline            : {sign} {kwh} kWh'],
  'calc.elec.pct': ['Persentase Perubahan        : {arrow} {pct} % → {verdict}', 'Change                     : {arrow} {pct}% → {verdict}'],
  'calc.elec.verdict.good': ['HEMAT', 'SAVING'],
  'calc.elec.verdict.ok': ['CUKUP', 'CLOSE'],
  'calc.elec.verdict.over': ['OVER', 'OVER'],
  'calc.elec.end': ['Kesimpulan                  : {text}', 'Conclusion                 : {text}'],
  'calc.elec.end.good': ['✅ Bagus — target hemat ≥3% tercapai.', '✅ On target — at least 3% saved.'],
  'calc.elec.end.ok': ['⚠️ Cukup — mendekati target hemat ≥3%.', '⚠️ Close — not yet at the 3% saving target.'],
  'calc.elec.end.over': ['❌ Melebihi baseline. Segera lakukan audit energi!', '❌ Above the baseline. Run an energy audit soon.'],
  'calc.gas.use': ['Pemakaian gas         : {g} MMbtu', 'Gas use              : {g} MMbtu'],
  'calc.gas.conv': ['Konversi              : {k} MWh/MMbtu', 'Conversion           : {k} MWh/MMbtu'],
  'calc.gas.price': ['Harga satuan          : Rp {h}/MMbtu', 'Unit price           : Rp {h}/MMbtu'],
  'calc.gas.mwh': ['Energi ekuivalen      : {mwh} MWh', 'Equivalent energy    : {mwh} MWh'],
  'calc.gas.cost': ['Estimasi Biaya        : Rp {cost}', 'Estimated cost       : Rp {cost}'],
  'calc.gas.note': [
    'Rekomendasi           : Laporan bulanan memakai satuan MMbtu (WII-QR04-39).',
    'Note                 : Monthly reports use MMbtu (WII-QR04-39).'
  ],
  'calc.eff.before': ['Sebelum Perbaikan  : {a} satuan energi / unit', 'Before             : {a} energy units / unit'],
  'calc.eff.after': ['Sesudah Perbaikan  : {b} satuan energi / unit', 'After              : {b} energy units / unit'],
  'calc.eff.volume': ['Volume Aktivitas   : {u} unit', 'Activity volume    : {u} units'],
  'calc.eff.pct': ['Efisiensi Per Unit : {p} %', 'Efficiency / unit  : {p}%'],
  'calc.eff.saved': ['Total Penghematan  : {n} satuan energi', 'Total saved        : {n} energy units'],
  'calc.eff.end': ['Kesimpulan         : {text}', 'Conclusion         : {text}'],
  'calc.eff.end.great': ['✅ SANGAT BAGUS', '✅ Excellent'],
  'calc.eff.end.good': ['👍 BAIK', '👍 Good'],
  'calc.eff.end.some': ['📈 Ada perbaikan', '📈 Some improvement'],
  'calc.eff.end.none': ['⚠️ Belum ada peningkatan', '⚠️ No improvement yet'],
  'calc.jsa.head': ['⚠️ JOB SAFETY ANALYSIS (JSA)', '⚠️ JOB SAFETY ANALYSIS (JSA)'],
  'calc.jsa.job': ['Jenis Pekerjaan : {v}', 'Job type        : {v}'],
  'calc.jsa.level': ['Level Risiko    : 🔴 {v}', 'Risk level      : 🔴 {v}'],
  'calc.jsa.where': ['Lokasi/Kondisi  : {v}', 'Location        : {v}'],
  'calc.jsa.workers': ['Pekerja         : {v}', 'Workers         : {v}'],
  'calc.jsa.tools': ['Peralatan       : {v}', 'Equipment       : {v}'],
  'calc.jsa.hazards': ['IDENTIFIKASI BAHAYA:', 'HAZARDS:'],
  'calc.jsa.control': [
    'CONTROL: Eliminasi → Substitusi → Engineering → Administrasi (izin kerja, TBM) → PPE',
    'CONTROLS: Eliminate → substitute → engineer → administer (permit, toolbox talk) → PPE'
  ],
  'calc.jsa.sign': ['SIGN-OFF: Pekerja / Pengawas / HSE Officer', 'SIGN-OFF: Worker / supervisor / HSE officer'],
  'calc.it.head': ['🔍 DIAGNOSA IT ISSD', '🔍 ISSD IT DIAGNOSIS'],
  'calc.it.host': ['Host: {v}', 'Host: {v}'],
  'calc.it.cat': ['Kategori: {v}', 'Category: {v}'],
  'calc.it.sym': ['Gejala: {v}', 'Symptoms: {v}'],
  'calc.it.sla': ['SLA: Low 24j | Medium 8j | High 2j | Critical 30m', 'SLA: Low 24h | Medium 8h | High 2h | Critical 30m'],
  'calc.ac.head': ['❄️ PERHITUNGAN KEBUTUHAN AC', '❄️ COOLING LOAD'],
  'calc.ac.size': ['Ukuran: {p} x {l} x {t} m → {area} m²', 'Size: {p} × {l} × {t} m → {area} m²'],
  'calc.ac.meta': ['Orang: {o} · Peralatan: {eq} ×{factor} · Matahari: {sun}', 'People: {o} · Equipment: {eq} ×{factor} · Sun: {sun}'],
  'calc.ac.btu': ['BTU/jam: {n}', 'BTU/h: {n}'],
  'calc.ac.pk': ['Exact: {pk} PK · Rekomendasi: {rec} PK', 'Exact: {pk} PK · Suggested: {rec} PK'],

  'err.badCreds': ['Username atau password salah', 'Username or password is incorrect'],
  'err.tooMany': [
    'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.',
    'Too many failed attempts. Try again in 15 minutes.'
  ],
  'err.userMissing': ['Pengguna tidak ditemukan', 'User not found'],
  'err.oldPassword': ['Password lama salah', 'Current password is incorrect'],
  'err.passwordShortNew': ['Password baru minimal 6 karakter', 'New password must be at least 6 characters'],
  'err.passwordShort': ['Password minimal 6 karakter', 'Password must be at least 6 characters'],
  'err.usernameRule': [
    'Username 2–40 karakter, hanya huruf/angka . _ -',
    'Username must be 2–40 characters: letters, numbers, . _ -'
  ],
  'err.roleRule': ['Role harus admin atau staff', 'Role must be admin or staff'],
  'err.cantDeleteSelf': ['Tidak bisa menghapus akun sendiri', 'You can’t delete your own account'],
  'err.lastAdmin': ['Minimal harus tersisa satu admin', 'At least one admin has to remain'],
  'err.captchaUnknown': [
    'Kode captcha tidak dikenal atau sudah kedaluwarsa. Muat ulang captcha.',
    'That security check is unknown or expired. Load a new one.'
  ],
  'err.captchaExpired': [
    'Kode captcha sudah kedaluwarsa. Muat ulang captcha.',
    'That security check expired. Load a new one.'
  ],
  'err.captchaWrong': ['Jawaban captcha salah', 'Security check answer is wrong'],
  'err.userNameRequired': ['Field "user_name" wajib diisi', 'Name is required'],
  'err.issueRequired': ['Field "issue" wajib diisi', 'The problem description is required'],
  'err.nameTooLong': ['Nama terlalu panjang (maks 100 karakter)', 'Name is too long (100 characters max)'],
  'err.issueTooLong': [
    'Uraian masalah terlalu panjang (maks 2000 karakter)',
    'The description is too long (2,000 characters max)'
  ],
  'err.noFields': ['Tidak ada field yang dikirim untuk diperbarui', 'Nothing was sent to update'],
  'err.excelRequired': ['File Excel wajib diunggah', 'An Excel file is required'],
  'err.fileInvalid': ['File tidak valid', 'That file isn’t valid'],
  'err.fileEmpty': ['File kosong', 'The file is empty'],
  'err.noEnergyExport': ['Belum ada data energi untuk diekspor', 'There’s no energy data to export'],
  'err.badPeriod': ['Periode awal tidak boleh melewati periode akhir', 'The start period can’t be after the end period'],
  'err.badMonth': ['Bulan harus 1–12', 'Month must be 1–12'],
  'err.waterPieMonth': ['Parameter month harus YYYY-MM', 'month must be YYYY-MM'],
  'err.waterPieYear': ['Parameter year harus diisi', 'year is required'],
  'err.waterPieMismatch': ['Parameter year tidak cocok dengan month', 'year does not match month'],
  'err.questionRequired': ['Pertanyaan wajib diisi', 'A question is required'],
  'err.questionTooLong': [
    'Pertanyaan terlalu panjang (maks 2000 karakter)',
    'The question is too long (2,000 characters max)'
  ],
  'err.badId': ['ID tidak valid', 'That id isn’t valid'],
  'err.loginFail': ['Login gagal', 'Sign-in failed'],
  'err.method': ['Method tidak diizinkan', 'That method isn’t allowed'],
  'err.adminOnly': ['Hanya admin yang boleh mengelola pengguna', 'Only an admin can manage users'],
  'err.adminDelete': ['Menghapus data hanya untuk admin', 'Only an admin can delete records'],
  'err.adminSettings': ['Mengubah pengaturan hanya untuk admin', 'Only an admin can change settings'],
  'err.badJson': ['Body harus berupa objek JSON', 'Body must be a JSON object'],
  'err.emptyModel': ['Jawaban model kosong', 'The model returned an empty answer'],
  'err.noAiKey': ['OPENAI_API_KEY belum dikonfigurasi', 'OPENAI_API_KEY is not configured'],
  'err.badColumn': ['Nama tabel/kolom tidak valid', 'That table or column name isn’t valid'],
  'err.userTaken': ['Username "{name}" sudah dipakai', 'Username “{name}” is already in use'],
  'err.fieldRequired': ['Field "{field}" wajib diisi', '{field} is required'],
  'err.fieldNumber': ['Field "{field}" harus berupa angka', '{field} must be a number'],
  'err.fieldInvalid': ['Field "{field}" tidak valid', '{field} isn’t valid'],
  'err.fieldLong': ['Field "{field}" terlalu panjang', '{field} is too long'],
  'err.fieldOneOf': ['Field "{field}" harus salah satu dari: {list}', '{field} must be one of: {list}'],
  'err.ticketCap': [
    'Batas {n} tiket per jam tercapai. Coba lagi nanti atau hubungi IT langsung.',
    'The limit of {n} tickets per hour is reached. Try later, or contact IT directly.'
  ],
  'err.unknownTable': ['Tabel {name} tidak dikenal', 'Unknown table {name}'],
  'err.excelRead': ['Gagal membaca file Excel: {detail}', 'Couldn’t read the Excel file: {detail}'],
  'err.aiDown': ['Gagal menghubungi API AI: {detail}', 'Couldn’t reach the AI service: {detail}'],
  'err.offline': ['Tidak bisa menghubungi server. Jalankan npm start.', 'Can’t reach the server. Run npm start.'],
  'err.badResponse': ['Respons server tidak valid ({status})', 'The server response wasn’t valid ({status})'],
  'err.requestFail': ['Permintaan gagal ({status})', 'Request failed ({status})'],
  'err.session': ['Sesi berakhir. Silakan login kembali.', 'Your session ended. Please sign in again.'],
  'err.previewMissing': ['Data pratinjau tidak ditemukan.', 'Preview data wasn’t found.'],
  'err.previewGap': ['Data ini tidak ada di tampilan publik.', 'This isn’t included in the public preview.'],
  'err.previewOnly': [
    'Ini tampilan untuk dilihat. Perubahan hanya tersimpan di server internal.',
    'This is a view-only preview. Changes are saved only on the internal server.'
  ],
  'err.notFound': ['Tidak ditemukan', 'Not found'],
  'err.forbidden': ['Akses ditolak', 'Access denied']
};

const LISTS = {
  'jsa.hazard.hotwork': [
    ['Bahaya kebakaran & ledakan', 'Panas radiasi & UV', 'Kebocoran gas mudah terbakar', 'Asap & fumes', 'Luka bakar / cedera mata'],
    ['Fire and explosion', 'Radiant heat and UV', 'Flammable gas leak', 'Smoke and fumes', 'Burns or eye injury']
  ],
  'jsa.hazard.workheight': [
    ['Terjatuh dari ketinggian', 'Jatuhnya tools', 'Kerusakan scaffolding', 'Angin kencang', 'Kelelahan pekerja'],
    ['Fall from height', 'Dropped tools', 'Damaged scaffold', 'Strong wind', 'Worker fatigue']
  ],
  'jsa.hazard.confined': [
    ['Kekurangan oksigen', 'Gas beracun', 'Aliran cairan tiba-tiba', 'Terjebak', 'Panas berlebih'],
    ['Lack of oxygen', 'Toxic gas', 'Sudden liquid ingress', 'Entrapment', 'Excess heat']
  ],
  'jsa.hazard.electrical': [
    ['Sengatan listrik', 'Arc flash', 'Korsleting panel', 'Isolasi rusak', 'Mati mendadak'],
    ['Electric shock', 'Arc flash', 'Panel short circuit', 'Damaged insulation', 'Sudden power loss']
  ],
  'jsa.hazard.lifting': [
    ['Sling putus', 'Crane roboh', 'Beban jatuh', 'Tabrakan struktur', 'Operator tidak kompeten'],
    ['Sling failure', 'Crane collapse', 'Dropped load', 'Striking the structure', 'Unqualified operator']
  ],
  'jsa.hazard.lain': [
    ['Identifikasi bahaya spesifik', 'PPE sesuai SOP', 'Toolbox meeting', 'Checklist peralatan'],
    ['Identify the specific hazards', 'PPE per the SOP', 'Toolbox meeting', 'Equipment checklist']
  ],
  'it.steps.net': [
    ['Cek kabel / lampu NIC', 'ipconfig /all — IP valid?', 'Ping gateway & 8.8.8.8', 'nslookup DNS', 'Ganti port/kabel', 'Eskalasi Network Team'],
    ['Check the cable and NIC lights', 'ipconfig /all — is the IP valid?', 'Ping the gateway and 8.8.8.8', 'nslookup for DNS', 'Try another port or cable', 'Escalate to the network team']
  ],
  'it.steps.email': [
    ['Cek internet & akun AD', 'Profile Outlook baru', 'Uji OWA browser', 'Repair Office', 'Cek ukuran OST'],
    ['Check internet and the AD account', 'New Outlook profile', 'Try Outlook on the web', 'Repair Office', 'Check the OST size']
  ],
  'it.steps.wifi': [
    ['Forget SSID + reconnect', 'Coba 5 GHz', 'flushdns + winsock reset', 'Update driver wireless', 'Cek AP/DHCP'],
    ['Forget the SSID and reconnect', 'Try 5 GHz', 'flushdns and winsock reset', 'Update the wireless driver', 'Check the AP and DHCP']
  ],
  'it.steps.print': [
    ['Printer Ready?', 'Ping IP printer', 'Restart Print Spooler', 'Reinstall driver', 'Uji print Notepad'],
    ['Is the printer Ready?', 'Ping the printer IP', 'Restart Print Spooler', 'Reinstall the driver', 'Test print from Notepad']
  ],
  'it.steps.vpn': [
    ['Internet stabil?', 'User + 2FA', 'Update client VPN', 'Uji hotspot HP', 'Kirim log Event Viewer'],
    ['Is the internet stable?', 'User and 2FA', 'Update the VPN client', 'Try a phone hotspot', 'Send the Event Viewer log']
  ],
  'it.steps.slow': [
    ['Task Manager CPU/RAM/Disk', 'Disk Cleanup + SFC', 'Disable startup junk', 'Defender Offline Scan', 'Cek kesehatan SSD'],
    ['Task Manager: CPU, RAM, disk', 'Disk Cleanup and SFC', 'Disable startup junk', 'Defender offline scan', 'Check SSD health']
  ],
  'it.steps.pw': [
    ['Verifikasi identitas helpdesk', 'SSPR portal', 'Reset AD + must change password', 'Unlock account', 'Bersihkan Credential Manager'],
    ['Verify identity with the helpdesk', 'SSPR portal', 'Reset AD and force a password change', 'Unlock the account', 'Clear Credential Manager']
  ]
};

const MONTHS = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};

const ID_MONTH_EN = { Mei: 'May', Agu: 'Aug', Okt: 'Oct', Des: 'Dec' };

const EXACT_ERRORS = {
  'Username atau password salah': 'err.badCreds',
  'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.': 'err.tooMany',
  'Pengguna tidak ditemukan': 'err.userMissing',
  'Password lama salah': 'err.oldPassword',
  'Password baru minimal 6 karakter': 'err.passwordShortNew',
  'Password minimal 6 karakter': 'err.passwordShort',
  'Username 2–40 karakter, hanya huruf/angka . _ -': 'err.usernameRule',
  'Role harus admin atau staff': 'err.roleRule',
  'Tidak bisa menghapus akun sendiri': 'err.cantDeleteSelf',
  'Minimal harus tersisa satu admin': 'err.lastAdmin',
  'Kode captcha tidak dikenal atau sudah kedaluwarsa. Muat ulang captcha.': 'err.captchaUnknown',
  'Kode captcha sudah kedaluwarsa. Muat ulang captcha.': 'err.captchaExpired',
  'Jawaban captcha salah': 'err.captchaWrong',
  'Field "user_name" wajib diisi': 'err.userNameRequired',
  'Field "issue" wajib diisi': 'err.issueRequired',
  'Nama terlalu panjang (maks 100 karakter)': 'err.nameTooLong',
  'Uraian masalah terlalu panjang (maks 2000 karakter)': 'err.issueTooLong',
  'Tidak ada field yang dikirim untuk diperbarui': 'err.noFields',
  'File Excel wajib diunggah': 'err.excelRequired',
  'File tidak valid': 'err.fileInvalid',
  'File kosong': 'err.fileEmpty',
  'Belum ada data energi untuk diekspor': 'err.noEnergyExport',
  'Periode awal tidak boleh melewati periode akhir': 'err.badPeriod',
  'Bulan harus 1–12': 'err.badMonth',
  'Parameter month harus YYYY-MM': 'err.waterPieMonth',
  'Parameter year harus diisi': 'err.waterPieYear',
  'Parameter year tidak cocok dengan month': 'err.waterPieMismatch',
  'Pertanyaan wajib diisi': 'err.questionRequired',
  'Pertanyaan terlalu panjang (maks 2000 karakter)': 'err.questionTooLong',
  'ID tidak valid': 'err.badId',
  'Login gagal': 'err.loginFail',
  'Method tidak diizinkan': 'err.method',
  'Hanya admin yang boleh mengelola pengguna': 'err.adminOnly',
  'Menghapus data hanya untuk admin': 'err.adminDelete',
  'Mengubah pengaturan hanya untuk admin': 'err.adminSettings',
  'Body harus berupa objek JSON': 'err.badJson',
  'Jawaban model kosong': 'err.emptyModel',
  'OPENAI_API_KEY belum dikonfigurasi': 'err.noAiKey',
  'Nama tabel/kolom tidak valid': 'err.badColumn',
  'Tidak ditemukan': 'err.notFound',
  'Akses ditolak': 'err.forbidden',
  'Forbidden': 'err.forbidden'
};

const ERROR_PATTERNS = [
  [/^Username "(.+)" sudah dipakai$/, 'err.userTaken', (m) => ({ name: m[1] })],
  [/^Field "(.+)" wajib diisi$/, 'err.fieldRequired', (m) => ({ field: m[1] })],
  [/^Field "(.+)" harus berupa angka$/, 'err.fieldNumber', (m) => ({ field: m[1] })],
  [/^Field "(.+)" tidak valid$/, 'err.fieldInvalid', (m) => ({ field: m[1] })],
  [/^Field "(.+)" terlalu panjang$/, 'err.fieldLong', (m) => ({ field: m[1] })],
  [/^Field "(.+)" harus salah satu dari: (.+)$/, 'err.fieldOneOf', (m) => ({ field: m[1], list: m[2] })],
  [/^Batas (\d+) tiket per jam tercapai\. Coba lagi nanti atau hubungi IT langsung\.$/, 'err.ticketCap', (m) => ({ n: m[1] })],
  [/^Tabel (.+) tidak dikenal$/, 'err.unknownTable', (m) => ({ name: m[1] })],
  [/^Gagal membaca file Excel: (.+)$/, 'err.excelRead', (m) => ({ detail: m[1] })],
  [/^Gagal menghubungi API AI: (.+)$/, 'err.aiDown', (m) => ({ detail: m[1] })]
];

const listeners = new Set();
let lang = 'id';
let bound = false;

function fill(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
}

export function getLang() {
  return lang;
}

export function localeTag() {
  return lang === 'en' ? 'en-GB' : 'id-ID';
}

export function t(key, vars) {
  const pair = PAIRS[key];
  const raw = pair ? pair[lang === 'en' ? 1 : 0] : undefined;
  if (typeof raw !== 'string') return key;
  return fill(raw, vars);
}

export function tList(key) {
  const pair = LISTS[key];
  if (!pair) return [];
  const list = pair[lang === 'en' ? 1 : 0];
  return Array.isArray(list) ? list : [];
}

/* Month names that arrive from the API as Indonesian abbreviations. */
export function localizeMonthText(text) {
  if (text == null) return '';
  const s = String(text);
  if (lang !== 'en') return s;
  return s.replace(/\b(Mei|Agu|Okt|Des)\b/g, (m) => ID_MONTH_EN[m]);
}

export function monthName(m) {
  if (m === undefined || m === null || m === '') return '';
  const i = Number(m) - 1;
  const list = MONTHS[lang] || MONTHS.id;
  if (i >= 0 && i < 12) return list[i];
  return t('month.fallback', { m });
}

/* Known server/client messages. Anything else is left unchanged. */
export function tx(message) {
  if (message == null) return '';
  const msg = String(message);
  if (EXACT_ERRORS[msg]) return t(EXACT_ERRORS[msg]);
  for (const [re, key, vars] of ERROR_PATTERNS) {
    const m = re.exec(msg);
    if (m) return t(key, vars(m));
  }
  return msg;
}

export function applyDom(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
  /* Default field values that are sample copy, not saved records.
     Skip the field once someone has typed something else. */
  root.querySelectorAll('[data-i18n-value]').forEach((el) => {
    const key = el.getAttribute('data-i18n-value');
    const pair = PAIRS[key];
    if (!pair) return;
    if (el.value === pair[0] || el.value === pair[1] || el.value === '') el.value = t(key);
  });
}

function syncSwitches() {
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    const on = btn.getAttribute('data-set-lang') === lang;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLang(next) {
  const n = next === 'en' ? 'en' : 'id';
  if (n === lang) {
    if (typeof document !== 'undefined') syncSwitches();
    return;
  }
  lang = n;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode or tests without storage */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    applyDom(document);
    document.title = t('app.docTitle');
    syncSwitches();
  }
  listeners.forEach((fn) => {
    try {
      fn(lang);
    } catch (err) {
      console.error(err);
    }
  });
}

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'id') return v;
  } catch {
    /* ignore */
  }
  return 'id';
}

export function initI18n() {
  lang = readStored();
  document.documentElement.lang = lang;
  applyDom(document);
  document.title = t('app.docTitle');
  syncSwitches();
  if (!bound) {
    bound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-set-lang]');
      if (!btn) return;
      e.preventDefault();
      setLang(btn.getAttribute('data-set-lang'));
    });
  }
}

export const i18nCatalog = { pairs: PAIRS, lists: LISTS };
