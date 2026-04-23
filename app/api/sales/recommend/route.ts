import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidClientCode } from '@/app/lib/validators';

import { fetchAll, fetchInventoryInStock, fetchWinesByCodes } from './lib/fetchers';
import { extractGrapesFromName, extractTypeFromName } from './lib/patterns';
import { findHierarchy, extractEnglish, type WineRegionRow } from './lib/regions';
import { loadSettings, makeMinStockForPrice } from './lib/settings';
import { aggregatePurchases, buildClientPreferences } from './lib/preferences';
import { scoreRecommendations } from './lib/scoring';

export async function POST(req: Request) {
  try {
    const { client_code } = await req.json();
    if (!client_code) {
      return NextResponse.json({ error: 'client_code가 필요합니다.' }, { status: 400 });
    }
    if (!isValidClientCode(client_code)) {
      return NextResponse.json({ error: 'Invalid client_code format' }, { status: 400 });
    }

    // Phase 1: 거래처 + 출고 + 재고 + 산지 병렬 로드
    const [
      { W, SR },
      { data: clientDetail },
      { data: clientBasic },
      { data: shipments },
      rawInventory,
      regionRows,
    ] = await Promise.all([
      loadSettings(),
      supabase.from('client_details').select('*').eq('client_code', client_code).maybeSingle(),
      supabase.from('clients').select('*').eq('client_code', client_code).maybeSingle(),
      supabase.from('shipments').select('item_no, item_name, unit_price, ship_date').eq('client_code', client_code),
      fetchInventoryInStock<Record<string, unknown>>('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, sales_30days, avg_sales_90d, avg_sales_365d'),
      fetchAll<WineRegionRow>('wine_regions', 'sub_region, major_region, appellation, cru_vineyard, classification'),
    ]);

    // Phase 2: wines를 (구매이력 ∪ 현 재고) 품목으로 한정 조회
    const relevantCodes = new Set<string>();
    for (const s of (shipments || []) as Array<{ item_no?: string }>) {
      if (s.item_no) relevantCodes.add(s.item_no);
    }
    for (const inv of rawInventory) {
      const code = (inv as { item_no?: string }).item_no;
      if (code) relevantCodes.add(code);
    }
    const wines = await fetchWinesByCodes<Record<string, unknown>>(
      Array.from(relevantCodes),
      'item_code, country, country_en, grape_varieties, wine_type, region, item_name_kr, item_name_en',
    );

    const clientName = clientDetail?.client_name || clientBasic?.client_name || client_code;
    const allRegionRows = regionRows as WineRegionRow[];

    // 구매 이력 집계
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const purchaseAgg = aggregatePurchases((shipments || []) as any);

    // 재고 필터 (가격별 최소재고 + 3개월 공급)
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

    // wines 메타 + 산지 계층 매칭
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wineMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const w of (wines || []) as any[]) {
      if (!w.grape_varieties) {
        const extracted = extractGrapesFromName(w.item_name_kr || '');
        if (extracted.length > 0) w.grape_varieties = extracted.join(', ');
      }
      if (!w.wine_type) {
        w.wine_type = extractTypeFromName(w.item_name_kr || '');
      }
      const fullName = `${w.item_name_kr || ''} ${w.item_name_en || ''}`;
      w._hierarchy = findHierarchy(w.region || '', fullName, allRegionRows);
      wineMap.set(w.item_code, w);
    }

    // 거래처 선호도
    const prefs = buildClientPreferences(purchaseAgg, wineMap, inventoryMap);

    // 판매속도 최대값
    let maxSales90d = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inv of inventory as any[]) {
      if ((inv.avg_sales_90d || 0) > maxSales90d) maxSales90d = inv.avg_sales_90d;
    }

    // 3개월 전 기준일
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);

    // 스코어링
    const scored = scoreRecommendations({
      inventory,
      wineMap,
      purchaseAgg,
      prefs,
      W,
      maxSales90d,
      threeMonthsAgoStr,
    });
    const recommendations = scored.slice(0, 30);

    // 마지막 주문일
    let lastOrderDate: string | null = null;
    for (const agg of Object.values(purchaseAgg)) {
      if (agg.lastDate && (!lastOrderDate || agg.lastDate > lastOrderDate)) {
        lastOrderDate = agg.lastDate;
      }
    }

    // 이력 저장
    if (recommendations.length > 0) {
      await supabase.from('recommendations').insert({
        client_code,
        item_codes: recommendations.map((i) => i.item_no),
        reason: `AI 추천 ${recommendations.length}개 (산지+점수 기반)`,
        recommendation_type: 'ai_score',
        status: 'pending',
      });
    }

    return NextResponse.json({
      client: {
        code: client_code,
        name: clientName,
        importance: clientDetail?.importance || 3,
        business_type: clientDetail?.business_type || '',
        manager: clientDetail?.manager || '',
      },
      recommendations,
      summary: {
        total_items: Object.keys(purchaseAgg).length,
        avg_price: Math.round(prefs.clientAvgPrice),
        last_order_date: lastOrderDate,
        top_countries: prefs.topCountries.slice(0, 3).map((e) => e[0]),
        top_grapes: prefs.topGrapes.slice(0, 3).map((e) => e[0]),
        top_types: prefs.topTypes.slice(0, 3).map((e) => e[0]),
        top_regions: Object.entries(prefs.subRegionBuyCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([r]) => extractEnglish(r)),
      },
    });
  } catch (error) {
    console.error('Recommend API error:', error);
    return NextResponse.json({ error: '추천 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
