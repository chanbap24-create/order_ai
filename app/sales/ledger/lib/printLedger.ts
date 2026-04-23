import type { ClientInfo, LedgerType, MonthData, Totals } from '../types';
import { fmt } from './format';

type PrintArgs = {
  client: ClientInfo;
  type: LedgerType;
  startDate: string;
  endDate: string;
  rowCount: number;
  prevBalance: number;
  grouped: MonthData[];
  grandTotal: Totals;
};

export function printLedger(args: PrintArgs) {
  const { client, type, startDate, endDate, rowCount, prevBalance, grouped, grandTotal } = args;
  const prefix = type === 'glass' ? '대유라이프' : '까브드뱅';
  const title = `${prefix} 매출처원장 - ${client.client_name} (${startDate} ~ ${endDate})`;
  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) return;

  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: 'Malgun Gothic','맑은 고딕',sans-serif; margin: 0; padding: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { font-size: 15px; margin: 0 0 4px; color: #2c1810; }
    .sub { font-size: 11px; color: #8a8580; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { padding: 6px 8px; background: #f5f0f0; border-bottom: 2px solid #5A1515; font-weight: 700; color: #5A1515; text-align: right; white-space: nowrap; }
    th:nth-child(1), th:nth-child(2) { text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; white-space: nowrap; text-align: right; }
    td:nth-child(1), td:nth-child(2) { text-align: left; }
    tr.prev-row { background: rgba(90,21,21,0.03); }
    tr.prev-row td { font-weight: 700; color: #5A1515; }
    tr.day-summary { background: #fafafa; }
    tr.day-summary td { font-weight: 600; font-size: 9px; }
    tr.month-summary { background: #FFF8E1; }
    tr.month-summary td { font-weight: 700; color: #5A1515; }
    tr.grand-total { background: #5A1515; }
    tr.grand-total td { color: #fff; font-weight: 700; }
    .pay-row td { color: #1565C0; }
    .bal-pos { color: #c62828; }
    .bal-neg { color: #1565C0; }
    .pay-val { color: #1565C0; }
    @media print { body { padding: 0; } }
  </style></head><body>`);

  w.document.write(`<h2>${prefix} 매출처원장</h2>`);
  w.document.write(`<div class="sub">${client.client_name} (${client.client_code}) &nbsp;|&nbsp; ${startDate} ~ ${endDate} &nbsp;|&nbsp; ${rowCount}건</div>`);
  w.document.write('<table><thead><tr>');
  ['일자', '품목명', '수량', '단가', '공급금액', '부가세', '합계', '수금액', '미수액'].forEach(h => w.document.write(`<th>${h}</th>`));
  w.document.write('</tr></thead><tbody>');

  if (prevBalance !== 0) {
    const balClass = prevBalance > 0 ? 'bal-pos' : 'bal-neg';
    w.document.write(`<tr class="prev-row"><td></td><td>전월미수</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="${balClass}">${fmt(prevBalance)}</td></tr>`);
  }

  let runBal = prevBalance;
  for (const month of grouped) {
    for (const day of month.days) {
      for (let i = 0; i < day.rows.length; i++) {
        const r = day.rows[i];
        w.document.write(`<tr><td>${i === 0 ? day.date.slice(5) : ''}</td><td>${r.item_name}</td><td>${fmt(r.quantity)}</td><td>${fmt(r.selling_price ?? r.unit_price)}</td><td>${fmt(r.supply_amount)}</td><td>${fmt(r.tax_amount)}</td><td>${fmt(r.total_amount)}</td><td></td><td></td></tr>`);
      }
      for (let i = 0; i < day.paymentRows.length; i++) {
        const p = day.paymentRows[i];
        w.document.write(`<tr class="pay-row"><td>${day.rows.length === 0 && i === 0 ? day.date.slice(5) : ''}</td><td>입금</td><td></td><td></td><td></td><td></td><td></td><td class="pay-val">${fmt(p.amount)}</td><td></td></tr>`);
      }
      runBal += day.totals.total - day.totals.payment;
      if (day.rows.length > 1 || day.paymentRows.length > 0) {
        w.document.write(`<tr class="day-summary"><td colspan="2">${day.date.slice(5)} 일계</td><td>${fmt(day.totals.qty)}</td><td></td><td>${fmt(day.totals.supply)}</td><td>${fmt(day.totals.tax)}</td><td>${fmt(day.totals.total)}</td><td class="pay-val">${day.totals.payment ? fmt(day.totals.payment) : ''}</td><td class="bal-pos">${fmt(runBal)}</td></tr>`);
      }
    }
    w.document.write(`<tr class="month-summary"><td colspan="2">${month.month} 월계</td><td>${fmt(month.totals.qty)}</td><td></td><td>${fmt(month.totals.supply)}</td><td>${fmt(month.totals.tax)}</td><td>${fmt(month.totals.total)}</td><td class="pay-val">${month.totals.payment ? fmt(month.totals.payment) : ''}</td><td class="bal-pos">${fmt(runBal)}</td></tr>`);
  }

  const finalBal = prevBalance + grandTotal.total - grandTotal.payment;
  w.document.write(`<tr class="grand-total"><td colspan="2">[${client.client_name} 합계]</td><td>${fmt(grandTotal.qty)}</td><td></td><td>${fmt(grandTotal.supply)}</td><td>${fmt(grandTotal.tax)}</td><td>${fmt(grandTotal.total)}</td><td>${fmt(grandTotal.payment)}</td><td>${fmt(finalBal)}</td></tr>`);
  w.document.write('</tbody></table></body></html>');
  w.document.close();
  setTimeout(() => { w.print(); }, 300);
}
