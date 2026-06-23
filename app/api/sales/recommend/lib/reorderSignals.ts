// 재주문 신호: "끊긴 단골 와인"을 고정점수로 박지 않고, 구매 패턴으로 세분화/필터링한다.
// - overdueRatio: 그 거래처의 '실제 발주 주기' 대비 얼마나 지났나(1 미만이면 아직 살 때 아님 → 제외)
// - substituted : 끊긴 뒤 같은 타입·지역의 다른 와인으로 갈아탔나(그렇다면 다시 권할 의미 없음 → 제외)
// - strengthW   : 구매 강도(매입액) 정규화(많이 산 와인일수록 가점↑)
// 재고 '품절 여부'는 아직 이력이 없어 못 봄(inventory_snapshot 누적 후 추가 예정).
import { geoGroup } from './geoTier';
import { normalizeType } from './wineType';
import type { PurchaseAggEntry } from './types';

export interface ReorderInfo {
  overdueRatio: number;   // gap / 정상주기 (>1 = 발주 지연)
  substituted: boolean;   // 비슷한 와인으로 대체했나
  strengthW: number;      // 구매 강도(0~1)
  typicalInterval: number;// 정상 발주 주기(일)
}

interface ShipRow { item_no?: string; ship_date?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Wine = Record<string, any>;

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function buildReorderSignals(
  shipments: ShipRow[],
  purchaseAgg: Record<string, PurchaseAggEntry>,
  wineMap: Map<string, Wine>,
  todayStr: string,
): Map<string, ReorderInfo> {
  // 품목별 구매일 목록
  const datesByItem = new Map<string, string[]>();
  for (const s of shipments) {
    if (!s.item_no || !s.ship_date) continue;
    const arr = datesByItem.get(s.item_no) || [];
    arr.push(String(s.ship_date).slice(0, 10));
    datesByItem.set(s.item_no, arr);
  }

  const featOf = (code: string): { type: string; region: string } | null => {
    const w = wineMap.get(code);
    if (!w) return null;
    return { type: normalizeType(w.wine_type || '', w.item_name_kr || ''), region: geoGroup(w._hierarchy || null) };
  };

  // 구매강도 정규화용 최대 매입액(반복구매 품목 기준)
  let maxSpend = 0;
  for (const agg of Object.values(purchaseAgg)) {
    if (agg.count >= 2) maxSpend = Math.max(maxSpend, agg.spend || 0);
  }

  const out = new Map<string, ReorderInfo>();
  for (const [code, agg] of Object.entries(purchaseAgg)) {
    if (agg.count < 2 || !agg.lastDate) continue;

    const dates = (datesByItem.get(code) || []).slice().sort();
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const d = daysBetween(dates[i - 1], dates[i]);
      if (d > 0) intervals.push(d);
    }
    const typical = Math.max(14, median(intervals) || 90); // 최소 2주, 정보 없으면 90일
    const gap = Math.max(0, daysBetween(agg.lastDate, todayStr));
    const overdueRatio = typical > 0 ? gap / typical : 0;

    // 대체 판별: 마지막 구매 후 같은 (타입·지역)의 다른 와인을 샀나
    const featX = featOf(code);
    let substituted = false;
    if (featX && (featX.type || featX.region)) {
      for (const s of shipments) {
        if (!s.item_no || s.item_no === code || !s.ship_date) continue;
        if (String(s.ship_date).slice(0, 10) <= agg.lastDate) continue;
        const f = featOf(s.item_no);
        if (f && f.type === featX.type && f.region === featX.region) { substituted = true; break; }
      }
    }

    const strengthW = maxSpend > 0 ? Math.min(1, (agg.spend || 0) / maxSpend) : 0;
    out.set(code, { overdueRatio, substituted, strengthW, typicalInterval: typical });
  }
  return out;
}
