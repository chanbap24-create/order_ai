// 개인화(raw) + 발굴 병합: 개인화 통과 와인은 원점수(raw) 그대로 노출(정규화 없음 → 뻥튀기 방지),
// 게이트 밖 와인만 '발굴점수 × α'로 낮게 얹어 노출. α는 이력 많을수록 작아짐(발굴 비중↓).
// 개인화 raw(≈0~100 절대값)와 발굴(α×0~1×100)이 같은 스케일 → 단골은 개인화가 상위 지배.
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
    const p = i / (n - 1); // 자기보다 작은 값의 비율(동점=최소순위). 구매폭 0=0점(백테스트 breadth와 동일 규약)
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
    price: inv.supply_price || 0, stock, score: 0, tags: [], reason: '동종업장·일반 데이터',
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
  exclude?: Set<string>, // 이미 산 와인(신규제안에서 제외) — 블렌드가 유니버스로 되살리지 않게
): ScoredItem[] {
  const a = Math.min(1, Math.max(0, alpha));
  const scoredMap = new Map<string, ScoredItem>();
  for (const s of scored) scoredMap.set(s.item_no, s);

  const out: ScoredItem[] = [];
  for (const inv of inventory) {
    const code = inv.item_no;
    if (exclude?.has(String(code))) continue; // 이미 산 와인 제외
    const personalized = scoredMap.get(code);
    if (personalized) {
      out.push(personalized); // 개인화 통과 = 원점수(raw) 그대로. 정규화/뻥튀기 없음.
      continue;
    }
    // 개인화 못 뚫은 와인은 발굴로만 노출: 발굴점수 × α (이력 많을수록 α↓ → 낮게 깔림).
    const bp = breadthPct.get(code) ?? 0;
    const discScore = Math.round(a * bp * 1000) / 10;
    if (discScore <= 0) continue; // 발굴 값도 없으면 노출 안 함
    const item = stubItem(inv, wineMap.get(code));
    item.score = discScore;
    if (bp >= 0.5) item.tags = [...item.tags, '동종업장'];
    item.breakdown = [`세그먼트·일반 ${Math.round(bp * 100)}% × 반영 ${Math.round(a * 100)}% = ${discScore.toFixed(1)}`];
    out.push(item);
  }
  out.sort((x, y) => y.score - x.score);
  return out;
}


/**
 * 개인화(scored, 이미 이력신뢰 c 적용) + 세그먼트 항목 병합.
 * 개인화 못 뚫은 와인은 '동종업장' 점수 = 업장유형 재구매 ×15 + 업태 재구매 ×15 로 상세 매김(α·정규화 없음).
 * 세그먼트 자체가 없는 거래처만 전사인기(구매폭)로 약하게 폴백. → 라벨은 개인화 vs 동종업장으로 자동 구분.
 */
export async function applyAdaptiveBlend(
  scored: ScoredItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventory: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  exclude: Set<string> | undefined, // 이미 산 와인 제외(신규제안)
  priceCeiling: number,             // 거래처 가격 상한(0=무제한)
  segVenue: Map<string, number>,    // 업장유형 재구매 순위(0~1)
  segBt: Map<string, number>,       // 업태 재구매 순위(0~1)
): Promise<ScoredItem[]> {
  const scoredCodes = new Set(scored.map((s) => String(s.item_no)));
  const hasSeg = segVenue.size > 0 || segBt.size > 0;
  let breadthPct: Map<string, number> | null = null;
  if (!hasSeg) { // 세그먼트 없는 거래처(태그·업태 프로파일 둘 다 없음)만 전사인기 폴백
    const popMap = await getItemPopularity();
    const codes = inventory.map((i) => String(i.item_no));
    const pct = percentileRanks(codes.map((c) => popMap.get(c)?.buyers || 0));
    breadthPct = new Map(); codes.forEach((c, i) => breadthPct!.set(c, pct[i]));
  }

  const out: ScoredItem[] = [...scored]; // 개인화(이미 c 적용됨)
  for (const inv of inventory) {
    const code = String(inv.item_no);
    if (exclude?.has(code) || scoredCodes.has(code)) continue;
    if (priceCeiling > 0 && (inv.supply_price || 0) > priceCeiling) continue;
    const sv = segVenue.get(code) || 0;
    const sb = segBt.get(code) || 0;
    let score: number; const breakdown: string[] = [];
    if (sv > 0 || sb > 0) {
      const svPts = 15 * sv, sbPts = 15 * sb;
      score = svPts + sbPts;
      if (sv > 0) breakdown.push(`업장유형 재구매 ${sv.toFixed(2)}×15 = +${svPts.toFixed(1)}`);
      if (sb > 0) breakdown.push(`업태 재구매 ${sb.toFixed(2)}×15 = +${sbPts.toFixed(1)}`);
    } else if (breadthPct) {
      const g = breadthPct.get(code) || 0;
      score = 15 * g;
      if (score <= 0) continue;
      breakdown.push(`전사인기 ${Math.round(g * 100)}% × 15 = +${score.toFixed(1)} (폴백)`);
    } else {
      continue;
    }
    const item = stubItem(inv, wineMap.get(code));
    item.score = Math.round(score * 10) / 10;
    if (sv >= 0.5 || sb >= 0.5) item.tags = [...item.tags, '동종업장'];
    breakdown.push(`= ${item.score.toFixed(1)}`);
    item.breakdown = breakdown;
    out.push(item);
  }
  out.sort((a, b) => b.score - a.score);
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
