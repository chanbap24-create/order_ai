// 거래처 추천 후보 생성 (규칙기반). /recommend 와 /recommend/llm-quote 가 공유.
import { supabase } from '@/app/lib/db';
import type { ScoredItem } from '@/app/sales/recommend/types';

import { fetchAll, fetchInventoryInStock, fetchWinesByCodes } from './fetchers';
import { extractGrapesFromName, extractTypeFromName } from './patterns';
import { findHierarchy, extractEnglish, type WineRegionRow } from './regions';
import { loadSettings, makeMinStockForPrice } from './settings';
import { aggregatePurchases, buildClientPreferences } from './preferences';
import { scoreRecommendations } from './scoring';
import { bucketLabel } from './wineType';
import { flavorLabel } from './flavor';

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
  priceBandPct = 0.2,
  profileMonths = 6, // 취향 분석에 쓰는 최근 출고 기간(개월)
): Promise<CandidateContext> {
  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - profileMonths);
  const sinceStr = sinceDate.toISOString().slice(0, 10);

  const [
    { SR },
    { data: clientDetail },
    { data: clientBasic },
    { data: shipments },
    rawInventory,
    regionRows,
  ] = await Promise.all([
    loadSettings(),
    supabase.from('client_details').select('*').eq('client_code', clientCode).maybeSingle(),
    supabase.from('clients').select('*').eq('client_code', clientCode).maybeSingle(),
    supabase.from('shipments').select('item_no, item_name, unit_price, ship_date').eq('client_code', clientCode).gte('ship_date', sinceStr),
    fetchInventoryInStock<Record<string, unknown>>('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, sales_30days, avg_sales_90d, avg_sales_365d'),
    fetchAll<WineRegionRow>('wine_regions', 'sub_region, major_region, appellation, cru_vineyard, classification'),
  ]);

  const relevantCodes = new Set<string>();
  for (const s of (shipments || []) as Array<{ item_no?: string }>) {
    if (s.item_no) relevantCodes.add(s.item_no);
  }
  for (const inv of rawInventory) {
    const code = (inv as { item_no?: string }).item_no;
    if (code) relevantCodes.add(code);
  }
  const codeList = Array.from(relevantCodes);
  const [wines, allNotes] = await Promise.all([
    fetchWinesByCodes<Record<string, unknown>>(
      codeList,
      'item_code, country, country_en, grape_varieties, wine_type, region, item_name_kr, item_name_en, image_url, brand, supplier',
    ),
    // 테이스팅노트는 작은 테이블 — 전체를 받아 맵으로(.in 500 한도 회피)
    fetchAll<{ wine_id: string; nose_note?: string; palate_note?: string }>('tasting_notes', 'wine_id, nose_note, palate_note'),
  ]);
  const notesMap = new Map<string, string>();
  for (const n of allNotes) {
    notesMap.set(n.wine_id, `${n.nose_note || ''} ${n.palate_note || ''}`.trim());
  }

  const clientName = clientDetail?.client_name || clientBasic?.client_name || clientCode;
  const allRegionRows = regionRows as WineRegionRow[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseAgg = aggregatePurchases((shipments || []) as any);

  const minStockForPrice = makeMinStockForPrice(SR);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventory = (rawInventory || []).filter((inv: any) => {
    const price = inv.supply_price || 0;
    const stock = (inv.available_stock || 0) + (inv.bonded_warehouse || 0);
    if (stock <= 0) return false;
    const sales90d = inv.avg_sales_90d || 0;
    if (stock < minStockForPrice(price)) return false;
    if (sales90d > 0) {
      const demandDays = sales90d * (SR.months_supply * 30);
      if (stock < demandDays) return false;
    }
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
    w._hierarchy = findHierarchy(w.region || '', fullName, allRegionRows);
    w._notes = notesMap.get(w.item_code) || '';
    wineMap.set(w.item_code, w);
  }

  const prefs = buildClientPreferences(purchaseAgg, wineMap, inventoryMap);

  let maxSales90d = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const inv of inventory as any[]) {
    if ((inv.avg_sales_90d || 0) > maxSales90d) maxSales90d = inv.avg_sales_90d;
  }

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);

  const scored = scoreRecommendations({
    inventory, wineMap, purchaseAgg, prefs, priceBandPct, maxSales90d, threeMonthsAgoStr,
  }) as ScoredItem[];

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
    summary: {
      total_items: Object.keys(purchaseAgg).length,
      avg_price: Math.round(prefs.clientAvgPrice),
      last_order_date: lastOrderDate,
      top_countries: prefs.topCountries.slice(0, 3).map((e) => e[0]),
      top_grapes: prefs.topGrapes.slice(0, 3).map((e) => e[0]),
      top_types: prefs.topTypes.slice(0, 3).map((e) => e[0]),
      top_regions: Object.entries(prefs.subRegionBuyCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => extractEnglish(r)),
      analysis: {
        types: Array.from(prefs.typeBuckets).map(bucketLabel).filter(Boolean),
        broad_regions: (Object.keys(prefs.superRegionBuyCount).length
          ? Object.entries(prefs.superRegionBuyCount)
          : Object.entries(prefs.majorRegionBuyCount)
        ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => extractEnglish(r)),
        flavors: Array.from(prefs.flavorKeys).map(flavorLabel).slice(0, 6),
        avg_price: Math.round(prefs.clientAvgPrice),
        band_pct: Math.round(priceBandPct * 100),
        type_prices: Array.from(prefs.typeBuckets).map((b) => {
          const s = prefs.priceStats[b];
          return { type: bucketLabel(b), avg: s && s.count ? Math.round(s.sum / s.count) : 0 };
        }).filter((t) => t.type && t.avg > 0).sort((a, b) => b.avg - a.avg),
        region_dist: (() => {
          const total = Object.values(prefs.regionDist).reduce((a, b) => a + b, 0) || 1;
          return Object.entries(prefs.regionDist)
            .sort((a, b) => b[1] - a[1]).slice(0, 7)
            .map(([r, c]) => ({ label: extractEnglish(r), count: c, pct: Math.round((c / total) * 100) }));
        })(),
        period_months: profileMonths,
        purchased: Object.entries(purchaseAgg)
          .map(([code, agg]) => {
            const w = wineMap.get(code);
            const h = w?._hierarchy;
            const region = h?.sub_region ? extractEnglish(h.sub_region)
              : h?.major_region ? extractEnglish(h.major_region)
              : (w?.region || '');
            return { name: w?.item_name_kr || agg.name || code, region, count: agg.count, last: agg.lastDate || null };
          })
          .sort((a, b) => (b.last || '').localeCompare(a.last || '') || b.count - a.count)
          .slice(0, 20),
      },
    },
    wineMap,
    recentCodes,
  };
}
