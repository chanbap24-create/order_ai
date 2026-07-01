import type { ScoredItem } from '../types';

type Opts = { maxPerType?: number; maxPerRegion?: number; targetCount?: number };

/**
 * 타입/지역 편중 완화: 점수순은 유지하되 '타입당 최대 N개'·'지역당 최대 N개'로 제한(하드 캡).
 * - 캡에 걸린 항목은 건너뛰고 다음(다른 타입/지역)으로 → 자연스럽게 분산.
 * - 캡은 절대 넘지 않는다. 다양한 타입이 부족하면 락(targetCount)보다 개수가 적어질 수 있다.
 *   (락으로 채우려고 캡을 넘겨 백필하면 "캡 씌웠는데 같은 타입 3개" 문제가 생기므로 백필 안 함)
 * wine_type 은 추천 결과에 이미 정규화 라벨(스파클링/화이트/레드/로제/주정강화)로 담겨 있다.
 */
export function diversify(items: ScoredItem[], opts: Opts): ScoredItem[] {
  const maxType = opts.maxPerType && opts.maxPerType > 0 ? opts.maxPerType : 0;
  const maxRegion = opts.maxPerRegion && opts.maxPerRegion > 0 ? opts.maxPerRegion : 0;
  if (!maxType && !maxRegion) {
    return opts.targetCount ? items.slice(0, opts.targetCount) : items;
  }

  const typeCnt = new Map<string, number>();
  const regionCnt = new Map<string, number>();
  const picked: ScoredItem[] = [];

  for (const it of items) {
    const tk = it.wine_type || '(기타)';
    const rk = it.region || '';
    if (maxType && (typeCnt.get(tk) || 0) >= maxType) continue;      // 타입 캡 초과 → 제외(하드)
    if (maxRegion && rk && (regionCnt.get(rk) || 0) >= maxRegion) continue; // 지역 캡 초과 → 제외(하드)
    picked.push(it);
    typeCnt.set(tk, (typeCnt.get(tk) || 0) + 1);
    if (rk) regionCnt.set(rk, (regionCnt.get(rk) || 0) + 1);
    if (opts.targetCount && picked.length >= opts.targetCount) break;
  }
  return picked;
}
