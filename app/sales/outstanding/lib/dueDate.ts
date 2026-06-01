// 거래처 결제 조건 → 실제 수금 예정일 계산.
// 규칙:
//  - prepay(선결제): 예정일 없음
//  - eom(말일): 입고월의 마지막 평일. 말일이 주말이면 직전 평일로 당긴다.
//  - nm5/10/15/20(익월N): 익월 N일. 주말이면 직후 평일(월요일)로 미룬다.
// (공휴일 미반영 — 주말만 보정)

export type PaymentType = 'prepay' | 'eom' | 'nm5' | 'nm10' | 'nm15' | 'nm20' | 'nme';

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  prepay: '선결제', eom: '말일', nm5: '익월5', nm10: '익월10', nm15: '익월15', nm20: '익월20', nme: '익월말',
};

export const PAYMENT_TYPES: PaymentType[] = ['prepay', 'eom', 'nm5', 'nm10', 'nm15', 'nm20', 'nme'];

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const NM_DAY: Partial<Record<PaymentType, number>> = { nm5: 5, nm10: 10, nm15: 15, nm20: 20 };

/**
 * @param type        결제 조건
 * @param deliveryISO 입고/출고일 (YYYY-MM-DD) — 결제 기준이 되는 거래 발생일
 * @returns 수금 예정일(YYYY-MM-DD) 또는 null(선결제/미지정/기준일 없음)
 */
export function computeDueDate(type: PaymentType | null | undefined, deliveryISO: string | null): string | null {
  if (!type || type === 'prepay' || !deliveryISO) return null;
  const [y, m] = deliveryISO.split('-').map(Number); // m: 1-12 (입고월)
  if (!y || !m) return null;

  if (type === 'eom' || type === 'nme') {
    // 말일=입고월 말일 / 익월말=입고 다음달 말일. (y, m+off, 0) = 해당 월의 마지막 날
    const off = type === 'nme' ? 1 : 0;
    const d = new Date(Date.UTC(y, m + off, 0));
    const wd = d.getUTCDay();
    if (wd === 6) d.setUTCDate(d.getUTCDate() - 1);       // 토 → 금
    else if (wd === 0) d.setUTCDate(d.getUTCDate() - 2);  // 일 → 금
    return ymd(d);
  }

  const day = NM_DAY[type];
  if (!day) return null;
  // 익월 N일: (y, m, day) 에서 m 은 0-base 기준 "다음 달" (입고월이 1-base m 이므로)
  const d = new Date(Date.UTC(y, m, day));
  const wd = d.getUTCDay();
  if (wd === 6) d.setUTCDate(d.getUTCDate() + 2);        // 토 → 월
  else if (wd === 0) d.setUTCDate(d.getUTCDate() + 1);   // 일 → 월
  return ymd(d);
}
