/* Halaman GA: stok ATK dan booking kendaraan. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, fmtNum, rupiah, toast, pill } from '../ui.js';
import { actionsCell, statusPicker, addButton } from '../crud.js';

export const id = 'ga';

function stockStatus(s) {
  if (s.stock < s.rop * 0.7) return 'Order Now';
  if (s.stock < s.rop) return 'Low';
  return 'OK';
}

export async function load() {
  const d = await api.get('/api/ga');
  const kpis = d.kpis || {};
  const low = (d.stock || []).filter((s) => s.stock < s.rop).length;

  renderStats('gaStats', [
    { num: kpis.ga_vehicles?.value || 'N/A', lbl: 'Unit Kendaraan' },
    { num: kpis.ga_attendance?.value || 'N/A', lbl: 'Kehadiran', color: 'green' },
    { num: kpis.ga_visitors?.value || 'N/A', lbl: 'Pengunjung Bulan Ini' },
    { num: low || '0', lbl: 'ATK Stok Menipis', color: low ? 'orange' : 'green' }
  ]);

  renderInto(
    'atkTable',
    table(
      ['Item', 'Stok', 'ROP', 'Satuan', 'Status', 'Aksi'],
      (d.stock || []).map((s) =>
        row([s.item, s.stock, s.rop, s.unit || '-', stockStatus(s), actionsCell('ga_stock', s)]).__html
      ),
      { empty: 'Belum ada data stok.' }
    )
  );
  renderInto('atkAdd', addButton('ga_stock', 'Tambah ATK'));

  renderInto(
    'bookTable',
    table(
      ['No', 'Peminjam', 'Kendaraan', 'Driver', 'Status', 'Aksi'],
      (d.bookings || []).map((b) =>
        row([b.booking_no, b.borrower, b.vehicle, b.driver || '-', statusPicker('vehicle_bookings', b), actionsCell('vehicle_bookings', b)]).__html
      ),
      { empty: 'Belum ada peminjaman.' }
    )
  );
}

export function mount() {
  $('btnPinjam').onclick = async () => {
    try {
      const row = await api.post('/api/ga/bookings', {
        borrower: $('gNama').value,
        use_at: $('gTgl').value,
        purpose: $('gTujuan').value,
        vehicle: $('gMobil').value,
        driver: $('gSupir').value,
        km: Number($('gKm').value)
      });
      $('gRes').textContent =
        `✅ PEMINJAMAN TERSIMPAN\nNo. Booking : ${row.booking_no}\nPeminjam    : ${row.borrower}\nKendaraan   : ${row.vehicle}\nStatus      : ${row.status}\nEstimasi BBM: ${rupiah(row.fuel_est)}`;
      toast('Booking tersimpan');
      load();
    } catch (e) {
      $('gRes').textContent = '❌ ' + e.message;
    }
  };
}
