// 거래처 추천 후보 생성 (규칙기반). /recommend 와 /recommend/llm-quote 가 공유.
import { supabase } from '@/app/lib/db';
import type { ScoredItem } from '@/app/sales/recommend/types';

import { fetchAll, fetchInventoryInStock, fetchWinesByCodes } from './fetchers';
import { extractGrapesFromName, extractTypeFromName } from './patterns';
import { findHierarchy, type WineRegionRow } from './regions';
import { makeMinStockForPrice, DEFAULT_REC_OPTS, type RecOpts } from './settings';
import { aggregatePurchases, buildClientPreferences } from './preferences';
import { scoreRecommendations, type SubstituteAnchor, type SegRank } from './scoring';
import { normalizeType, bucketLabel } from './wineType';
import { isNonOrderable } from '@/app/lib/catalogFilter';
import { getClientConversion } from '@/app/lib/quoteConversion';
import { getClientQuoteFeatures } from './quoteFeedback';
import { scoreDiscovery, getSegmentPopularity, getItemPopularity } from './discovery';
import { isNonStandardBottle, isGiftBox } from './bottleSize';
import { applyRecommendedDiscounts } from './recommendDiscount';
import { applyFormulaDiscounts } from './formulaDiscount';
import { venueKeyToCategory } from '@/app/lib/pricing/venueCategory';
import { computeQuarterMetrics, computeGrade } from '@/app/lib/pricing/clientGrade';
import { scaleForGrade } from './gradeScaling';
import { buildSummary } from './buildSummary';
import { getClientVenue } from '@/app/lib/clientVenue';
import { VENUE_WINE_MAP } from './venueScoring';
import { getSegmentProfile, extractRegion, type SegmentProfile } from '@/app/lib/segmentProfiles';

