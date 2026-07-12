import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { resolveManagerScope } from '@/app/lib/authz';

// GET: 거래처 코드 목록에 대한 매출 통계 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const clientType = searchParams.get('type') || 'wine';
    const startParam = searchParams.get('start') || '';
    const endParam = searchParams.get('end') || '';
    // 일반 user 는 본인 manager 로 강제 (타 매니저 매출 통계 조회 방지)
    const scope = await resolveManagerScope(searchParams.get('manager'));
    if (!scope.ok) return scope.res;
    const managerParam = scope.manager;

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

    // 사용자 지정 기간이 있으면 해당 기간으로 필터
    const useCustomRange = !!(startParam && endParam);
    const rangeStartRaw = startParam || twelveStr;
    // 글라스(DL)는 2025-08-01 전산이관 전 출고 제외(매출분석과 동일 기준).
    const rangeStart = clientType === 'glass' && rangeStartRaw < '2025-08-01' ? '2025-08-01' : rangeStartRaw;
    const rangeEnd = endParam || '';

    // 단일 거래처 상세 통계
    if (code) {
      const table = clientType === 'glass' ? 'glass_shipments' : 'shipments';

      // 집계 기간: 사용자 지정 기간이 있으면 그 기간, 없으면 최근 12개월
      // (랭킹 테이블의 totalSales 와 동일한 기준이어야 두 화면 매출이 일치)
      const aggStartRaw = useCustomRange ? rangeStart : twelveStr;
      // 글라스(DL)는 2025-08-01 전산이관 전 출고 제외(매출분석과 동일 기준).
      const aggStart = clientType === 'glass' && aggStartRaw < '2025-08-01' ? '2025-08-01' : aggStartRaw;
      const aggEnd = useCustomRange ? rangeEnd : '';

      // 최근 20건 조회 + 집계 기간 전체 페이지네이션 병렬 시작
      const recentPromise = supabase
        .from(table)
        .select('item_no, item_name, quantity, selling_price, total_amount, ship_date, manager')
        .eq('client_code', code)
        .order('ship_date', { ascending: false })
        .limit(20);

      // 집계 기간 전체 출고 조회 (매출 통계 + 품목별 통계 동시 계산)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allShipments: any[] = [];
      let shipFrom = 0;
      const shipBatch = 1000;
      while (true) {
        let q = supabase
          .from(table)
          .select('item_no, item_name, quantity, unit_price, selling_price, supply_amount, ship_date, manager')
          .eq('client_code', code)
          .gte('ship_date', aggStart);
        if (aggEnd) q = q.lte('ship_date', aggEnd);
        // 단일 거래처 상세는 그 거래처의 '총' 매출(담당 무관) — 와인·글라스 공통.
        //   재배정된 거래처의 예전 담당 출고도 현재 담당 화면에 포함돼 매출이 누락/축소되지 않게.
        const { data, error } = await q
          .order('ship_date', { ascending: true })
          .range(shipFrom, shipFrom + shipBatch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allShipments.push(...data);
        if (data.length < shipBatch) break;
        shipFrom += shipBatch;
      }

      const { data: recentShipments } = await recentPromise;

      let totalSales = 0;
      let recentQtr = 0;   // 최근 3개월
      let prevQtr = 0;     // 이전 3개월 (3~6개월 전)

      // 품목별 집계
      const itemAgg = new Map<string, {
        item_name: string; buy_count: number; total_qty: number;
        total_amount: number; last_ship_date: string; supply_price: number;
      }>();

      for (const s of allShipments) {
        // 매출식을 어드민 매출분석(rev_n)과 통일: 2025-08 이후=supply_amount · 이전=selling_price.
        const amt = (s.ship_date || '') >= '2025-08-01'
          ? (Number(s.supply_amount) || 0)
          : (Number(s.selling_price) || Number(s.supply_amount) || 0);
        totalSales += amt;
        const d = s.ship_date?.toString().slice(0, 10) || '';
        if (d >= threeStr) recentQtr += amt;
        else if (d >= sixStr) prevQtr += amt;

        if (s.item_no) {
          if (!itemAgg.has(s.item_no)) {
            itemAgg.set(s.item_no, {
              item_name: s.item_name || '', buy_count: 0, total_qty: 0,
              total_amount: 0, last_ship_date: '', supply_price: s.selling_price || 0,
            });
          }
          const agg = itemAgg.get(s.item_no)!;
          agg.buy_count += 1;
          agg.total_qty += (s.quantity || 0);
          agg.total_amount += amt;
          if (d > agg.last_ship_date) agg.last_ship_date = d;
          if (!agg.item_name && s.item_name) agg.item_name = s.item_name;
        }
      }

      const itemStats = Array.from(itemAgg.entries())
        .map(([item_no, agg]) => ({
          client_code: code,
          item_no,
          item_name: agg.item_name,
          buy_count: agg.buy_count,
          total_qty: agg.total_qty,
          avg_price: agg.buy_count > 0 ? Math.round(agg.total_amount / agg.total_qty) : null,
          supply_price: agg.supply_price,
          last_ship_date: agg.last_ship_date || null,
        }))
        .sort((a, b) => b.buy_count - a.buy_count);

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
    const isGlass = clientType === 'glass';
    const detailTable = isGlass ? 'glass_clients' : 'client_details';
    let detailFrom = 0;
    while (true) {
      let q = supabase.from(detailTable).select('client_code');
      if (!isGlass && clientType) q = q.eq('client_type', clientType);
      // 현재 담당의 거래처만 — 와인=client_details.manager · 글라스=glass_clients.manager.
      //   담당 재배정 시 그 거래처의 과거 매출도 현재 담당에 귀속(어드민 매출분석과 동일 정책).
      if (managerParam) q = q.eq('manager', managerParam);
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
        let q = supabase
          .from(shipmentsTable)
          .select('client_code, unit_price, selling_price, supply_amount, quantity, ship_date')
          .in('client_code', batch)
          .gte('ship_date', rangeStart);
        if (rangeEnd) q = q.lte('ship_date', rangeEnd);
        // client_code별 총 매출(담당 무관). 코드셋이 이미 현재 담당으로 스코프됨(와인·글라스 공통).
        q = q.order('ship_date', { ascending: true })
          .range(from, from + rowBatchSize - 1);

        const { data: shipmentAgg, error: shipErr } = await q;

        if (shipErr) throw shipErr;
        if (!shipmentAgg || shipmentAgg.length === 0) break;

        for (const s of shipmentAgg) {
          if (!s.client_code) continue;
          if (!stats[s.client_code]) {
            stats[s.client_code] = { totalSales: 0, lastShipDate: null, orderCount: 0, recentHalf: 0, prevHalf: 0, changeRate: 0 };
          }
          const st = stats[s.client_code];
          // 매출식을 어드민 매출분석(rev_n)과 통일: 2025-08 이후=supply_amount · 이전=selling_price(0이면 supply_amount).
          const amt = (s.ship_date || '') >= '2025-08-01'
            ? (Number(s.supply_amount) || 0)
            : (Number(s.selling_price) || Number(s.supply_amount) || 0);
          st.totalSales += amt;
          st.orderCount += 1;

          const d = s.ship_date?.toString().slice(0, 10) || '';
          if (!useCustomRange) {
            if (d >= threeStr) st.recentHalf += amt;
            else if (d >= sixStr) st.prevHalf += amt;
          } else {
            st.recentHalf += amt;
          }

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
