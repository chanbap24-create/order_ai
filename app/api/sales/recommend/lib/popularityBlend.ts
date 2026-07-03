// 인기(구매폭) prior 블렌드: 개인화 점수와 전사 구매폭 백분위를 섞어 전체 재고 유니버스를 재랭킹.
// 백테스트(scripts/recommend-backtest.ts)로 검증된 설계 — 개인화(상위)와 인기 도달범위(하위)를 함께 확보.
//   최종 = (1-α)·개인화점수정규화 + α·구매폭백분위 ,  α = popularityWeight(0~1, 0이면 미적용)
// 게이트 밖(개인화 점수 없는) 인기 품목은 개인화 0으로 두고 breadth로 끌어올려 노출.
import type { ScoredItem } from './types';
import { normalizeType, bucketLabel } from './wineType';
import { getItemPopularity } from './discovery';

/** 값 배열 → 각 원소의 백분위(0~1). 동점은 평균 순위. (discovery.percentileRanks와 동일 규약) */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  const idx = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const pct = new Array<number>(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const p = ((i + j) / 2) / (n - 1);
    for (let k = i; k <= j; k++) pct[idx[k][1]] = p;
    i = j + 1;
  }
  return pct;
}

function vintageOf(itemNo: string): string {
  const vv = String(itemNo).slice(2, 4);
  if (/^\d{2}$/.test(vv)) return Number(vv) >= 50 ? `19${vv}` : `20${vv}`;
  return ['NV', 'MV'].includes(vv.toUpperCase()) ? vv.toUpperCase() : '';
}

/** 게이트 밖 유니버스 품목의 표시용 최소 ScoredItem stub(개인화 점수 없음, 인기로만 노출). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stubItem(inv: any, wine: any): ScoredItem {
  const stock = inv._totalStock ?? ((inv.available_stock || 0) + (inv.bonded_warehouse || 0) + (inv.bonded_kctc || 0));
  const bucket = normalizeType(wine?.wine_type || '', wine?.item_name_kr || inv.item_name || '');
  return {
    item_no: inv.item_no, item_name: inv.item_name,
    country: wine?.country || wine?.country_en || inv.country || '', region: wine?.region || '',
    grape: wine?.grape_varieties || '', wine_type: bucketLabel(bucket) || wine?.wine_type || '',
    price: inv.supply_price || 0, stock, score: 0, tags: [], reason: '인기 추천',
    image_url: (wine?.image_url as string) || '', brand: (wine?.supplier as string) || (wine?.brand as string) || '',
    vintage: vintageOf(inv.item_no), breakdown: [],
  };
}

/**
 * 순수 재랭커: 개인화 결과(scored)와 구매폭 백분위(breadthPct)를 α로 블렌드해 전체 유니버스를 재정렬.
 * breadthPct는 호출측이 주입(프로덕션=getItemPopularity, 백테스트=leakage-free 컷오프이전 구매폭).
 */
export function blendPopularity(
  scored: ScoredItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventory: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  breadthPct: Map<string, number>,
  alpha: number,
): ScoredItem[] {
  const a = Math.min(1, Math.max(0, alpha));
  // 개인화 점수 min-max 정규화(후보 집합 내)
  let lo = Infinity, hi = -Infinity;
  for (const s of scored) { if (s.score < lo) lo = s.score; if (s.score > hi) hi = s.score; }
  const span = hi - lo;
  const persNorm = new Map<string, number>();
  const scoredMap = new Map<string, ScoredItem>();
  for (const s of scored) { persNorm.set(s.item_no, span > 0 ? (s.score - lo) / span : 1); scoredMap.set(s.item_no, s); }

  const out: ScoredItem[] = [];
  for (const inv of inventory) {
    const code = inv.item_no;
    const pn = persNorm.get(code) ?? 0;
    const bp = breadthPct.get(code) ?? 0;
    if (pn === 0 && bp === 0) continue; // 개인화도 인기도 없는 품목은 노출 안 함
    const final = (1 - a) * pn + a * bp;
    const base = scoredMap.get(code) || stubItem(inv, wineMap.get(code));
    const item: ScoredItem = { ...base, score: Math.round(final * 1000) / 10 };
    if (bp >= 0.7 && !item.tags.includes('인기')) item.tags = [...item.tags, '인기'];
    item.breakdown = [...(base.breakdown || []), `블렌드 개인화 ${pn.toFixed(2)}×${(1 - a).toFixed(1)} + 인기 ${bp.toFixed(2)}×${a.toFixed(1)} = ${(final * 100).toFixed(1)}`];
    out.push(item);
  }
  out.sort((x, y) => y.score - x.score);
  return out;
}

/** 프로덕션 래퍼: getItemPopularity(구매처 수)로 breadth 백분위를 만들어 blendPopularity 적용. */
export async function applyPopularityBlend(
  scored: ScoredItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventory: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  alpha: number,
): Promise<ScoredItem[]> {
  if (!(alpha > 0)) return scored;
  const popMap = await getItemPopularity();
  const codes = inventory.map((i) => i.item_no as string);
  const pct = percentileRanks(codes.map((c) => popMap.get(String(c))?.buyers || 0));
  const breadthPct = new Map<string, number>();
  codes.forEach((c, i) => breadthPct.set(c, pct[i]));
  return blendPopularity(scored, inventory, wineMap, breadthPct, alpha);
}
