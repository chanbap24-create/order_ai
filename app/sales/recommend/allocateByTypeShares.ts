import type { ScoredItem } from './types';
import { compareForDisplay } from './displayOrder';

/**
 * 타입 분포(shares)에 비례해 N칸을 타입별로 배분(최대 잔여법), 타입 안에선 점수순 top.
 *  cap>0=타입당 상한. <5% 타입·재고없는 타입은 0칸(비주력 자연 제외). 재고부족 미달이면 나머지 점수순 채움.
 *  입력 byScore는 반드시 '점수 내림차순'이어야 한다(표시순 아님).
 *  단일 추천 탭·거래처 일괄 추천이 공용으로 사용 — 선정 로직 불일치 방지.
 */
export function allocateByTypeShares(byScore: ScoredItem[], shares: Record<string, number>, N: number, cap: number): ScoredItem[] {
  const poolByType = new Map<string, ScoredItem[]>();
  for (const it of byScore) {
    const t = it.wine_type || '(기타)';
    if (!poolByType.has(t)) poolByType.set(t, []);
    poolByType.get(t)!.push(it);
  }
  const distTypes = [...poolByType.keys()].filter((t) => (shares[t] || 0) >= 0.05);
  if (distTypes.length === 0) return byScore.slice(0, N); // 분포 데이터 없으면 점수순
  const ceil = cap > 0 ? cap : N;
  const tot = distTypes.reduce((s, t) => s + (shares[t] || 0), 0) || 1;
  const alloc = distTypes.map((t) => {
    const exact = (N * (shares[t] || 0)) / tot;
    const lim = Math.min(ceil, poolByType.get(t)!.length);
    return { t, n: Math.min(Math.floor(exact), lim), rem: exact - Math.floor(exact), lim };
  });
  let used = alloc.reduce((s, x) => s + x.n, 0);
  let guard = 0;
  while (used < N && guard++ < 200) {
    const grow = alloc.filter((x) => x.n < x.lim).sort((p, q) => q.rem - p.rem)[0];
    if (!grow) break;
    grow.n++; used++; grow.rem -= 1;
  }
  const out: ScoredItem[] = [];
  for (const x of alloc) out.push(...poolByType.get(x.t)!.slice(0, x.n));
  if (out.length < N) { // 재고/캡으로 미달 → 나머지 점수순(비주력 제외)
    const usedSet = new Set(out);
    for (const it of byScore) {
      if (out.length >= N) break;
      if (usedSet.has(it) || it.tags?.includes('비주력타입')) continue;
      out.push(it);
    }
  }
  return out;
}

/**
 * 추천 응답 → 최종 견적 품목 선정·정렬(단독 추천 탭·거래처 일괄 추천 공용).
 * API가 표시순(orderForDisplay)으로 주므로 반드시 점수순으로 재정렬 후 배분해야 한다.
 *   1) minScore 필터 → 2) 점수 내림차순 → 3) 타입 분포 비례배분(N칸·타입당 상한)
 *   → 4) 표시 정렬(compareForDisplay: 타입→국가→가격).
 * 단독·배치가 이 함수 하나만 쓰게 해서 선정/정렬 불일치를 원천 차단한다.
 */
export function selectQuoteItems(
  recs: ScoredItem[],
  typeShares: Record<string, number>,
  opts: { lockCount: number; maxPerType: number; minScore: number },
): ScoredItem[] {
  const N = opts.lockCount > 0 ? opts.lockCount : 6;
  const byScore = recs
    .filter((i) => !opts.minScore || i.score >= opts.minScore)
    .sort((a, b) => b.score - a.score);
  return allocateByTypeShares(byScore, typeShares, N, opts.maxPerType).sort(compareForDisplay);
}
