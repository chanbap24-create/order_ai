// 수금일정표 계산: 결제조건 + 오늘 기준으로 입금예정금액/미수잔액/입금예정일 산출.
// 규칙: 월말=미수전액 / 익월=이월분(예정금액)·당월신규(미수잔액) / 선결제·미지정=공란
//       분할상환(manual)=금액은 사장님 직접입력(공란), 예정일만 계산.
// 입금예정일은 엑셀 원본과 동일하게 '오늘 기준 이번달/익월 중 안 지난 occurrence'(평일보정).

export type PaymentType = 'prepay' | 'eom' | 'nm5' | 'nm10' | 'nm15' | 'nm20' | 'nme';

export interface ScheduleClient {
  client_code: string;
  client_name: string;
  business_type: string | null;
  net_now: number;
  net_close: number;
  payment_type: PaymentType | null;
  manual_amount: boolean;
}

export interface ScheduleCols {
  expected: number | null;   // 입금예정금액 (null=공란)
  remain: number | null;     // 미수잔액
  dueDate: Date | null;      // 입금예정일
}

const NM_DAY: Partial<Record<PaymentType, number>> = { nm5: 5, nm10: 10, nm15: 15, nm20: 20 };

function lastWorkday(y: number, m0: number): Date {
  const d = new Date(Date.UTC(y, m0 + 1, 0)); // 그 달 마지막 날
  const w = d.getUTCDay();
  if (w === 6) d.setUTCDate(d.getUTCDate() - 1);
  else if (w === 0) d.setUTCDate(d.getUTCDate() - 2);
  return d;
}
function workdayOnOrAfter(y: number, m0: number, day: number): Date {
  const d = new Date(Date.UTC(y, m0, day));
  const w = d.getUTCDay();
  if (w === 6) d.setUTCDate(d.getUTCDate() + 2);
  else if (w === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function scheduleDue(pt: PaymentType, today: Date, hasEff: boolean): Date | null {
  const y = today.getUTCFullYear(), m0 = today.getUTCMonth();
  const ny = m0 === 11 ? y + 1 : y, nm0 = m0 === 11 ? 0 : m0 + 1;
  if (pt === 'eom') return lastWorkday(y, m0);
  if (pt === 'nme') {
    const thisEnd = lastWorkday(y, m0);
    return (hasEff && thisEnd >= today) ? thisEnd : lastWorkday(ny, nm0);
  }
  const n = NM_DAY[pt];
  if (!n) return null;
  const thisN = workdayOnOrAfter(y, m0, n);
  return (hasEff && thisN >= today) ? thisN : workdayOnOrAfter(ny, nm0, n);
}

// todayISO: 'YYYY-MM-DD'
export function computeCols(c: ScheduleClient, todayISO: string): ScheduleCols {
  const today = new Date(`${todayISO}T00:00:00Z`);
  const pt = c.payment_type;
  const eff = c.net_close > 0;

  // 분할상환: 금액·미수잔액·입금예정일 모두 직접입력(공란)
  if (c.manual_amount) return { expected: null, remain: null, dueDate: null };

  if (!pt || pt === 'prepay') return { expected: null, remain: null, dueDate: null };

  const due = scheduleDue(pt, today, eff);

  if (pt === 'eom') return { expected: c.net_now, remain: c.net_now - c.net_now, dueDate: due };
  // 익월 계열: 예정금액=이월분(net_close), 미수잔액=당월 신규(net_now-net_close)
  return { expected: c.net_close, remain: c.net_now - c.net_close, dueDate: due };
}
