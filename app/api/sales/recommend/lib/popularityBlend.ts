// 개인화(raw) + 발굴 병합: 개인화 통과 와인은 원점수(raw) 그대로 노출(정규화 없음 → 뻥튀기 방지),
// 게이트 밖 와인만 '발굴점수 × α'로 낮게 얹어 노출. α는 이력 많을수록 작아짐(발굴 비중↓).
// 개인화 raw(≈0~100 절대값)와 발굴(α×0~1×100)이 같은 스케일 → 단골은 개인화가 상위 지배.
import type { ScoredItem } from './types';
import { normalizeType, bucketLabel } from './wineType';
import { getItemPopularity, getSegmentPopularity, scoreDiscovery } from './discovery';
import type { VenueWinePref } from './venueScoring';

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
    if (bp >= 0.7) item.tags = [...item.tags, '인기'];
    item.breakdown = [`발굴 ${bp.toFixed(2)} × α ${a.toFixed(2)} = ${discScore.toFixed(1)}`];
    out.push(item);
  }
  out.sort((x, y) => y.score - x.score);
  return out;
}

const ADAPTIVE_K = 6; // α = K/(K+구매품목수). 25품목≈0.2(8:2), 6품목=0.5, 1품목≈0.86. 작을수록 빨리 개인화로.

/**
 * 적응형 발굴 블렌드: 개인화 + α·발굴(인기+업장적합). α = K/(K+이력깊이) — 이력 얇을수록 발굴↑.
 * 신규 거래처(이력 0) → α≈1(순수 발굴), 단골 → α↓(취향 위주). manualWeight>0이면 α 고정(UI override).
 * 발굴 성분은 scoreDiscovery(무캡·유니버스) → 새 지역/타입도 진입.
 */
export async function applyAdaptiveBlend(
  scored: ScoredItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventory: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  segment: string,
  venuePref: VenueWinePref | null,
  historyDepth: number,
  manualWeight: number,
  exclude?: Set<string>, // 이미 산 와인 제외(신규제안)
  priceCeiling = 0,      // 거래처 가격 상한(0=무제한). 발굴/인기가 저가 업장에 고가 베스트셀러 꽂는 것 방지.
): Promise<ScoredItem[]> {
  const [popMap, segmentPop] = await Promise.all([
    getItemPopularity(),
    segment ? getSegmentPopularity(segment) : Promise.resolve(new Map<string, number>()),
  ]);
  const disc = scoreDiscovery(inventory, wineMap, { segment }, popMap, segmentPop, venuePref, false);
  const discNorm = new Map<string, number>();
  for (const d of disc) {
    if (priceCeiling > 0 && (d.price || 0) > priceCeiling) continue; // 거래처 가격대 초과 발굴 제외
    discNorm.set(d.item_no, (d.score || 0) / 100);
  }
  const alpha = manualWeight > 0 ? Math.min(1, manualWeight) : ADAPTIVE_K / (ADAPTIVE_K + Math.max(0, historyDepth));
  return blendPopularity(scored, inventory, wineMap, discNorm, alpha, exclude);
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
