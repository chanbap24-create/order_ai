import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// ── 가격별 최소 재고 임계치 ──
const DEFAULT_STOCK_RULES = {
  price_300k: 6, price_200k: 12, price_100k: 60,
  price_50k: 120, price_20k: 180, price_under_20k: 300,
};

function minStockForPrice(price: number): number {
  if (price >= 300000) return DEFAULT_STOCK_RULES.price_300k;
  if (price >= 200000) return DEFAULT_STOCK_RULES.price_200k;
  if (price >= 100000) return DEFAULT_STOCK_RULES.price_100k;
  if (price >= 50000) return DEFAULT_STOCK_RULES.price_50k;
  if (price >= 20000) return DEFAULT_STOCK_RULES.price_20k;
  return DEFAULT_STOCK_RULES.price_under_20k;
}

// ── 와인 이름에서 품종/타입 추출 ──
const GRAPE_PATTERNS: { pattern: RegExp; grape: string }[] = [
  { pattern: /카베르네\s?소비뇽|cabernet\s?sauvignon/i, grape: 'Cabernet Sauvignon' },
  { pattern: /소비뇽\s?블랑|sauvignon\s?blanc/i, grape: 'Sauvignon Blanc' },
  { pattern: /피노\s?누아|피노누아|pinot\s?noir/i, grape: 'Pinot Noir' },
  { pattern: /샤르도네|chardonnay/i, grape: 'Chardonnay' },
  { pattern: /메를로|merlot/i, grape: 'Merlot' },
  { pattern: /시라|쉬라즈|syrah|shiraz/i, grape: 'Syrah' },
  { pattern: /리슬링|riesling/i, grape: 'Riesling' },
  { pattern: /말벡|malbec/i, grape: 'Malbec' },
  { pattern: /템프라니요|tempranillo/i, grape: 'Tempranillo' },
  { pattern: /산지오베제|sangiovese/i, grape: 'Sangiovese' },
  { pattern: /네비올로|nebbiolo/i, grape: 'Nebbiolo' },
  { pattern: /그르나슈|그르나쉬|grenache|garnacha/i, grape: 'Grenache' },
  { pattern: /진판델|zinfandel/i, grape: 'Zinfandel' },
];

const TYPE_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /스파클링|sparkling|크레망|cremant|프로세코|prosecco|까바|cava|샴페인|champagne|브륏|brut/i, type: '스파클링' },
  { pattern: /로제|rosé|rose/i, type: '로제' },
  { pattern: /소비뇽\s?블랑|샤르도네|리슬링|비오니에|피노\s?그리|모스카토|블랑|bianco|blanc|white|화이트/i, type: '화이트' },
  { pattern: /카베르네|피노\s?누아|메를로|시라|쉬라즈|말벡|산지오베제|네비올로|그르나슈|진판델|루쥬|rosso|rouge|레드|tinto/i, type: '레드' },
];

function extractGrapesFromName(name: string): string[] {
  if (!name) return [];
  const grapes: string[] = [];
  for (const { pattern, grape } of GRAPE_PATTERNS) {
    if (pattern.test(name)) grapes.push(grape);
  }
  return grapes;
}

function extractTypeFromName(name: string): string {
  if (!name) return '';
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(name)) return type;
  }
  return '';
}

