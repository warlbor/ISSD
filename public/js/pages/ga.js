/* Halaman GA: stok ATK dan booking kendaraan. */
import { api } from '../api.js';
import { $, renderInto, renderStats, table, row, html, esc, rupiah, toast } from '../ui.js';
import { actionsCell, statusPicker, addButton } from '../crud.js';
import { t } from '../i18n.js';

export const id = 'ga';

function stockStatus(s) {
  if (s.stock < s.rop * 0.7) return t('ga.orderNow');
  if (s.stock < s.rop) return t('ga.low');
  return t('ga.ok');
}

export async function load() {
  const d = await api.get('/api/ga');
  const kpis = d.kpis || {};
  const low = (d.stock || []).filter((s) => s.stock < s.rop).length;

  renderStats('gaStats', [
    { num: kpis.ga_vehicles?.value || 'N/A', lbl: t('ga.kpi.vehicles') },
    { num: kpis.ga_attendance?.value || 'N/A', lbl: t('ga.kpi.attendance'), color: 'green' },
    { num: kpis.ga_visitors?.value || 'N/A', lbl: t('ga.kpi.visitors') },
    { num: low || '0', lbl: t('ga.kpi.low'), color: low ? 'orange' : 'green' }
  ]);

  renderInto(
    'atkTable',
    table(
      [t('ga.col.item'), t('ga.col.stock'), t('ga.col.rop'), t('ga.col.unit'), t('home.col.status'), t('energy.col.action')],
      (d.stock || []).map((s) =>
        row([s.item, s.stock, s.rop, s.unit || '-', stockStatus(s), actionsCell('ga_stock', s)]).__html
      ),
      { empty: t('ga.stockEmpty') }
    )
  );
  renderInto('atkAdd', addButton('ga_stock', t('ga.addStock')));

  renderInto(
    'bookTable',
    table(
      [t('home.col.no'), t('crud.book.who'), t('crud.book.vehicle'), t('ga.col.driver'), t('home.col.status'), t('energy.col.action')],
      (d.bookings || []).map((b) =>
        row([b.booking_no, b.borrower, b.vehicle, b.driver || '-', statusPicker('vehicle_bookings', b), actionsCell('vehicle_bookings', b)]).__html
      ),
      { empty: t('ga.bookEmpty') }
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
      $('gRes').textContent = t('ga.savedBody', {
        no: row.booking_no,
        who: row.borrower,
        vehicle: row.vehicle,
        status: row.status,
        fuel: rupiah(row.fuel_est)
      });
      toast(t('ga.saved'));
      load();
    } catch (e) {
      $('gRes').textContent = '❌ ' + e.message;
    }
  };
}
