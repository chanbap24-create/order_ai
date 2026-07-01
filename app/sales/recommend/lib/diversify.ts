import type { ScoredItem } from '../types';

type Opts = { maxPerType?: number; maxPerRegion?: number; targetCount?: number };

/**
 * 타입/지역 편중 완화: 점수순은 유지하되 '타입당 최대 N개'·'지역당 최대 N개'로 제한.
 * - 캡에 걸린 항목은 건너뛰고 다음(다른 타입/지역)으로 → 자연스럽게 분산.
 * - targetCount(락) 지정 시 캡 때문에 개수가 모자라면 초과분에서 점수순으로 백필해 N을 채운다.
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
  const overflow: ScoredItem[] = [];

  for (const it of items) {
    const tk = it.wine_type || '(기타)';
    const rk = it.region || '';
    const tOk = !maxType || (typeCnt.get(tk) || 0) < maxType;
    const rOk = !maxRegion || !rk || (regionCnt.get(rk) || 0) < maxRegion;
    if (tOk && rOk) {
      picked.push(it);
      typeCnt.set(tk, (typeCnt.get(tk) || 0) + 1);
      if (rk) regionCnt.set(rk, (regionCnt.get(rk) || 0) + 1);
      if (opts.targetCount && picked.length >= opts.targetCount) break;
    } else if (opts.targetCount) {
      overflow.push(it); // 락 채우기용 예비
    }
  }

  // 락 개수 미달 시 초과분에서 점수순 백필
  if (opts.targetCount && picked.length < opts.targetCount) {
    for (const it of overflow) {
      picked.push(it);
      if (picked.length >= opts.targetCount) break;
    }
  }
  return picked;
}