// ── GET: 이탈 위험 + 재주문 + 미팅 + 재고소진 + 업셀 스캔 ──
// ?manager=XXX
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const manager = searchParams.get('manager');
    if (!manager) {
      return NextResponse.json({ error: '담당자를 선택해주세요.' }, { status: 400 });
    }

    // 기준 날짜 계산
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayMs = new Date(today).getTime();
    const DAY_MS = 1000 * 60 * 60 * 24;
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const threeStr = threeMonthsAgo.toISOString().slice(0, 10);
    const sixStr = sixMonthsAgo.toISOString().slice(0, 10);
    const twelveStr = twelveMonthsAgo.toISOString().slice(0, 10);

    // 1. 최근 12개월 shipments 전체 조회 (페이지네이션)
    const allShipments: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('shipments')
        .select('client_code, client_name, item_no, item_name, quantity, total_amount, ship_date')
        .eq('manager', manager)
        .gte('ship_date', twelveStr)
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allShipments.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    // 빈 데이터라도 미팅 리마인더는 조회해야 하므로, shipments 결과와 무관하게 계속 진행
    // (shipments가 없으면 churn/reorder/stock/upsell만 빈 배열)

    // 2. 거래처별 집계 + 거래처×품목별 구매일 집계 (재주문용)
    interface ClientAgg {
      client_name: string;
      shipments: { date: string; amount: number }[];
      items: Map<string, { name: string; qty: number }>;
      total_amount: number;
    }
    const clientMap = new Map<string, ClientAgg>();

    // 거래처×품목 → 구매일 리스트 (재주문 분석용)
    const clientItemDates = new Map<string, { dates: string[]; totalQty: number }>();

    for (const s of allShipments) {
      const code = s.client_code;
      if (!code) continue;
      if (!clientMap.has(code)) {
        clientMap.set(code, {
          client_name: s.client_name || code,
          shipments: [],
          items: new Map(),
          total_amount: 0,
        });
      }
      const agg = clientMap.get(code)!;
      if (!agg.client_name && s.client_name) agg.client_name = s.client_name;
      const date = s.ship_date?.toString().slice(0, 10) || '';
      const amt = s.total_amount || 0;
      agg.shipments.push({ date, amount: amt });
      agg.total_amount += amt;

      if (s.item_no) {
        const existing = agg.items.get(s.item_no);
        if (existing) {
          existing.qty += (s.quantity || 1);
        } else {
          agg.items.set(s.item_no, { name: s.item_name || s.item_no, qty: s.quantity || 1 });
        }

        // 거래처×품목 구매일 집계
        if (date) {
          const key = `${code}||${s.item_no}`;
          if (!clientItemDates.has(key)) {
            clientItemDates.set(key, { dates: [], totalQty: 0 });
          }
          const cid = clientItemDates.get(key)!;
          cid.dates.push(date);
          cid.totalQty += (s.quantity || 1);
        }
      }
    }

    // 3. client_details에서 importance 조회
    const clientCodes = Array.from(clientMap.keys());
    const importanceMap = new Map<string, number | null>();
    for (let i = 0; i < clientCodes.length; i += 500) {
      const batch = clientCodes.slice(i, i + 500);
      const { data: detailData } = await supabase
        .from('client_details')
        .select('client_code, importance')
        .in('client_code', batch);
      for (const d of detailData || []) {
        importanceMap.set(d.client_code, d.importance);
      }
    }

    // ═══════════════════════════════════════════
    // 4. 거래처별 이탈 risk_score 산출
    // ═══════════════════════════════════════════
    interface ActionItem {
      type: 'churn_risk';
      client_code: string;
      client_name: string;
      importance: number | null;
      risk_level: 'critical' | 'high' | 'medium';
      risk_score: number;
      risk_factors: string[];
      days_since_last: number;
      last_purchase_date: string;
      recent_revenue: number;
      prev_revenue: number;
      revenue_change_pct: number;
      top_items: string[];
    }

    const actions: ActionItem[] = [];

    for (const [clientCode, agg] of clientMap) {
      const dates = agg.shipments
        .map(s => s.date)
        .filter(d => d.length > 0)
        .sort();
      if (dates.length === 0) continue;

      const lastDate = dates[dates.length - 1];
      const firstDate = dates[0];
      const daysSinceLast = Math.floor(
        (todayMs - new Date(lastDate).getTime()) / DAY_MS
      );

      const totalSpanDays = Math.max(
        Math.floor((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / DAY_MS),
        1
      );
      const orderCount = dates.length;
      const avgInterval = Math.max(orderCount > 1 ? totalSpanDays / (orderCount - 1) : 30, 30);

      // ─ 비활동 기간 점수 (max 40)
      const overdueRatio = daysSinceLast / avgInterval;
      const inactivityScore = overdueRatio > 1 ? Math.min(overdueRatio * 20, 40) : 0;

      // ─ 매출 감소 점수 (max 30)
      let recentQtr = 0;
      let prevQtr = 0;
      let recentCount = 0;
      let prevCount = 0;
      for (const s of agg.shipments) {
        if (s.date >= threeStr) {
          recentQtr += s.amount;
          recentCount++;
        } else if (s.date >= sixStr) {
          prevQtr += s.amount;
          prevCount++;
        }
      }

      const declineRate = prevQtr > 0 ? (prevQtr - recentQtr) / prevQtr : 0;
      const revenueScore = declineRate > 0 ? Math.min(declineRate * 30, 30) : 0;

      // ─ 주문빈도 감소 점수 (max 20)
      const freqDecline = prevCount > 0 ? (prevCount - recentCount) / Math.max(prevCount, 1) : 0;
      const freqScore = freqDecline > 0 ? Math.min(freqDecline * 20, 20) : 0;

      // ─ 중요도 가중 (max 10)
      const importance = importanceMap.get(clientCode) ?? null;
      let importanceScore = 0;
      if (importance === 1) importanceScore = 10;
      else if (importance === 2) importanceScore = 7;
      else if (importance === 3) importanceScore = 4;
      else if (importance === 4) importanceScore = 1;

      const riskScore = Math.round(inactivityScore + revenueScore + freqScore + importanceScore);

      if (riskScore < 30) continue;

      let riskLevel: 'critical' | 'high' | 'medium';
      if (riskScore >= 70) riskLevel = 'critical';
      else if (riskScore >= 50) riskLevel = 'high';
      else riskLevel = 'medium';

      const factors: string[] = [];
      if (daysSinceLast >= 30) factors.push(`${daysSinceLast}일 미구매`);
      if (declineRate > 0) factors.push(`매출 ${Math.round(declineRate * 100)}% 감소`);
      if (freqDecline > 0) factors.push(`주문빈도 ${Math.round(freqDecline * 100)}% 감소`);
      if (importance === 1) factors.push('VIP');
      else if (importance === 2) factors.push('주요거래처');

      const revChangePct = prevQtr > 0
        ? Math.round(((recentQtr - prevQtr) / prevQtr) * 100)
        : 0;

      const topItems = Array.from(agg.items.entries())
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 3)
        .map(([, v]) => v.name);

      actions.push({
        type: 'churn_risk',
        client_code: clientCode,
        client_name: agg.client_name,
        importance,
        risk_level: riskLevel,
        risk_score: riskScore,
        risk_factors: factors,
        days_since_last: daysSinceLast,
        last_purchase_date: lastDate,
        recent_revenue: recentQtr,
        prev_revenue: prevQtr,
        revenue_change_pct: revChangePct,
        top_items: topItems,
      });
    }

    actions.sort((a, b) => b.risk_score - a.risk_score);

    // ═══════════════════════════════════════════
    // 5. 재주문 알림 (Re-order Nudge)
    //    거래처×품목별 구매 주기 분석 → 초과 시 nudge
    // ═══════════════════════════════════════════
    interface ReorderNudge {
      type: 'reorder_nudge';
      client_code: string;
      client_name: string;
      importance: number | null;
      item_no: string;
      item_name: string;
      avg_interval_days: number;
      days_since_last: number;
      last_purchase_date: string;
      overdue_days: number;
      purchase_count: number;
      total_qty: number;
      urgency: 'high' | 'medium';
      available_stock: number | null;
      stock_status: 'out_of_stock' | 'low_stock' | 'in_stock' | 'unknown';
    }

    const reorderNudges: ReorderNudge[] = [];

    for (const [key, cid] of clientItemDates) {
      // 최소 3회 이상 구매한 품목만 주기 분석 (신뢰도 확보)
      const uniqueDates = [...new Set(cid.dates)].sort();
      if (uniqueDates.length < 3) continue;

      const [clientCode, itemNo] = key.split('||');
      const clientAgg = clientMap.get(clientCode);
      if (!clientAgg) continue;

      // 구매 간격 계산
      const intervals: number[] = [];
      for (let i = 1; i < uniqueDates.length; i++) {
        const diff = Math.floor(
          (new Date(uniqueDates[i]).getTime() - new Date(uniqueDates[i - 1]).getTime()) / DAY_MS
        );
        if (diff > 0) intervals.push(diff);
      }
      if (intervals.length === 0) continue;

      // 첫 구매 ~ 마지막 구매 span이 60일 미만이면 단발성 구매로 간주 → 스킵
      const firstDate = uniqueDates[0];
      const lastDate = uniqueDates[uniqueDates.length - 1];
      const spanDays = Math.floor((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / DAY_MS);
      if (spanDays < 60) continue;

      // 평균 구매 간격
      const rawAvg = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
      const avgInterval = Math.max(rawAvg, 21);

      // 마지막 구매일로부터 경과일
      const daysSinceLast = Math.floor((todayMs - new Date(lastDate).getTime()) / DAY_MS);

      // 주기 x 1.3 초과 시 nudge
      const threshold = Math.round(avgInterval * 1.3);
      if (daysSinceLast <= threshold) continue;

      const overdueDays = daysSinceLast - avgInterval;
      const overdueRatio = daysSinceLast / avgInterval;
      const urgency: 'high' | 'medium' = overdueRatio >= 1.8 ? 'high' : 'medium';

      const itemInfo = clientAgg.items.get(itemNo);
      const importance = importanceMap.get(clientCode) ?? null;

      reorderNudges.push({
        type: 'reorder_nudge',
        client_code: clientCode,
        client_name: clientAgg.client_name,
        importance,
        item_no: itemNo,
        item_name: itemInfo?.name || itemNo,
        avg_interval_days: avgInterval,
        days_since_last: daysSinceLast,
        last_purchase_date: lastDate,
        overdue_days: overdueDays,
        purchase_count: uniqueDates.length,
        total_qty: cid.totalQty,
        urgency,
      });
    }

    // ── 재고 조회: inventory_cdv + inventory_dl 에서 available_stock 가져오기 ──
    const nudgeItemNos = [...new Set(reorderNudges.map(n => n.item_no))];
    const stockMap = new Map<string, number>();

    for (let i = 0; i < nudgeItemNos.length; i += 500) {
      const batch = nudgeItemNos.slice(i, i + 500);
      const { data: cdvData } = await supabase
        .from('inventory_cdv')
        .select('item_no, available_stock')
        .in('item_no', batch);
      for (const d of cdvData || []) {
        stockMap.set(d.item_no, d.available_stock ?? 0);
      }
      // inventory_dl fallback (CDV에 없는 품목만)
      const missingInCdv = batch.filter(no => !stockMap.has(no));
      if (missingInCdv.length > 0) {
        const { data: dlData } = await supabase
          .from('inventory_dl')
          .select('item_no, available_stock')
          .in('item_no', missingInCdv);
        for (const d of dlData || []) {
          stockMap.set(d.item_no, d.available_stock ?? 0);
        }
      }
    }

    // 각 nudge에 재고 정보 부여
    for (const nudge of reorderNudges) {
      const stock = stockMap.get(nudge.item_no);
      if (stock === undefined) {
        nudge.available_stock = null;
        nudge.stock_status = 'unknown';
      } else {
        nudge.available_stock = stock;
        if (stock === 0) nudge.stock_status = 'out_of_stock';
        else if (stock <= 5) nudge.stock_status = 'low_stock';
        else nudge.stock_status = 'in_stock';
      }
    }

    // 재고 있는 것 우선 정렬 → 긴급도 높은 순 → overdue_days 큰 순, 최대 50건
    const stockPriority = { in_stock: 0, low_stock: 1, unknown: 2, out_of_stock: 3 };
    reorderNudges.sort((a, b) => {
      // 1차: 재고 있는 것 우선 (out_of_stock은 뒤로)
      const sp = stockPriority[a.stock_status] - stockPriority[b.stock_status];
      if (sp !== 0) return sp;
      // 2차: 긴급도
      if (a.urgency !== b.urgency) return a.urgency === 'high' ? -1 : 1;
      // 3차: 초과일
      return b.overdue_days - a.overdue_days;
    });

    // summary는 전체 기준, 표시는 상위 50건만
    const reorderAll = reorderNudges.length;

    const reorderInStock = reorderNudges.filter(n => n.stock_status === 'in_stock' || n.stock_status === 'low_stock').length;
    const reorderOutOfStock = reorderNudges.filter(n => n.stock_status === 'out_of_stock').length;

    // 재고 있는 것 상위 50 + 품절 상위 20 = 최대 70건
    const inStockNudges = reorderNudges.filter(n => n.stock_status !== 'out_of_stock').slice(0, 50);
    const oosNudges = reorderNudges.filter(n => n.stock_status === 'out_of_stock').slice(0, 20);
    const combinedNudges = [...inStockNudges, ...oosNudges];

    // ═══════════════════════════════════════════
    // 6. 미팅 리마인더 (Meeting Reminder)
    //    향후 7일 내 planned 미팅
    // ═══════════════════════════════════════════
    interface MeetingReminder {
      type: 'meeting_reminder';
      meeting_id: number;
      client_code: string;
      client_name: string;
      importance: number | null;
      meeting_date: string;
      meeting_time: string | null;
      meeting_type: string;
      purpose: string | null;
      days_until: number;
      briefing_ready: boolean;
    }

    const meetingReminders: MeetingReminder[] = [];
    try {
      const sevenDaysLater = new Date(now);
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      const sevenStr = sevenDaysLater.toISOString().slice(0, 10);

      const { data: meetingData } = await supabase
        .from('meetings')
        .select('id, client_code, meeting_date, meeting_time, meeting_type, purpose, ai_briefing, status, client_details(client_name, importance, manager)')
        .eq('status', 'planned')
        .gte('meeting_date', today)
        .lte('meeting_date', sevenStr)
        .order('meeting_date', { ascending: true });

      for (const m of meetingData || []) {
        const cd = m.client_details as any;
        // manager 필터 후처리
        if (cd?.manager && cd.manager !== manager) continue;

        const mDate = m.meeting_date?.toString().slice(0, 10) || '';
        const daysUntil = Math.max(0, Math.floor((new Date(mDate).getTime() - todayMs) / DAY_MS));

        meetingReminders.push({
          type: 'meeting_reminder',
          meeting_id: m.id,
          client_code: m.client_code || '',
          client_name: cd?.client_name || m.client_code || '',
          importance: cd?.importance ?? null,
          meeting_date: mDate,
          meeting_time: m.meeting_time || null,
          meeting_type: m.meeting_type || 'visit',
          purpose: m.purpose || null,
          days_until: daysUntil,
          briefing_ready: !!m.ai_briefing,
        });
      }
    } catch (meetingErr) {
      console.error('Meeting reminder scan error:', meetingErr);
    }

    // ═══════════════════════════════════════════
    // 7. 재고 소진 위험 (Stock Depletion)
    //    담당자의 거래처가 자주 사는 품목 중 재고 부족
    // ═══════════════════════════════════════════
    interface StockDepletion {
      type: 'stock_depletion';
      item_no: string;
      item_name: string;
      alert_type: 'out_of_stock' | 'low_stock';
      current_stock: number;
      threshold: number;
      supply_price: number;
      days_remaining: number | null;
      affected_clients: { client_name: string; total_qty: number }[];
      total_shipped: number;
    }

    const stockDepletions: StockDepletion[] = [];
    try {
      // 품목별 거래처 집계 (allShipments 재사용)
      const itemClientMap = new Map<string, {
        item_name: string;
        clients: Map<string, { client_name: string; total_qty: number }>;
        total_shipped: number;
      }>();

      for (const s of allShipments) {
        if (!s.item_no) continue;
        if (!itemClientMap.has(s.item_no)) {
          itemClientMap.set(s.item_no, {
            item_name: s.item_name || s.item_no,
            clients: new Map(),
            total_shipped: 0,
          });
        }
        const agg = itemClientMap.get(s.item_no)!;
        agg.total_shipped += (s.quantity || 1);
        const cc = s.client_code || 'unknown';
        const existing = agg.clients.get(cc);
        if (existing) {
          existing.total_qty += (s.quantity || 1);
        } else {
          agg.clients.set(cc, { client_name: s.client_name || cc, total_qty: s.quantity || 1 });
        }
      }

      // dismissed 품목 조회
      const { data: dismissedData } = await supabase
        .from('inventory_alerts')
        .select('item_no')
        .eq('status', 'dismissed');
      const dismissedSet = new Set((dismissedData || []).map(d => d.item_no));

      // inventory_cdv에서 재고 조회
      const allItemNos = Array.from(itemClientMap.keys()).filter(no => !dismissedSet.has(no));
      const invMap = new Map<string, { available_stock: number; supply_price: number; avg_sales_90d: number }>();

      for (let i = 0; i < allItemNos.length; i += 500) {
        const batch = allItemNos.slice(i, i + 500);
        const { data: cdvData } = await supabase
          .from('inventory_cdv')
          .select('item_no, available_stock, supply_price, avg_sales_90d')
          .in('item_no', batch);
        for (const d of cdvData || []) {
          invMap.set(d.item_no, {
            available_stock: d.available_stock ?? 0,
            supply_price: d.supply_price ?? 0,
            avg_sales_90d: d.avg_sales_90d ?? 0,
          });
        }
      }

      for (const itemNo of allItemNos) {
        const inv = invMap.get(itemNo);
        if (!inv) continue;

        const threshold = minStockForPrice(inv.supply_price);
        const stock = inv.available_stock;
        const dailySales = inv.avg_sales_90d / 90;
        const daysRemaining = dailySales > 0 ? Math.round(stock / dailySales) : null;

        let alertType: 'out_of_stock' | 'low_stock' | null = null;
        if (stock <= 0) {
          alertType = 'out_of_stock';
        } else if (stock < threshold || (daysRemaining !== null && daysRemaining < 30)) {
          alertType = 'low_stock';
        }

        if (!alertType) continue;

        const itemAgg = itemClientMap.get(itemNo)!;
        const affectedClients = Array.from(itemAgg.clients.values())
          .sort((a, b) => b.total_qty - a.total_qty)
          .slice(0, 5);

        stockDepletions.push({
          type: 'stock_depletion',
          item_no: itemNo,
          item_name: itemAgg.item_name,
          alert_type: alertType,
          current_stock: stock,
          threshold,
          supply_price: inv.supply_price,
          days_remaining: daysRemaining,
          affected_clients: affectedClients,
          total_shipped: itemAgg.total_shipped,
        });
      }

      // 품절 우선 → 출고량 순 정렬
      stockDepletions.sort((a, b) => {
        if (a.alert_type !== b.alert_type) return a.alert_type === 'out_of_stock' ? -1 : 1;
        return b.total_shipped - a.total_shipped;
      });
      // 최대 30건
      stockDepletions.splice(30);
    } catch (stockErr) {
      console.error('Stock depletion scan error:', stockErr);
    }

    // ═══════════════════════════════════════════
    // 8. 업셀 추천 (Upsell Suggestion)
    //    이탈 위험(critical/high) + 재주문(in_stock) 거래처 대상
    // ═══════════════════════════════════════════
    interface UpsellSuggestion {
      type: 'upsell_suggestion';
      client_code: string;
      client_name: string;
      current_item_name: string;
      current_price: number;
      suggested_item_no: string;
      suggested_item_name: string;
      suggested_price: number;
      price_diff_pct: number;
      match_reason: string;
      available_stock: number;
    }

    const upsellSuggestions: UpsellSuggestion[] = [];
    try {
      // 대상 거래처: 이탈 critical/high + 재주문 in_stock
      const targetClientCodes = new Set<string>();
      for (const a of actions) {
        if (a.risk_level === 'critical' || a.risk_level === 'high') targetClientCodes.add(a.client_code);
      }
      for (const n of combinedNudges) {
        if (n.stock_status === 'in_stock' || n.stock_status === 'low_stock') targetClientCodes.add(n.client_code);
      }

      if (targetClientCodes.size > 0) {
        // wines 테이블에서 country, grape_varieties, wine_type 메타 조회
        const wineMetaMap = new Map<string, { country: string; grapes: string[]; wineType: string }>();
        const allWines: any[] = [];
        let wFrom = 0;
        while (true) {
          const { data: wData } = await supabase
            .from('wines')
            .select('item_code, item_name_kr, country, grape_varieties, wine_type')
            .range(wFrom, wFrom + 999);
          if (!wData || wData.length === 0) break;
          allWines.push(...wData);
          if (wData.length < 1000) break;
          wFrom += 1000;
        }
        for (const w of allWines) {
          const grapes = w.grape_varieties
            ? w.grape_varieties.split(/[,\/]/).map((g: string) => g.trim()).filter(Boolean)
            : extractGrapesFromName(w.item_name_kr || '');
          const wType = w.wine_type || extractTypeFromName(w.item_name_kr || '');
          wineMetaMap.set(w.item_code, { country: w.country || '', grapes, wineType: wType });
        }

        // inventory_cdv 재고+가격 맵 (이미 stockMap 있지만 전체 필요)
        const fullInvMap = new Map<string, { item_name: string; supply_price: number; available_stock: number }>();
        let invFrom = 0;
        while (true) {
          const { data: invData } = await supabase
            .from('inventory_cdv')
            .select('item_no, item_name, supply_price, available_stock')
            .gt('available_stock', 0)
            .range(invFrom, invFrom + 999);
          if (!invData || invData.length === 0) break;
          for (const d of invData) fullInvMap.set(d.item_no, { item_name: d.item_name || d.item_no, supply_price: d.supply_price || 0, available_stock: d.available_stock || 0 });
          if (invData.length < 1000) break;
          invFrom += 1000;
        }

        // 거래처별 Top 구매 품목에서 패턴 추출 → 업셀 매칭
        for (const tCode of targetClientCodes) {
          const clientAgg = clientMap.get(tCode);
          if (!clientAgg) continue;

          // 거래처의 top 5 품목에서 country/grape/type 패턴
          const topItemEntries = Array.from(clientAgg.items.entries())
            .sort((a, b) => b[1].qty - a[1].qty)
            .slice(0, 5);

          const clientCountries = new Set<string>();
          const clientGrapes = new Set<string>();
          const clientTypes = new Set<string>();
          let maxPrice = 0;

          for (const [itemNo, info] of topItemEntries) {
            const meta = wineMetaMap.get(itemNo);
            if (meta) {
              if (meta.country) clientCountries.add(meta.country);
              for (const g of meta.grapes) clientGrapes.add(g);
              if (meta.wineType) clientTypes.add(meta.wineType);
            } else {
              // fallback: 이름 기반 추출
              const grapes = extractGrapesFromName(info.name);
              for (const g of grapes) clientGrapes.add(g);
              const t = extractTypeFromName(info.name);
              if (t) clientTypes.add(t);
            }
            // 현재 품목의 가격 (stockMap or invMap)
            const curInv = fullInvMap.get(itemNo);
            if (curInv && curInv.supply_price > maxPrice) maxPrice = curInv.supply_price;
          }

          if (maxPrice === 0) continue;

          // 같은 country/grape/type 중 supply_price가 20% 이상 높은 와인 검색
          let suggestCount = 0;
          for (const [invItemNo, invInfo] of fullInvMap) {
            if (suggestCount >= 2) break;
            if (clientAgg.items.has(invItemNo)) continue; // 이미 구매 중인 품목 제외

            const priceDiff = ((invInfo.supply_price - maxPrice) / maxPrice) * 100;
            if (priceDiff < 20 || priceDiff > 100) continue; // 20%~100% 비싼 것만

            const meta = wineMetaMap.get(invItemNo);
            if (!meta) continue;

            const reasons: string[] = [];
            if (meta.country && clientCountries.has(meta.country)) reasons.push('같은 국가');
            if (meta.grapes.some(g => clientGrapes.has(g))) reasons.push('같은 품종');
            if (meta.wineType && clientTypes.has(meta.wineType)) reasons.push('같은 타입');

            if (reasons.length === 0) continue;

            upsellSuggestions.push({
              type: 'upsell_suggestion',
              client_code: tCode,
              client_name: clientAgg.client_name,
              current_item_name: topItemEntries[0]?.[1]?.name || '',
              current_price: maxPrice,
              suggested_item_no: invItemNo,
              suggested_item_name: invInfo.item_name,
              suggested_price: invInfo.supply_price,
              price_diff_pct: Math.round(priceDiff),
              match_reason: reasons.join(' · '),
              available_stock: invInfo.available_stock,
            });
            suggestCount++;
          }
        }
        // 최대 20건
        upsellSuggestions.splice(20);
      }
    } catch (upsellErr) {
      console.error('Upsell suggestion scan error:', upsellErr);
    }

    // ═══ 최종 summary ═══
    const summary = {
      critical_count: actions.filter(a => a.risk_level === 'critical').length,
      high_count: actions.filter(a => a.risk_level === 'high').length,
      medium_count: actions.filter(a => a.risk_level === 'medium').length,
      total_clients: clientMap.size,
      reorder_high: reorderNudges.filter(n => n.urgency === 'high').length,
      reorder_medium: reorderNudges.filter(n => n.urgency === 'medium').length,
      reorder_in_stock: reorderInStock,
      reorder_out_of_stock: reorderOutOfStock,
      meetings_upcoming: meetingReminders.length,
      stock_alerts: stockDepletions.filter(s => s.alert_type === 'out_of_stock').length + stockDepletions.filter(s => s.alert_type === 'low_stock').length,
      upsell_count: upsellSuggestions.length,
    };

    return NextResponse.json({
      actions,
      reorder_nudges: combinedNudges,
      meeting_reminders: meetingReminders,
      stock_depletions: stockDepletions,
      upsell_suggestions: upsellSuggestions,
      summary,
      scanned_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Actions GET error:', error);
    return NextResponse.json(
      { error: '액션 스캔 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
