import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidClientCode } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';

import { extractGrapesFromName, extractTypeFromName } from './lib/patterns';
import { loadSettings, makeMinStockForPrice } from './lib/settings';
import { analyzeClientHistory } from './lib/analyzeClient';
import { scoreCandidates, diversifyAndRank } from './lib/scoring';

// POST: AI 브리핑 생성
export async function POST(req: NextRequest) {
  try {
    const { meeting_id, client_code: rawClientCode } = await req.json();

    let clientCode = rawClientCode;
    const meetingId = meeting_id;

    // meeting_id로부터 client_code 복원
    if (meetingId && !clientCode) {
      const { data: meeting } = await supabase
        .from('meetings').select('client_code').eq('id', meetingId).single();
      if (!meeting) return NextResponse.json({ error: '미팅을 찾을 수 없습니다.' }, { status: 404 });
      clientCode = meeting.client_code;
    }

    if (!clientCode) {
      return NextResponse.json({ error: 'client_code 또는 meeting_id가 필요합니다.' }, { status: 400 });
    }

    // 입력 검증 + IDOR 방어
    if (!isValidClientCode(clientCode)) {
      return NextResponse.json({ error: 'Invalid client_code format' }, { status: 400 });
    }
    const accessCheck = await requireClientAccess(clientCode);
    if (accessCheck) return accessCheck;

    // 1. 거래처 + shipments 병렬 조회. 출고는 페이지네이션 — 거래처 lifetime 출고가 1000행 넘으면
    //   단발 조회는 최근 1000줄만 보여 연매출·추세가 truncate된다.
    const fetchClientShipments = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      for (let from = 0; from < 50000; from += 1000) {
        const { data } = await supabase.from('shipments')
          .select('item_no, item_name, unit_price, ship_date, quantity, total_amount')
          .eq('client_code', clientCode)
          .order('ship_date', { ascending: false })
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return rows;
    };
    const [clientDetailRes, clientBasicRes, shipments] = await Promise.all([
      supabase.from('client_details').select('*').eq('client_code', clientCode).maybeSingle(),
      supabase.from('clients').select('*').eq('client_code', clientCode).maybeSingle(),
      fetchClientShipments(),
    ]);
    const clientDetail = clientDetailRes.data;
    const clientBasic = clientBasicRes.data;
    const clientName = clientDetail?.client_name || clientBasic?.client_name || clientCode;

    // wines 메타 (구매 이력 item_code만)
    const purchasedCodes = Array.from(
      new Set(shipments.map((s) => s.item_no).filter(Boolean) as string[]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wineMap = new Map<string, any>();
    if (purchasedCodes.length > 0) {
      for (let i = 0; i < purchasedCodes.length; i += 500) {
        const batch = purchasedCodes.slice(i, i + 500);
        const { data: batchWines } = await supabase
          .from('wines')
          .select('item_code, country, country_en, grape_varieties, wine_type, region, item_name_kr')
          .in('item_code', batch);
        for (const w of batchWines || []) {
          if (!w.grape_varieties) {
            const extracted = extractGrapesFromName(w.item_name_kr || '');
            if (extracted.length > 0) w.grape_varieties = extracted.join(', ');
          }
          if (!w.wine_type) {
            w.wine_type = extractTypeFromName(w.item_name_kr || '');
          }
          wineMap.set(w.item_code, w);
        }
      }
    }

    const now = new Date();

    // 거래처 분석
    const analysis = analyzeClientHistory(shipments, wineMap, now);

    const clientSummary = {
      total_purchases: analysis.totalPurchases,
      avg_price: analysis.avgPrice,
      top_countries: analysis.topCountries,
      top_grapes: analysis.topGrapes,
      top_types: analysis.topTypes,
      last_order_date: analysis.lastOrderDate,
      trend: analysis.trend,
      yearly_revenue: analysis.yearlyRevenue,
      importance: clientDetail?.importance || null,
    };

    // 2. 추천 와인: settings + inventory 병렬
    const [settings, invRes] = await Promise.all([
      loadSettings(),
      supabase.from('inventory_cdv')
        .select('item_no, item_name, country, supply_price, stock_total, avg_sales_90d, brand')
        .gt('stock_total', 0),
    ]);
    const { W, SR } = settings;
    const rawInventory = invRes.data;
    const minStockForPrice = makeMinStockForPrice(SR);

    const inventory = (rawInventory || []).filter((inv) => {
      const stock = Number(inv.stock_total) || 0;
      if (stock <= 0) return false;
      if (stock < minStockForPrice(inv.supply_price || 0)) return false;
      const sales90d = inv.avg_sales_90d || 0;
      if (sales90d > 0 && stock < sales90d * (SR.months_supply * 30)) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (inv as any)._totalStock = stock;
      return true;
    });

    // 할인률 계산
    const invPriceMap: Record<string, { supply: number; retail: number }> = {};
    for (const inv of rawInventory || []) {
      invPriceMap[inv.item_no] = { supply: inv.supply_price || 0, retail: 0 };
    }

    let discountSum = 0, discountCount = 0;
    for (const s of shipments) {
      if (s.unit_price && s.item_no && invPriceMap[s.item_no]?.supply) {
        const sp = invPriceMap[s.item_no].supply;
        const disc = ((sp - s.unit_price) / sp) * 100;
        if (disc > 0 && disc <= 100) { discountSum += disc; discountCount++; }
      }
    }
    const avgDiscountRate = discountCount > 0 ? Math.round(discountSum / discountCount * 10) / 10 : null;

    // 구매 품목 Top 20 (S/A/B/C 등급)
    const purchasedItems = Object.entries(analysis.purchaseAgg)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([itemNo, agg]) => {
        const sp = invPriceMap[itemNo]?.supply || 0;
        let grade = 'C';
        if (sp >= 300000) grade = 'S';
        else if (sp >= 100000) grade = 'A';
        else if (sp >= 50000) grade = 'B';
        const wine = wineMap.get(itemNo);
        return {
          item_no: itemNo,
          item_name: agg.name,
          buy_count: agg.count,
          last_date: agg.lastDate,
          avg_unit_price: agg.count > 0 ? Math.round(agg.totalPrice / agg.count) : 0,
          supply_price: sp,
          grade,
          country: wine?.country || '',
          wine_type: wine?.wine_type || extractTypeFromName(agg.name),
        };
      });

    // 추천 와인 스코어링 + 다양화
    const scored = scoreCandidates({ inventory, wineMap, clientAnalysis: analysis, W, now });
    const recommendations = diversifyAndRank(scored);

    // 3. 최근 주문 5건
    const recentOrders = shipments.slice(0, 5).map((s) => ({
      item_name: s.item_name || s.item_no,
      ship_date: s.ship_date,
      quantity: s.quantity || 1,
    }));

    // 브리핑 구성
    const aiBriefing = {
      generated_at: new Date().toISOString(),
      client_summary: clientSummary,
      avg_discount_rate: avgDiscountRate,
      purchased_items: purchasedItems,
      recommendations,
      recent_orders: recentOrders,
    };

    // meetings.ai_briefing 저장
    if (meetingId) {
      const { error: updateError } = await supabase
        .from('meetings').update({ ai_briefing: aiBriefing }).eq('id', meetingId);
      if (updateError) console.error('Failed to save briefing to meeting:', updateError);
    }

    return NextResponse.json({
      success: true,
      client_name: clientName,
      client_code: clientCode,
      briefing: aiBriefing,
    });
  } catch (err) {
    console.error('POST /api/sales/meetings/briefing error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
