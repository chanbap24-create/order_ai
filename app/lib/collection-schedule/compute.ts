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
  // 기간(마감 이후 ~ 생성일) 출고/수금 — 누계 행 공급/세액/판매/수금 컬럼용
  period_supply: number;
  period_tax: number;
  period_total: number;
  period_payment: number;
  payment_type: PaymentType | null;
  manual_amount: boolean;
  // 브리핑 탭에서 직접 정한 예정일/금액 (있으면 자동계산보다 우선)
  promised_date: string | null;
  promised_amount: number | null;
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
  // 지난 약속(약속일이 오늘 이전)은 이전 수금 사이클의 잔재 — 이번 사이클을 덮어쓰지 않게 무시하고
  // 결제조건으로 자동 재계산한다. (예: 6월 약속 6/30이 이행됐는데 followup이 open으로 남아 7월 일정을 6/30으로 표기)
  const rawPromisedDate = c.promised_date ? new Date(`${c.promised_date}T00:00:00Z`) : null;
  const promiseActive = rawPromisedDate != null && rawPromisedDate >= today;
  const manualDate = promiseActive ? rawPromisedDate : null;
  const promisedAmount = promiseActive ? c.promised_amount : null;

  // 브리핑 탭에서 직접 정한 예정금액이 있으면 자동계산보다 우선 (분할상환 직접입력 포함).
  // 단 입금예정금액은 총미수를 넘을 수 없음(기납입/반품으로 잔액이 줄어든 경우 캡).
  if (promisedAmount != null) {
    const expected = Math.min(promisedAmount, c.net_now);
    return { expected, remain: c.net_now - expected, dueDate: manualDate };
  }

  // 분할상환·선결제·미지정·미수없음: 금액 공란 (예정일은 직접 정한 값이 있으면 표기)
  if (c.manual_amount) return { expected: null, remain: null, dueDate: manualDate };
  if (!pt || pt === 'prepay') return { expected: null, remain: null, dueDate: manualDate };
  if (c.net_now <= 0) return { expected: null, remain: null, dueDate: manualDate };

  // 남은 이월분 = 마감시점 이월잔액 − 이 기간 수금
  const eff = Math.max(c.net_close - c.period_payment, 0);
  const due = manualDate ?? scheduleDue(pt, today, eff > 0);

  if (pt === 'eom') {
    // 월말: 미수 전액을 이달 말일에.
    const expected = c.net_now;
    return { expected, remain: c.net_now - expected, dueDate: due };
  }

  // 익월(nm5/10/15/20, nme): 이번달 수금일이 아직 안 지났고 이월분이 있으면 → 이월분만 이번 수금일에
  //   (당월 신규는 미수잔액). 수금일이 이미 지나 다음달로 넘어갔으면 → 이달 신규 포함 '전액'을 다음 수금일에.
  //   (버그: 이월분이 900만 남고 수금일은 다음달인데 예정금액을 900으로 고정하고 신규매출을 미수잔액으로 빼던 문제)
  const y = today.getUTCFullYear(), m0 = today.getUTCMonth();
  const thisOcc = pt === 'nme'
    ? lastWorkday(y, m0)
    : (NM_DAY[pt] ? workdayOnOrAfter(y, m0, NM_DAY[pt]!) : null);
  const thisCycle = eff > 0 && thisOcc != null && thisOcc >= today;
  const raw = thisCycle ? eff : c.net_now;
  const expected = Math.min(raw, c.net_now);
  return { expected, remain: c.net_now - expected, dueDate: due };
}
