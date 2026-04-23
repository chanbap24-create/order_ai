import type { DayData, LedgerRow, MonthData, PaymentRow, Totals } from '../types';
import { dayKey, monthKey } from './format';

export function groupData(rows: LedgerRow[], payments: PaymentRow[]): MonthData[] {
  const payByDay = new Map<string, PaymentRow[]>();
  for (const p of payments) {
    const d = dayKey(p.payment_date);
    if (!payByDay.has(d)) payByDay.set(d, []);
    payByDay.get(d)!.push(p);
  }

  const monthMap = new Map<string, Map<string, { rows: LedgerRow[]; pays: PaymentRow[] }>>();

  for (const r of rows) {
    const m = monthKey(r.ship_date);
    const d = dayKey(r.ship_date);
    if (!monthMap.has(m)) monthMap.set(m, new Map());
    const dayMap = monthMap.get(m)!;
    if (!dayMap.has(d)) dayMap.set(d, { rows: [], pays: [] });
    dayMap.get(d)!.rows.push(r);
  }

  for (const [d, pays] of payByDay) {
    const m = monthKey(d);
    if (!monthMap.has(m)) monthMap.set(m, new Map());
    const dayMap = monthMap.get(m)!;
    if (!dayMap.has(d)) dayMap.set(d, { rows: [], pays: [] });
    dayMap.get(d)!.pays = pays;
  }

  const result: MonthData[] = [];
  for (const [m, dayMap] of monthMap) {
    const days: DayData[] = [];
    const mTotals: Totals = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };

    const sortedDays = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [d, { rows: dRows, pays }] of sortedDays) {
      const dTotals: Totals = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };
      for (const r of dRows) {
        dTotals.qty += r.quantity || 0;
        dTotals.supply += r.supply_amount || 0;
        dTotals.tax += r.tax_amount || 0;
        dTotals.total += r.total_amount || 0;
      }
      for (const p of pays) {
        dTotals.payment += p.amount || 0;
      }
      mTotals.qty += dTotals.qty;
      mTotals.supply += dTotals.supply;
      mTotals.tax += dTotals.tax;
      mTotals.total += dTotals.total;
      mTotals.payment += dTotals.payment;
      days.push({ date: d, rows: dRows, paymentRows: pays, totals: dTotals });
    }
    result.push({ month: m, days, totals: mTotals });
  }

  result.sort((a, b) => a.month.localeCompare(b.month));
  return result;
}

export function computeGrandTotal(rows: LedgerRow[], payments: PaymentRow[]): Totals {
  return {
    qty: rows.reduce((s, r) => s + (r.quantity || 0), 0),
    supply: rows.reduce((s, r) => s + (r.supply_amount || 0), 0),
    tax: rows.reduce((s, r) => s + (r.tax_amount || 0), 0),
    total: rows.reduce((s, r) => s + (r.total_amount || 0), 0),
    payment: payments.reduce((s, p) => s + (p.amount || 0), 0),
  };
}
