import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// GET: 거래처 코드 목록에 대한 매출 통계 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const clientType = searchParams.get('type') || 'wine';

    // 타입에 따라 테이블 선택
    const shipmentsTable = clientType === 'glass' ? 'glass_shipments' : 'shipments';

    // 기준 날짜 계산 (변동률: 최근 3개월 vs 이전 3개월)
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const threeStr = threeMonthsAgo.toISOString().slice(0, 10);
    const sixStr = sixMonthsAgo.toISOString().slice(0, 10);
    const twelveStr = twelveMonthsAgo.toISOString().slice(0, 10);

    // 단일 거래처 상세 통계
    if (code) {
      const { data: detail } = await supabase
        .from('client_details')
        .select('client_type')
        .eq('client_code', code)
        .single();

      const table = detail?.client_type === 'glass' ? 'glass_shipments' : 'shipments';
      const statsTable = detail?.client_type === 'glass' ? 'glass_client_item_stats' : 'client_item_stats';

      const { data: recentShipments } = await supabase
        .from(table)
        .select('item_no, item_name, quantity, selling_price, total_amount, ship_date, manager')
        .eq('client_code', code)
        .order('ship_date', { ascending: false })
        .limit(20);

      const { data: itemStats } = await supabase
        .from(statsTable)
        .select('*')
        .eq('client_code', code)
        .order('buy_count' as string, { ascending: false });

      // 최근 1년 매출
      const { data: salesData } = await supabase
        .from(table)
        .select('total_amount, ship_date')
        .eq('client_code', code)
        .gte('ship_date', twelveStr);

      let totalSales = 0;
      let recentQtr = 0;   // 최근 3개월
      let prevQtr = 0;     // 이전 3개월 (3~6개월 전)
      for (const s of (salesData || [])) {
        const amt = s.total_amount || 0;
        totalSales += amt;
        const d = s.ship_date?.toString().slice(0, 10) || '';
        if (d >= threeStr) recentQtr += amt;
        else if (d >= sixStr) prevQtr += amt;
      }

      const changeRate = prevQtr > 0 ? ((recentQtr - prevQtr) / prevQtr * 100) : (recentQtr > 0 ? 100 : 0);
      const lastShipDate = recentShipments?.[0]?.ship_date || null;

      return NextResponse.json({
        code, totalSales, lastShipDate, changeRate: Math.round(changeRate * 10) / 10,
        recentHalf: recentQtr, prevHalf: prevQtr,
        recentShipments: recentShipments || [],
        itemStats: itemStats || [],
      });
    }

    // ── 다수 거래처 요약 통계 (목록용) ──
    // 전체 거래처 코드를 페이지네이션으로 가져오기
    const codes: string[] = [];
    let detailFrom = 0;
    while (true) {
      let q = supabase.from('client_details').select('client_code');
      if (clientType) q = q.eq('client_type', clientType);
      const { data: batch } = await q.range(detailFrom, detailFrom + 999);
      if (!batch || batch.length === 0) break;
      for (const c of batch) codes.push(c.client_code);
      if (batch.length < 1000) break;
      detailFrom += 1000;
    }

    if (codes.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    const stats: Record<string, {
      totalSales: number;
      lastShipDate: string | null;
      orderCount: number;
      recentHalf: number;
      prevHalf: number;
      changeRate: number;
    }> = {};

    // 거래처 코드를 배치로 나눠서 조회, 각 배치 내에서도 전체 행을 페이지네이션
    const codeBatchSize = 100;
    const rowBatchSize = 1000;

    for (let i = 0; i < codes.length; i += codeBatchSize) {
      const batch = codes.slice(i, i + codeBatchSize);
      let from = 0;

      while (true) {
        const { data: shipmentAgg, error: shipErr } = await supabase
          .from(shipmentsTable)
          .select('client_code, total_amount, ship_date')
          .in('client_code', batch)
          .gte('ship_date', twelveStr)
          .range(from, from + rowBatchSize - 1);

        if (shipErr) throw shipErr;
        if (!shipmentAgg || shipmentAgg.length === 0) break;

        for (const s of shipmentAgg) {
          if (!s.client_code) continue;
          if (!stats[s.client_code]) {
            stats[s.client_code] = { totalSales: 0, lastShipDate: null, orderCount: 0, recentHalf: 0, prevHalf: 0, changeRate: 0 };
          }
          const st = stats[s.client_code];
          const amt = s.total_amount || 0;
          st.totalSales += amt;
          st.orderCount += 1;

          const d = s.ship_date?.toString().slice(0, 10) || '';
          if (d >= threeStr) st.recentHalf += amt;
          else if (d >= sixStr) st.prevHalf += amt;

          if (d && (!st.lastShipDate || d > st.lastShipDate)) {
            st.lastShipDate = d;
          }
        }

        if (shipmentAgg.length < rowBatchSize) break;
        from += rowBatchSize;
      }
    }

    // 변동률 계산
    for (const code of Object.keys(stats)) {
      const st = stats[code];
      st.changeRate = st.prevHalf > 0
        ? Math.round((st.recentHalf - st.prevHalf) / st.prevHalf * 1000) / 10
        : (st.recentHalf > 0 ? 100 : 0);
    }

    return NextResponse.json({ stats });
  } catch (err) {
    console.error('GET /api/sales/clients/stats error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
