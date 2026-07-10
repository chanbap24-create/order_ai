// app/lib/pricing/clientGrade.ts
// 거래처 등급(0~4) — 추천점수 가중치 가변화(B)의 기준.
// 직전 완료 분기의 지표로 등급을 매기고, 등급이 높을수록(거래 많을수록)
// 추천점수의 거래처축(산지+취향+견적학습) 비중↑ / 베이스축(업장+업태+지역) 비중↓.
//
// 등급 판정: 각 카테고리(품목수·거래횟수·[샵 매출])별 등급 중 '가장 낮은 등급'을 적용
//   ("달성 카테고리의 하위등급을 적용한다" — 가격공식.xlsx B표)
//
// 등급별 점수 배분(총 96 고정, ×10):
//   등급 0: 거래처 45 / 베이스 51   (= 현재 기본값, 스케일 1.0)
//   등급 1: 50 / 46,  2: 60 / 36,  3: 70 / 26,  4: 80 / 16
import type { VenueCategory } from './discountRate';
import { prevQuarterRange, type DateRange } from './quarters';

export interface QuarterMetrics {
  salesSupply: number; // 직전 분기 Σ(공급가 × 수량)
  itemCount: number;   // 고유 품번 수(품목수)
  orderCount: number;  // 거래횟수(고유 출고일 수)
}

/** 직전 분기 창으로 필터해 품목수·거래횟수·공급가 매출 집계. */
export function computeQuarterMetrics(
  shipments: Array<{ item_no?: string; quantity?: number; ship_date?: string }>,
  priceOf: (itemNo: string) => number,
  range: DateRange = prevQuarterRange(),
): QuarterMetrics {
  let salesSupply = 0;
  const items = new Set<string>();
  const dates = new Set<string>();
  for (const s of shipments) {
    const d = (s.ship_date || '').slice(0, 10);
    if (!d || d < range.start || d >= range.end) continue;
    const no = s.item_no ? String(s.item_no) : '';
    if (no) {
      items.add(no);
      salesSupply += priceOf(no) * (Number(s.quantity) || 0);
    }
    dates.add(d);
  }
  return { salesSupply, itemCount: items.size, orderCount: dates.size };
}

// 등급별 축 배분(index = 등급 0..4).
export const GRADE_PERS = [45, 50, 60, 70, 80]; // 거래처축 목표점
export const GRADE_BASE = [51, 46, 36, 26, 16]; // 베이스축 목표점
export const PERS_BASE_TOTAL = 45; // 기본 거래처축 합(산지15+취향15+견적15)
export const BASE_BASE_TOTAL = 51; // 기본 베이스축 합(업장15+업태20+지역16)

/** value가 도달한 최고 등급(1~4), 미달이면 0. thr = [1등급, 2등급, 3등급, 4등급] 문턱. */
function gradeFrom(value: number, thr: [number, number, number, number]): number {
  let g = 0;
  for (let i = 0; i < 4; i++) if (value >= thr[i]) g = i + 1;
  return g;
}

/**
 * 거래처 등급(0~4). 카테고리별 등급 중 최솟값(하위등급) 적용.
 *   · 업소/호텔: 품목수[3/5/7/10], 거래횟수[3/6/9/12]
 *   · 샵: 품목수[2/4/6/8], 거래횟수[2/3/4/6], 매출[200/400/700/700만]
 *   · 도매: 등급표 없음 → 0(기본 = 베이스 우세)
 */
export function computeGrade(category: VenueCategory, m: QuarterMetrics): number {
  if (category === 'wholesale') return 0;
  if (category === 'shop') {
    return Math.min(
      gradeFrom(m.itemCount, [2, 4, 6, 8]),
      gradeFrom(m.orderCount, [2, 3, 4, 6]),
      gradeFrom(m.salesSupply, [2_000_000, 4_000_000, 7_000_000, 7_000_000]),
    );
  }
  // venue (업소/호텔)
  return Math.min(
    gradeFrom(m.itemCount, [3, 5, 7, 10]),
    gradeFrom(m.orderCount, [3, 6, 9, 12]),
  );
}
