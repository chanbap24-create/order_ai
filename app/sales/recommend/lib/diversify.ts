import type { ScoredItem } from '../types';

type Opts = { maxPerType?: number; maxPerRegion?: number; targetCount?: number };

/**
 * 타입/지역 편중 완화: 점수순 유지하며 '타입당 최대 N개'·'지역당 최대 N개'로 분산.
 * - 1차: 캡 존중(다양성 우선). 캡 걸린 항목은 건너뜀.
 * - 백필: targetCount(락) 지정 시, 목표 미달이면 '타입 캡'을 1씩 올려가며 채운다.
 *   → 타입이 적은 거래처(스시야=화이트·스파클링)도 6개 채움. 균형있게(캡 단계적 상향).
 *   비주력 타입은 호출측에서 이미 pool에서 제외되므로 백필에도 안 들어온다(스시야 레드 X).
 * wine_type 은 추천 결과에 정규화 라벨(스파클링/화이트/레드/로제/주정강화)로 담겨 있다.
 */
export function diversify(items: ScoredItem[], opts: Opts): ScoredItem[] {
  const maxType = opts.maxPerType && opts.maxPerType > 0 ? opts.maxPerType : 0;
  const maxRegion = opts.maxPerRegion && opts.maxPerRegion > 0 ? opts.maxPerRegion : 0;
  if (!maxType && !maxRegion) {
    return opts.targetCount ? items.slice(0, opts.targetCount) : items;
  }

  // 타입별 그룹(점수순 유지)
  const byType = new Map<string, ScoredItem[]>();
  for (const it of items) {
    const tk = it.wine_type || '(기타)';
    if (!byType.has(tk)) byType.set(tk, []);
    byType.get(tk)!.push(it);
  }
  // 타입 순서 = 각 타입 최고점 순
  const types = [...byType.keys()].sort((a, b) => (byType.get(b)![0]?.score || 0) - (byType.get(a)![0]?.score || 0));

  const target = opts.targetCount || items.length;
  const picked: ScoredItem[] = [];
  const typeCnt = new Map<string, number>();
  const regionCnt = new Map<string, number>();
  const idx = new Map<string, number>(); // 타입별 다음 후보 인덱스
  let cap = maxType || items.length; // 라운드당 타입 캡. 다양성 우선.

  // 라운드로빈: 타입을 한 바퀴씩 돌며 1개씩 → 소량 타입(포트)도 대표 1개 확보. 미달이면 캡 올려 백필.
  while (picked.length < target) {
    let added = 0;
    for (const tk of types) {
      if (picked.length >= target) break;
      if ((typeCnt.get(tk) || 0) >= cap) continue; // 현재 캡 도달 → 이번 바퀴 skip
      const arr = byType.get(tk)!;
      let i = idx.get(tk) || 0;
      while (i < arr.length) {
        const it = arr[i]; i++;
        const rk = it.region || '';
        if (maxRegion && rk && (regionCnt.get(rk) || 0) >= maxRegion) continue; // 지역 캡
        picked.push(it);
        typeCnt.set(tk, (typeCnt.get(tk) || 0) + 1);
        if (rk) regionCnt.set(rk, (regionCnt.get(rk) || 0) + 1);
        added++;
        break;
      }
      idx.set(tk, i);
    }
    if (added === 0) {
      if (maxType && cap < items.length) cap += maxType; // 백필: 캡 상향(타입 적은 거래처 3+3 등)
      else break; // 더 못 뽑음(재고 소진)
    }
  }
  return picked;
}
