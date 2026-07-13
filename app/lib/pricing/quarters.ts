// app/lib/pricing/quarters.ts
// 캘린더 분기/반기 경계 유틸. 추천 할인율(A)·거래처 등급(B) 공통.
//   · 분기 = 1~3 / 4~6 / 7~9 / 10~12월
//   · 반기 = H1(1~6월) / H2(7~12월)
// 등급·매출은 '직전 완료 분기', 리델은 '직전 완료 반기' 기준.

function ymd(y: number, month0: number, day: number): string {
  return `${y}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export interface DateRange { start: string; end: string } // [start, end)

/** 직전 완료 분기 [start, end) — end는 현재 분기 시작일(경계 제외). */
export function prevQuarterRange(now = new Date()): DateRange {
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3); // 0..3 (현재 분기)
  const end = ymd(y, q * 3, 1);             // 현재 분기 시작 = 직전 분기 종료(제외)
  const py = q === 0 ? y - 1 : y;
  const pStartMonth = q === 0 ? 9 : (q - 1) * 3;
  return { start: ymd(py, pStartMonth, 1), end };
}

/** 진행 중인 현재 분기 [start, end) — end는 다음 분기 시작일(경계 제외). 등급 도전 트랙용. */
export function currentQuarterRange(now = new Date()): DateRange {
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3); // 0..3
  const start = ymd(y, q * 3, 1);
  const end = q === 3 ? ymd(y + 1, 0, 1) : ymd(y, (q + 1) * 3, 1);
  return { start, end };
}

/** 직전 완료 반기 [start, end) — end는 현재 반기 시작일(경계 제외). */
export function prevHalfRange(now = new Date()): DateRange {
  const y = now.getFullYear();
  const h = now.getMonth() < 6 ? 0 : 1; // 0=H1(1~6월), 1=H2(7~12월)
  const end = ymd(y, h * 6, 1);          // 현재 반기 시작 = 직전 반기 종료(제외)
  const py = h === 0 ? y - 1 : y;
  const pStartMonth = h === 0 ? 6 : 0;
  return { start: ymd(py, pStartMonth, 1), end };
}

/** 직전 완료 1년 [start, end) — 현재 반기 시작 기준 12개월 전 ~ 현재 반기 시작(경계 제외). */
export function prevYearRange(now = new Date()): DateRange {
  const { end } = prevHalfRange(now);           // end = 현재 반기 시작(YYYY-MM-01)
  const [ey, em] = end.split('-').map(Number);  // 월 시작이므로 일자는 그대로 01
  return { start: `${ey - 1}-${String(em).padStart(2, '0')}-01`, end };
}
