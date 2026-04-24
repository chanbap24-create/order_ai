/**
 * 날짜 범위 프리셋 유틸.
 *
 * 사용처:
 *  - admin/client-analysis (매출분석 FilterBar)
 *  - admin/dashboard (재고분석 상단)
 *  - 기타 날짜 필터가 필요한 화면
 *
 * 모든 함수는 YYYY-MM-DD 문자열을 반환 (ship_date 컬럼 포맷과 동일).
 */

export type DateRange = { startDate: string; endDate: string };

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function today(): DateRange {
  const t = fmt(new Date());
  return { startDate: t, endDate: t };
}

/** 최근 N일 (오늘 포함) */
export function lastDays(n: number): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (n - 1));
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** 이번 달 1일 ~ 오늘 */
export function thisMonth(): DateRange {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** 지난 달 1일 ~ 말일 */
export function lastMonth(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // 0 = 전달 말일
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** 최근 N개월 (오늘부터 역산) */
export function lastMonths(n: number): DateRange {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - n, end.getDate() + 1);
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** 올해 1월 1일 ~ 오늘 (YTD) */
export function thisYear(): DateRange {
  const end = new Date();
  const start = new Date(end.getFullYear(), 0, 1);
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** 작년 전체 */
export function lastYear(): DateRange {
  const y = new Date().getFullYear() - 1;
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

export type PresetId = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | '3m' | '6m' | 'thisYear' | 'lastYear';

export const PRESETS: { id: PresetId; label: string; fn: () => DateRange }[] = [
  { id: 'today', label: '오늘', fn: today },
  { id: '7d', label: '7일', fn: () => lastDays(7) },
  { id: '30d', label: '30일', fn: () => lastDays(30) },
  { id: 'thisMonth', label: '이번 달', fn: thisMonth },
  { id: 'lastMonth', label: '지난 달', fn: lastMonth },
  { id: '3m', label: '3개월', fn: () => lastMonths(3) },
  { id: '6m', label: '6개월', fn: () => lastMonths(6) },
  { id: 'thisYear', label: '올해', fn: thisYear },
  { id: 'lastYear', label: '작년', fn: lastYear },
];

/** 현재 {startDate, endDate} 가 어느 preset 과 일치하는지 찾음 (UI 하이라이트용). */
export function matchPreset(range: DateRange): PresetId | null {
  for (const p of PRESETS) {
    const r = p.fn();
    if (r.startDate === range.startDate && r.endDate === range.endDate) return p.id;
  }
  return null;
}
