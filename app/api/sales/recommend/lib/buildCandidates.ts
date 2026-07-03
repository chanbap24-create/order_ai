// 거래처 추천 후보 생성 (규칙기반). /recommend 와 /recommend/llm-quote 가 공유.
import { supabase } from '@/app/lib/db';
import type { ScoredItem } from '@/app/sales/recommend/types';

import { fetchAll, fetchInventoryInStock, fetchWinesByCodes } from './fetchers';
import { extractGrapesFromName, extractTypeFromName } from './patterns';
import { findHierarchy, type WineRegionRow } from './regions';
import { makeMinStockForPrice, DEFAULT_REC_OPTS, type RecOpts } from './settings';
import { aggregatePurchases, buildClientPreferences } from './preferences';
import { scoreRecommendations, type SubstituteAnchor } from './scoring';
import { normalizeType } from './wineType';
import { isNonOrderable } from '@/app/lib/catalogFilter';
import { getClientConversion } from '@/app/lib/quoteConversion';
import { getClientQuoteFeatures } from './quoteFeedback';
import { scoreDiscovery, getSegmentPopularity, getItemPopularity } from './discovery';
import { isNonStandardBottle, isGiftBox } from './bottleSize';
import { applyRecommendedDiscounts } from './recommendDiscount';
import { applyAdaptiveBlend } from './popularityBlend';
import { buildSummary } from './buildSummary';
import { getClientVenue } from '@/app/lib/clientVenue';
import { VENUE_WINE_MAP } from './venueScoring';

export interface CandidateContext {
  client: { code: string; name: string; importance: number; business_type: string; manager: string };
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
    { data: allShipItems },
  ] = await Promise.all([
    supabase.from('client_details').select('*').eq('client_code', clientCode).maybeSingle(),
    supabase.from('clients').select('*').eq('client_code', clientCode).maybeSingle(),
    supabase.from('shipments').select('item_no, item_name, unit_price, quantity, ship_date').eq('client_code', clientCode).gte('ship_date', sinceStr),
    fetchInventoryInStock<Record<string, unknown>>('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, bonded_kctc, sales_30days, avg_sales_90d, avg_sales_365d'),
    fetchAll<WineRegionRow>('wine_regions', 'country, sub_region, major_region, appellation, cru_vineyard, classification'),
    supabase.from('recommendations').select('item_codes').eq('client_code', clientCode).eq('status', 'sent').gte('created_at', recoSinceMidnight).lt('created_at', todayKstMidnight),
    // 적응형 α용 이력 깊이 = 전체(기간 무관) 구매 품목 종수. 최근 6개월만 보면 단골이 신규로 오판됨.
    supabase.from('shipments').select('item_no').eq('client_code', clientCode).not('item_no', 'is', null),
  ]);
  const historyDepthAll = new Set((allShipItems || []).map((r: { item_no?: string }) => r.item_no)).size;

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
    fetchAll<{ wine_id: string; nose_note?: string; palate_note?: string }>('tasting_notes', 'wine_id, nose_note, palate_note'),
    // 과거 견적→실제 출고 전환(거래처별) — 추천 가점/감점 참고자료
    getClientConversion(clientCode),
    // 견적학습: 과거 견적을 속성 단위 전환 프로필로(거래처 단위). 신규 후보 ±조정.
    getClientQuoteFeatures(clientCode, regionRows as WineRegionRow[]),
    // 업장 유형 태그(스시·프렌치 등) — 있으면 적합 가산. CDV=wine.
    getClientVenue(clientCode, 'wine'),
  ]);
  const venuePref = venueKey ? VENUE_WINE_MAP[venueKey] ?? null : null;
  const notesMap = new Map<string, string>();
  for (const n of allNotes) {
    notesMap.set(n.wine_id, `${n.nose_note || ''} ${n.palate_note || ''}`.trim());
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
    wineMap.set(w.item_code, w);
  }

  const prefs = buildClientPreferences(purchaseAgg, wineMap, inventoryMap);

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
    }, popMap, segmentPop, venuePref);
  } else {
    scored = scoreRecommendations({
      inventory, wineMap, purchaseAgg, prefs,
      priceBandPct: o.priceBandPct, geoCeiling: o.geoCeiling, freqStrength: o.freqStrength,
      maxSales90d, recentlyRecommended, conversionMap,
      scoreParams: o.scoreParams,
      mode: o.mode, anchor,
      ...(quoteFeedback ? { quoteFeedback } : {}),
      ...(venuePref ? { venuePref } : {}),
    }) as ScoredItem[];
    // 적응형 발굴 블렌드 — 신규제안: 이력 얇을수록 발굴↑(업장적합 포함). popularityWeight 지정 시 α 고정.
    if (o.mode === 'new') {
      // 이미 산 와인은 신규제안에서 제외 — 블렌드가 유니버스로 되살리지 않게 purchaseAgg 전달
      const boughtCodes = new Set(Object.keys(purchaseAgg));
      // 발굴 가격 상한: 프리미엄 밴드(있으면) 또는 주력 중앙값×3 + 여유 → 저가 업장에 고가 베스트셀러 방지
      const mainMed = prefs.priceStats['__all__']?.median || prefs.clientAvgPrice || 0;
      const bandPct = o.priceBandPct > 0 ? o.priceBandPct : 0.2;
      const priceCeiling = (prefs.premiumBand > 0 ? prefs.premiumBand : mainMed * 3) * (1 + bandPct);
      scored = await applyAdaptiveBlend(scored, inventory, wineMap, clientDetail?.business_type || '', venuePref, historyDepthAll, o.popularityWeight ?? 0, boughtCodes, priceCeiling);
    }
  }

  // 권장 할인율: 영업범위 최근 6개월 '최빈가' 기반(적용 토글 시).
  if (o.discountApply !== false) await applyRecommendedDiscounts(scored, o.discountScope === 'rest' ? 'rest' : 'team1');

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
    },
    scored,
    summary: buildSummary(purchaseAgg, prefs, wineMap, o.profileMonths, o.priceBandPct, lastOrderDate),
    wineMap,
    recentCodes,
  };
}
