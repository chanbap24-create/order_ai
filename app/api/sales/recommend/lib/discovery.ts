// 발굴/신규 추천: 거래처 구매이력·취향·견적학습을 안 씀. 신규 거래처/이력무관 발굴용.
// '인기'를 수량 1등 대비 비율(편향) 대신, 글로벌 신호의 '백분위 순위'로 평가:
//   ① 구매 거래처 수(breadth, 핵심)  ② 매출(싼 대량 보정)  ③ 최근 구매처(트렌드)  ④ 업태 인기(있을 때)
// 백분위라 분포가 0~100으로 고르게 펴짐(괴물 베스트셀러가 나머지를 깔아뭉개지 않음).
import { supabase } from '@/app/lib/db';
import type { ScoredItem } from '@/app/sales/recommend/types';
import { normalizeType, bucketLabel } from './wineType';

const TYPE_CAP = 10; // 다양성: 한 타입이 상위를 독식하지 않게(여러 타입 선택 시)

export interface DiscoveryOpts {
  types?: string[];
  minPrice?: number;
  maxPrice?: number;
  segment?: string;
}
export interface ItemPop { buyers: number; revenue: number; recentBuyers: number; }

/** 품목별 글로벌 인기 원천(최근 12개월 구매처 수·매출·최근 3개월 구매처). RPC 집계. */
export async function getItemPopularity(): Promise<Map<string, ItemPop>> {
  const since = new Date(); since.setMonth(since.getMonth() - 12);
  const recent = new Date(); recent.setMonth(recent.getMonth() - 3);
  const out = new Map<string, ItemPop>();
  const { data } = await supabase.rpc('item_popularity', {
    since: since.toISOString().slice(0, 10),
    recent_since: recent.toISOString().slice(0, 10),
  });
  for (const r of (data || []) as Array<{ item_no: string; buyers: number; revenue: number; recent_buyers: number }>) {
    out.set(String(r.item_no), { buyers: Number(r.buyers) || 0, revenue: Number(r.revenue) || 0, recentBuyers: Number(r.recent_buyers) || 0 });
  }
  return out;
}

/** 업태별 품목 인기도(최근 12개월 출고 수량 정규화 0~1). 발굴 모드의 4번째 축(있을 때만). */
export async function getSegmentPopularity(segment: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!segment) return out;
  const since = new Date(); since.setMonth(since.getMonth() - 12);
  const { data } = await supabase.rpc('segment_item_popularity', { seg: segment, since: since.toISOString().slice(0, 10) });
  let max = 0;
  for (const r of (data || []) as Array<{ item_no: string; qty: number }>) max = Math.max(max, Number(r.qty) || 0);
  if (max > 0) for (const r of (data || []) as Array<{ item_no: string; qty: number }>) out.set(String(r.item_no), (Number(r.qty) || 0) / max);
  return out;
}

/** 값 배열 → 각 원소의 백분위 순위(0~1). 동점은 평균 순위. */
function percentileRanks(values: number[]): number[] {
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

export function scoreDiscovery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventory: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  opts: DiscoveryOpts,
  popMap: Map<string, ItemPop>,
  segmentPop: Map<string, number>,
): ScoredItem[] {
  const types = opts.types && opts.types.length ? new Set(opts.types) : null;
  const singleType = !!types && types.size <= 1;
  const hasSeg = segmentPop.size > 0;

  // 1) 후보 필터(타입·가격)
  const cand = (inventory || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((inv: any) => {
      const wine = wineMap.get(inv.item_no);
      const name = wine?.item_name_kr || inv.item_name || '';
      const bucket = normalizeType(wine?.wine_type || '', name);
      const price = inv.supply_price || 0;
      return { inv, wine, itemNo: inv.item_no, bucket, price, pop: popMap.get(String(inv.item_no)) || { buyers: 0, revenue: 0, recentBuyers: 0 }, seg: segmentPop.get(String(inv.item_no)) || 0 };
    })
    .filter((c) => {
      if (types && (!c.bucket || !types.has(c.bucket))) return false;
      if (opts.minPrice && c.price < opts.minPrice) return false;
      if (opts.maxPrice && c.price > opts.maxPrice) return false;
      return true;
    });

  // 2) 축별 백분위(후보 집합 내)
  const pctB = percentileRanks(cand.map((c) => c.pop.buyers));
  const pctR = percentileRanks(cand.map((c) => c.pop.revenue));
  const pctT = percentileRanks(cand.map((c) => c.pop.recentBuyers));
  const pctS = hasSeg ? percentileRanks(cand.map((c) => c.seg)) : null;

  // 3) 가중 합 → 0~100 (업태 없으면 3축으로 재분배 — 업태 빈 거래처도 100까지 평가)
  const W = hasSeg ? { b: 0.30, r: 0.22, t: 0.18, s: 0.30 } : { b: 0.45, r: 0.30, t: 0.25, s: 0 };

  const scored: ScoredItem[] = cand.map((c, i) => {
    const composite = W.b * pctB[i] + W.r * pctR[i] + W.t * pctT[i] + (pctS ? W.s * pctS[i] : 0);
    const score = Math.round(composite * 1000) / 10;
    const tags: string[] = [];
    const reasons: string[] = [`${c.pop.buyers}곳 구매`];
    if (score >= 70) tags.push('베스트셀러');
    if (pctS && pctS[i] >= 0.7) { tags.push('업태인기'); reasons.push(`${opts.segment} 인기`); }
    const breakdown = [
      `구매처 ${Math.round(pctB[i] * 100)}%·매출 ${Math.round(pctR[i] * 100)}%·최근 ${Math.round(pctT[i] * 100)}%${pctS ? `·업태 ${Math.round(pctS[i] * 100)}%` : ''}`,
      `= ${score.toFixed(1)}`,
    ];
    return {
      item_no: c.itemNo,
      item_name: c.inv.item_name,
      country: c.wine?.country || c.wine?.country_en || c.inv.country || '',
      region: c.wine?.region || '',
      grape: c.wine?.grape_varieties || '',
      wine_type: bucketLabel(c.bucket) || c.wine?.wine_type || '',
      price: c.price,
      stock: c.inv._totalStock ?? ((c.inv.available_stock || 0) + (c.inv.bonded_warehouse || 0) + (c.inv.bonded_kctc || 0)),
      score,
      tags,
      reason: reasons.join(' · ') || '추천 와인',
      image_url: (c.wine?.image_url as string) || '',
      brand: (c.wine?.supplier as string) || (c.wine?.brand as string) || '',
      vintage: vintageOf(c.itemNo),
      breakdown,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  if (singleType) return scored;

  // 다양성: 타입별 상한(여러 타입/전체일 때)
  const perType = new Map<string, number>();
  const out: ScoredItem[] = [];
  for (const it of scored) {
    const n = perType.get(it.wine_type) || 0;
    if (n >= TYPE_CAP) continue;
    perType.set(it.wine_type, n + 1);
    out.push(it);
  }
  return out;
}
