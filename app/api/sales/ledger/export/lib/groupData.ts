export interface GroupedDay {
  date: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shipRows: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payRows: any[];
  totals: { qty: number; supply: number; tax: number; total: number; payment: number };
}

export interface GroupedMonth {
  month: string;
  days: GroupedDay[];
  totals: { qty: number; supply: number; tax: number; total: number; payment: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function groupData(rows: any[], payments: any[]): GroupedMonth[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payByDay = new Map<string, any[]>();
  for (const p of payments) {
    const d = p.payment_date.slice(0, 10);
    if (!payByDay.has(d)) payByDay.set(d, []);
    payByDay.get(d)!.push(p);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monthMap = new Map<string, Map<string, { rows: any[]; pays: any[] }>>();
  for (const r of rows) {
    const m = r.ship_date.slice(0, 7);
    const d = r.ship_date.slice(0, 10);
    if (!monthMap.has(m)) monthMap.set(m, new Map());
    const dm = monthMap.get(m)!;
    if (!dm.has(d)) dm.set(d, { rows: [], pays: [] });
    dm.get(d)!.rows.push(r);
  }
  for (const [d, pays] of payByDay) {
    const m = d.slice(0, 7);
    if (!monthMap.has(m)) monthMap.set(m, new Map());
    const dm = monthMap.get(m)!;
    if (!dm.has(d)) dm.set(d, { rows: [], pays: [] });
    dm.get(d)!.pays = pays;
  }

  const result: GroupedMonth[] = [];
  for (const [m, dayMap] of monthMap) {
    const days: GroupedDay[] = [];
    const mt = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };
    const sorted = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [d, { rows: dr, pays }] of sorted) {
      const dt = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };
      for (const r of dr) {
        dt.qty += r.quantity || 0;
        dt.supply += r.supply_amount || 0;
        dt.tax += r.tax_amount || 0;
        dt.total += r.total_amount || 0;
      }
      for (const p of pays) { dt.payment += p.amount || 0; }
      mt.qty += dt.qty; mt.supply += dt.supply; mt.tax += dt.tax;
      mt.total += dt.total; mt.payment += dt.payment;
      days.push({ date: d, shipRows: dr, payRows: pays, totals: dt });
    }
    result.push({ month: m, days, totals: mt });
  }
  result.sort((a, b) => a.month.localeCompare(b.month));
  return result;
}
