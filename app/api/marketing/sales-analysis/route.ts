import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

import { BRAND_COUNTRY } from './lib/constants';
import { buildVintageMap } from './lib/wineResolver';
import { fetchShipments } from './lib/shipmentFetcher';
import { buildOptionsResponse } from './lib/optionsResponse';
import { aggregateShipments, buildGroupedResults } from './lib/aggregate';

// 매출 기준: 공급가액(부가세 제외) — 시기별 컬럼 상이 (memory: project_shipment_price_format.md)
// GET /api/marketing/sales-analysis?start_date=...&end_date=...&country=...&region=...&wine_type=...
// 필터 없으면 전체 조회. mode=options → 선택 가능한 국가/지역/타입 목록 반환.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const filters = {
      country: searchParams.get('country') || '',
      region: searchParams.get('region') || '',
      type: searchParams.get('wine_type') || '',
      volume: searchParams.get('volume') || '',
      subRegion: searchParams.get('sub_region') || '',
      brand: searchParams.get('brand') || '',
    };

    // wines + inventory 병렬 로드
    const [{ data: wines }, { data: inv }] = await Promise.all([
      supabase.from('wines')
        .select('item_code, item_name_kr, country, region, wine_type, supplier_kr, supplier, brand')
        .not('item_code', 'like', 'D%'),
      supabase.from('inventory_cdv').select('item_no, country'),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wineMap = new Map<string, any>();
    for (const w of (wines || [])) wineMap.set(w.item_code, w);
    const invMap = new Map<string, string>();
    for (const r of (inv || []) as Array<{ item_no: string; country: string | null }>) {
      if (r.country) invMap.set(r.item_no, r.country);
    }

    const brandCountry = new Map<string, string>();
    for (const w of (wines || [])) {
      const m = (w.item_name_kr || '').match(/^([A-Z]{2})\s/);
      if (m && w.country) brandCountry.set(m[1], w.country);
    }
    for (const [k, v] of Object.entries(BRAND_COUNTRY)) {
      if (!brandCountry.has(k)) brandCountry.set(k, v);
    }

    // 브랜드 코드 → 한글명 매핑 (wines.brand + wines.supplier_kr)
    const brandNameMap = new Map<string, string>();
    for (const w of (wines || [])) {
      if (w.brand && w.supplier_kr && !brandNameMap.has(w.brand)) {
        brandNameMap.set(w.brand, w.supplier_kr);
      }
    }

    // mode=options
    if (mode === 'options') {
      return buildOptionsResponse(wines || [], brandNameMap);
    }

    // 기간 필수
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date, end_date required' }, { status: 400 });
    }

    // 빈티지 매칭 캐시
    const vintageMap = buildVintageMap(wineMap);

    // shipments 병렬 fetch + 집계
    const allShipments = await fetchShipments(startDate, endDate);
    const {
      itemAgg, monthlyQty, totalQty,
      matchedCountry, matchedRegion, matchedType,
    } = aggregateShipments(allShipments, wineMap, invMap, brandCountry, vintageMap, filters);

    const { countries, regions, types, topItems, totalAmount } = buildGroupedResults(
      itemAgg, filters.region, brandNameMap,
    );

    // 월별 추이
    const monthly = Object.entries(monthlyQty)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, qty]) => ({ month, qty }));

    // 일/월 평균
    const dayMs = 1000 * 60 * 60 * 24;
    const days = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / dayMs));
    const dailyAvg = Math.round(totalQty / days);
    const monthlyAvg = Math.round(totalQty / Math.max(1, monthly.length));

    return NextResponse.json({
      total_qty: totalQty,
      total_amount: totalAmount,
      total_items: Object.keys(itemAgg).length,
      daily_avg: dailyAvg,
      monthly_avg: monthlyAvg,
      match_rate: {
        country: totalQty > 0 ? Math.round(matchedCountry / totalQty * 100) : 0,
        region: totalQty > 0 ? Math.round(matchedRegion / totalQty * 100) : 0,
        type: totalQty > 0 ? Math.round(matchedType / totalQty * 100) : 0,
      },
      countries,
      regions,
      types,
      top_items: topItems,
      monthly,
    });
  } catch (err) {
    console.error('GET /api/marketing/sales-analysis error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