export interface CandidateContext {
  client: { code: string; name: string; importance: number; business_type: string; manager: string; grade?: number };
  scored: ScoredItem[];
  summary: {
    total_items: number; avg_price: number; last_order_date: string | null;
    top_countries: string[]; top_grapes: string[]; top_types: string[]; top_regions: string[];
    analysis: {
      types: string[];         // 주력 타입(레드/화이트/…)
      broad_regions: string[]; // 주력 광역(부르고뉴 등)
      flavors: string[];       // 향미 키워드
      avg_price: number;       // 거래처 평균가(전체)
      band_pct: number;        // 적용 가격밴드 ±%
      type_prices: { type: string; avg: number }[]; // 타입별 평균가
      region_dist: { label: string; count: number; pct: number }[]; // 지역별 매입 분포
      period_months: number; // 분석 기간(개월)
      purchased: { name: string; region: string; count: number; last: string | null }[]; // 최근 구매 품목
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>;
  recentCodes: string[]; // 최근 6개월 구매 품번 (취향 프로파일용)
  typeShares: Record<string, number>; // 타입 분포(본인+업장+업태 블렌드) — 비례배분 selection용
}

export async function buildCandidates(
  clientCode: string,
  opts: Partial<RecOpts> = {},
): Promise<CandidateContext> {
  const o: RecOpts = {
    ...DEFAULT_REC_OPTS, ...opts,
    minStock: { ...DEFAULT_REC_OPTS.minStock, ...(opts.minStock || {}) },
  };
  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - o.profileMonths);
  const sinceStr = sinceDate.toISOString().slice(0, 10);

  // 최근 제안 중복 회피용 기간(KST): [30일 전 00:00, 오늘 00:00) — 오늘 재생성분은 제외.
  const RECO_LOOKBACK_DAYS = 30;
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKstMidnight = `${nowKst.toISOString().slice(0, 10)}T00:00:00+09:00`;
  const recoSinceMidnight = `${new Date(nowKst.getTime() - RECO_LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10)}T00:00:00+09:00`;

  const [
    { data: clientDetail },
    { data: clientBasic },
    { data: shipments },
    rawInventory,
    regionRows,
    { data: recoRows },
  ] = await Promise.all([
    supabase.from('client_details').select('*').eq('client_code', clientCode).maybeSingle(),
    supabase.from('clients').select('*').eq('client_code', clientCode).maybeSingle(),
    supabase.from('shipments').select('item_no, item_name, unit_price, quantity, ship_date').eq('client_code', clientCode).gte('ship_date', sinceStr),
    fetchInventoryInStock<Record<string, unknown>>('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, bonded_kctc, sales_30days, avg_sales_90d, avg_sales_365d'),
    fetchAll<WineRegionRow>('wine_regions', 'country, sub_region, major_region, appellation, cru_vineyard, classification'),
    supabase.from('recommendations').select('item_codes').eq('client_code', clientCode).eq('status', 'sent').gte('created_at', recoSinceMidnight).lt('created_at', todayKstMidnight),
  ]);

  // 최근 30일(오늘 제외) 실제 견적서로 나간 품번 집합 — 중복 제안 강등용
  const recentlyRecommended = new Set<string>();
  for (const r of (recoRows || []) as Array<{ item_codes?: string[] | null }>) {
    for (const c of r.item_codes || []) recentlyRecommended.add(String(c));
  }

  const relevantCodes = new Set<string>();
  for (const s of (shipments || []) as Array<{ item_no?: string }>) {
    if (s.item_no) relevantCodes.add(s.item_no);
  }
  for (const inv of rawInventory) {
    const code = (inv as { item_no?: string }).item_no;
    if (code) relevantCodes.add(code);
  }
  const codeList = Array.from(relevantCodes);
  const [wines, allNotes, conv, quoteFeedback, venueKey] = await Promise.all([
    fetchWinesByCodes<Record<string, unknown>>(
      codeList,
      'item_code, country, country_en, grape_varieties, wine_type, region, item_name_kr, item_name_en, image_url, brand, supplier, supply_price',
    ),
    // 테이스팅노트는 작은 테이블 — 전체를 받아 맵으로(.in 500 한도 회피)
    fetchAll<{ wine_id: string; nose_note?: string; palate_note?: string; flavor_tags?: string[] }>('tasting_notes', 'wine_id, nose_note, palate_note, flavor_tags'),
    // 과거 견적→실제 출고 전환(거래처별) — 추천 가점/감점 참고자료
    getClientConversion(clientCode),
    // 견적학습: 과거 견적을 속성 단위 전환 프로필로(거래처 단위). 신규 후보 ±조정.
    getClientQuoteFeatures(clientCode, regionRows as WineRegionRow[]),
    // 업장 유형 태그(스시·프렌치 등) — 있으면 적합 가산. CDV=wine.
    getClientVenue(clientCode, 'wine'),
  ]);
  const venuePref = venueKey ? VENUE_WINE_MAP[venueKey] ?? null : null;
  // 업장·업태·지역 세그먼트 = 그 세그먼트가 사는 '타입'·'국가' 분포로 점수. (아이템 재구매 아님 — generic 오염 방지)
  const clientRegion = extractRegion(clientDetail?.address);
  const [venueProfile, btProfile, regionProfile] = await Promise.all([
    venueKey ? getSegmentProfile('venue', venueKey) : Promise.resolve(null),
    clientDetail?.business_type ? getSegmentProfile('business_type', clientDetail.business_type) : Promise.resolve(null),
    clientRegion ? getSegmentProfile('region', clientRegion) : Promise.resolve(null),
  ]);
  const toSegRank = (p: SegmentProfile | null): SegRank | null => {
    if (!p) return null;
    const typeRank = new Map<string, number>();
    Object.entries(p.type_dist || {}).sort((a, b) => b[1] - a[1]).forEach(([t], i) => { if (t !== '기타') typeRank.set(t, i); });
    const countryRank = new Map<string, number>();
    (p.top_countries || []).forEach((c, i) => { if (c.country && c.country !== '기타') countryRank.set(c.country, i); });
    return { typeRank, countryRank };
  };
  const segScorers = { venue: toSegRank(venueProfile), bt: toSegRank(btProfile), region: toSegRank(regionProfile) };
  const regionPriceMedian = regionProfile?.price_median || 0; // 지역 추천가(무이력 거래처 폴백)
  const notesMap = new Map<string, string>();
  const flavorTagsMap = new Map<string, string[]>();
  for (const n of allNotes) {
    notesMap.set(n.wine_id, `${n.nose_note || ''} ${n.palate_note || ''}`.trim());
    if (n.flavor_tags && n.flavor_tags.length) flavorTagsMap.set(n.wine_id, n.flavor_tags);
  }
  const conversionMap = new Map<string, { quoted: number; converted: number }>();
  for (const w of conv.wines) {
    conversionMap.set(w.item_code, { quoted: w.quoted_count, converted: w.converted_count });
  }

  const clientName = clientDetail?.client_name || clientBasic?.client_name || clientCode;
  const allRegionRows = regionRows as WineRegionRow[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseAgg = aggregatePurchases((shipments || []) as any);

  const minStockForPrice = makeMinStockForPrice(o.minStock);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventory = (rawInventory || []).filter((inv: any) => {
    const price = inv.supply_price || 0;
    if (price <= 0) return false; // 공급가 미입력 품목은 추천 제외(가격 없이 견적 불가)
    // 비(非)상품 제외 — 포장/더미/판촉/케이스, CDV 품번 '9' 접두(catalogFilter 규칙)
    if (isNonOrderable(inv.item_no, inv.item_name, 'CDV')) return false;
    // 병 용량: 기본은 750ml 표준만(375ml·1.5L+ 제외). 버튼으로 포함 가능.
    if (!o.includeNonStandard && isNonStandardBottle(inv.item_name as string)) return false;
    // 기프트박스(GB) — 선물용 패키지라 항상 제외
    if (isGiftBox(inv.item_name as string)) return false;
    const stock = (inv.available_stock || 0) + (inv.bonded_warehouse || 0) + (inv.bonded_kctc || 0);
    if (stock <= 0) return false;
    if (stock < minStockForPrice(price)) return false;
    // 최소 1개월치 재고만 확보되면 추천(품절 임박만 배제). 빠른 회전 와인이 과도하게
    // 빠지지 않도록 완화 — 기존 3개월치(months_supply) 요구는 잘 팔리는 와인을 너무 많이 제외했음.
    const monthly = inv.sales_30days || 0;
    if (monthly > 0 && stock < monthly * o.stockMonths) return false;
    inv._totalStock = stock;
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventoryMap = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const inv of inventory) inventoryMap.set((inv as any).item_no, inv);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wineMap = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const w of (wines || []) as any[]) {
    if (!w.grape_varieties) {
      const extracted = extractGrapesFromName(w.item_name_kr || '');
      if (extracted.length > 0) w.grape_varieties = extracted.join(', ');
    }
    if (!w.wine_type) w.wine_type = extractTypeFromName(w.item_name_kr || '');
    const fullName = `${w.item_name_kr || ''} ${w.item_name_en || ''}`;
    w._hierarchy = findHierarchy(w.region || '', fullName, allRegionRows, w.country_en || w.country || '');
    w._notes = notesMap.get(w.item_code) || '';
    w._flavorTags = flavorTagsMap.get(w.item_code) || null;
    wineMap.set(w.item_code, w);
  }

  const prefs = buildClientPreferences(purchaseAgg, wineMap, inventoryMap);

  // 타입 분포(비주력 강등 + 비례배분 selection): 본인 이력(설정기간) + 업장·업태 세그먼트 블렌드.
  //  이력신뢰 conf — 얇으면 세그먼트 우세(프레르가 스파클링1건에 안 묶임), 단골이면 본인 우세. 지역은 제외(타입 mix엔 노이즈).
  const typeShares: Record<string, number> = (() => {
    const ownCnt: Record<string, number> = {}; let ownTot = 0;
    for (const [no, a] of Object.entries(purchaseAgg)) {
      const w = wineMap.get(String(no));
      const bl = bucketLabel(normalizeType(w?.wine_type || '', w?.item_name_kr || a.name || ''));
      if (!bl || bl === '기타') continue;
      ownCnt[bl] = (ownCnt[bl] || 0) + a.count; ownTot += a.count;
    }
    const segDist: Record<string, number> = {}; // 업장 + 업태 타입분포 결합
    for (const p of [venueProfile, btProfile]) {
      if (!p?.type_dist) continue;
      for (const [t, s] of Object.entries(p.type_dist)) if (t !== '기타') segDist[t] = (segDist[t] || 0) + (s as number);
    }
    const segTot = Object.values(segDist).reduce((a, b) => a + b, 0) || 1;
    const TYPE_CONF_K = 10; // 출고 이만큼 쌓이면 본인 타입성향 100% 신뢰
    const conf = Math.min(1, ownTot / TYPE_CONF_K);
    const out: Record<string, number> = {};
    for (const t of new Set([...Object.keys(ownCnt), ...Object.keys(segDist)])) {
      const own = ownTot > 0 ? (ownCnt[t] || 0) / ownTot : 0;
      out[t] = conf * own + (1 - conf) * (segDist[t] / segTot);
    }
    return out;
  })();

  let maxSales90d = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const inv of inventory as any[]) {
    if ((inv.avg_sales_90d || 0) > maxSales90d) maxSales90d = inv.avg_sales_90d;
  }

  // 대체상품 모드: 쇼트난 기준 상품의 산지·가격·타입으로 닻을 구성(거래처 평균 대신 이 상품에 근접 추천)
  let anchor: SubstituteAnchor | undefined;
  if (o.mode === 'substitute' && o.anchorItemCode) {
    const aw = wineMap.get(o.anchorItemCode);
    if (aw) {
      const h = aw._hierarchy;
      const aInv = inventoryMap.get(o.anchorItemCode);
      anchor = {
        itemCode: o.anchorItemCode,
        profile: {
          subs: new Set<string>(h?.sub_region ? [h.sub_region] : []),
          majors: new Set<string>(h?.major_region ? [h.major_region] : []),
          supers: new Set<string>(h?.super_region ? [h.super_region] : []),
        },
        price: o.anchorPrice || (aInv as { supply_price?: number } | undefined)?.supply_price || 0,
        bucket: normalizeType(aw.wine_type || '', aw.item_name_kr || ''),
      };
    }
  }

  // 거래처 등급(직전 분기 품목수·거래횟수·매출) → 추천점수 가중치 가변화.
  //   거래 많을수록 거래처축(산지+취향+견적학습)↑ / 베이스축(업장+업태+지역)↓. 등급0=기본(스케일1.0).
  const gradePriceOf = (no: string): number =>
    (inventoryMap.get(no)?.supply_price as number | undefined) ||
    (wineMap.get(no)?.supply_price as number | undefined) || 0;
  const clientGrade = computeGrade(
    venueKeyToCategory(venueKey),
    computeQuarterMetrics(
      (shipments || []) as Array<{ item_no?: string; quantity?: number; ship_date?: string }>,
      gradePriceOf,
    ),
  );
  const graded = scaleForGrade(clientGrade, o.scoreParams);

  let scored: ScoredItem[];
  if (o.mode === 'discovery') {
    // 발굴/신규: 거래처 이력 무관. 인기(구매처수·매출·최근성 백분위) + 업태(있을 때). 업태는 지정값 우선, 없으면 거래처 업태.
    const seg = o.discoverySegment || clientDetail?.business_type || '';
    const [popMap, segmentPop] = await Promise.all([
      getItemPopularity(),
      seg ? getSegmentPopularity(seg) : Promise.resolve(new Map<string, number>()),
    ]);
    scored = scoreDiscovery(inventory, wineMap, {
      types: o.discoveryTypes,
      minPrice: o.discoveryMinPrice,
      maxPrice: o.discoveryMaxPrice,
      segment: seg,
    }, popMap, segmentPop, venuePref, true);
  } else {
    // 가격 기준: 이력 있으면 거래처 본인 대표가(횟수가중평균), 없으면 지역 추천가(무이력 폴백).
    const ownMean = prefs.priceStats['__all__']?.mean || prefs.clientAvgPrice || 0;
    const regionPriceRef = ownMean > 0 ? ownMean : regionPriceMedian;
    scored = scoreRecommendations({
      inventory, wineMap, purchaseAgg, prefs,
      priceBandPct: o.priceBandPct, geoCeiling: o.geoCeiling,
      maxSales90d, recentlyRecommended, conversionMap,
      scoreParams: o.mode === 'new' ? graded.scoreParams : o.scoreParams,
      mode: o.mode, anchor,
      ...(quoteFeedback ? { quoteFeedback } : {}),
      ...(o.mode === 'new' ? { segScorers, regionPriceRef, typeShares, segPts: graded.segPts } : {}),
    }) as ScoredItem[];
  }

  // 권장 할인율: 가격공식(업태 기본 + 분기 공급가매출 등급 + 수량/품목 등급 + 리델) 기반.
  //   · 수량(rec_quantity)은 영업범위 6개월 최빈 묶음(모달)에서 가져오고,
  //   · 할인율(rec_discount)은 공식으로 확정(모달 경험치 대신). 샵·도매는 비고에 수량 사다리.
  if (o.discountApply !== false) {
    await applyRecommendedDiscounts(scored, o.discountScope === 'rest' ? 'rest' : 'team1');
    const priceOf = (no: string): number =>
      (inventoryMap.get(no)?.supply_price as number | undefined) ||
      (wineMap.get(no)?.supply_price as number | undefined) || 0;
    await applyFormulaDiscounts(scored, {
      clientCode,
      venueKey,
      shipments: (shipments || []) as Array<{ item_no?: string; quantity?: number; ship_date?: string }>,
      priceOf,
    });
  }

  let lastOrderDate: string | null = null;
  for (const agg of Object.values(purchaseAgg)) {
    if (agg.lastDate && (!lastOrderDate || agg.lastDate > lastOrderDate)) lastOrderDate = agg.lastDate;
  }

  // 최근 6개월 구매 품번
  const sixAgo = new Date();
  sixAgo.setMonth(sixAgo.getMonth() - 6);
  const sixAgoStr = sixAgo.toISOString().slice(0, 10);
  const recentCodes: string[] = [];
  const seenRecent = new Set<string>();
  for (const s of (shipments || []) as Array<{ item_no?: string; ship_date?: string }>) {
    if (s.item_no && s.ship_date && s.ship_date >= sixAgoStr && !seenRecent.has(s.item_no)) {
      seenRecent.add(s.item_no);
      recentCodes.push(s.item_no);
    }
  }

  return {
    client: {
      code: clientCode,
      name: clientName,
      importance: clientDetail?.importance || 3,
      business_type: clientDetail?.business_type || '',
      manager: clientDetail?.manager || '',
      grade: clientGrade,
    },
    scored,
    summary: buildSummary(purchaseAgg, prefs, wineMap, o.profileMonths, o.priceBandPct, lastOrderDate),
    wineMap,
    recentCodes,
    typeShares,
  };
}
