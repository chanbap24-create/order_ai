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

// ── 시즌 매핑 ──
function getSeasonInfo(month: number): { season: string; types: string[]; grapes: string[] } {
  if (month >= 3 && month <= 5) {
    return { season: '봄', types: ['로제'], grapes: ['Sauvignon Blanc', 'Riesling'] };
  }
  if (month >= 6 && month <= 8) {
    return { season: '여름', types: ['스파클링', '화이트', '로제'], grapes: [] };
  }
  if (month >= 9 && month <= 11) {
    return { season: '가을', types: [], grapes: ['Pinot Noir'] };
  }
  return { season: '겨울', types: [], grapes: ['Syrah', 'Cabernet Sauvignon'] };
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

    // 3. client_details에서 importance + visit_cycle_days + last_visit_date 조회
    const clientCodes = Array.from(clientMap.keys());
    const importanceMap = new Map<string, number | null>();
    const visitCycleMap = new Map<string, number>();
    const lastVisitDateMap = new Map<string, string | null>();

    // manager의 전체 거래처 목록도 가져온다 (shipments 없는 거래처 포함 → visit_schedules용)
    const allClientDetails: { client_code: string; client_name: string; importance: number | null; visit_cycle_days: number; last_visit_date: string | null }[] = [];
    {
      const { data: allDetails } = await supabase
        .from('client_details')
        .select('client_code, client_name, importance, visit_cycle_days, last_visit_date')
        .eq('manager', manager);
      for (const d of allDetails || []) {
        allClientDetails.push({
          client_code: d.client_code,
          client_name: d.client_name || d.client_code,
          importance: d.importance,
          visit_cycle_days: d.visit_cycle_days || 30,
          last_visit_date: d.last_visit_date || null,
        });
        importanceMap.set(d.client_code, d.importance);
        visitCycleMap.set(d.client_code, d.visit_cycle_days || 30);
        lastVisitDateMap.set(d.client_code, d.last_visit_date || null);
      }
    }

    // shipments에는 있지만 client_details에는 없는 거래처도 importance 조회
    const missingCodes = clientCodes.filter(c => !importanceMap.has(c));
    for (let i = 0; i < missingCodes.length; i += 500) {
      const batch = missingCodes.slice(i, i + 500);
      const { data: detailData } = await supabase
        .from('client_details')
        .select('client_code, importance, visit_cycle_days, last_visit_date')
        .in('client_code', batch);
      for (const d of detailData || []) {
        importanceMap.set(d.client_code, d.importance);
        visitCycleMap.set(d.client_code, d.visit_cycle_days || 30);
        lastVisitDateMap.set(d.client_code, d.last_visit_date || null);
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
        .select('id, client_code, meeting_date, meeting_time, meeting_type, purpose, ai_briefing, status, manager, client_details(client_name, importance, manager)')
        .eq('status', 'planned')
        .gte('meeting_date', today)
        .lte('meeting_date', sevenStr)
        .order('meeting_date', { ascending: true });

      for (const m of meetingData || []) {
        const cd = m.client_details as any;
        // manager 필터: 미팅 자체 담당자 또는 거래처 담당자가 일치해야 함
        const meetingManager = (m as any).manager || '';
        const clientManager = cd?.manager || '';
        if (meetingManager && meetingManager !== manager && clientManager !== manager) continue;
        if (!meetingManager && clientManager && clientManager !== manager) continue;

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
        } else if (daysRemaining !== null && daysRemaining < 30) {
          // 소진일 30일 미만만 알림 (threshold 규칙은 표시용으로만 유지)
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

    // ── wines 메타 맵 (upsell + new_arrival 공용) ──
    const wineMetaMap = new Map<string, { country: string; grapes: string[]; wineType: string }>();
    try {
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
    } catch (wineMetaErr) {
      console.error('Wine meta map build error:', wineMetaErr);
    }

    // ── fullInvMap: inventory_cdv 재고+가격 전체 맵 (upsell + season 공유) ──
    const fullInvMap = new Map<string, { item_name: string; supply_price: number; available_stock: number }>();
    try {
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
    } catch (invErr) {
      console.error('fullInvMap build error:', invErr);
    }

    // ── clientPrefs: 거래처별 취향 프로필 (new_arrival + season 공유) ──
    interface ClientPreference {
      countryCount: Map<string, number>;
      grapeCount: Map<string, number>;
      typeCount: Map<string, number>;
      totalAmount: number;
      totalOrders: number;
    }

    const clientPrefs = new Map<string, ClientPreference>();

    for (const s of allShipments) {
      const code = s.client_code;
      if (!code) continue;
      if (!clientPrefs.has(code)) {
        clientPrefs.set(code, {
          countryCount: new Map(),
          grapeCount: new Map(),
          typeCount: new Map(),
          totalAmount: 0,
          totalOrders: 0,
        });
      }
      const pref = clientPrefs.get(code)!;
      pref.totalAmount += (s.total_amount || 0);
      pref.totalOrders += 1;

      if (s.item_no) {
        const meta = wineMetaMap.get(s.item_no);
        if (meta) {
          if (meta.country) {
            pref.countryCount.set(meta.country, (pref.countryCount.get(meta.country) || 0) + 1);
          }
          for (const g of meta.grapes) {
            pref.grapeCount.set(g, (pref.grapeCount.get(g) || 0) + 1);
          }
          if (meta.wineType) {
            pref.typeCount.set(meta.wineType, (pref.typeCount.get(meta.wineType) || 0) + 1);
          }
        } else {
          const grapes = extractGrapesFromName(s.item_name || '');
          for (const g of grapes) {
            pref.grapeCount.set(g, (pref.grapeCount.get(g) || 0) + 1);
          }
          const t = extractTypeFromName(s.item_name || '');
          if (t) {
            pref.typeCount.set(t, (pref.typeCount.get(t) || 0) + 1);
          }
        }
      }
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
        // 거래처별 Top 구매 품목에서 패턴 추출 → 업셀 매칭 (fullInvMap 상위 스코프)
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

    // ═══════════════════════════════════════════
    // 9. 신규 입고 매칭 (New Arrival Match)
    //    새 와인 → 거래처 취향 매칭 Top 5
    // ═══════════════════════════════════════════
    interface NewArrivalMatch {
      type: 'new_arrival_match';
      item_no: string;
      item_name: string;
      country: string;
      wine_type: string;
      grape: string;
      supply_price: number;
      incoming_stock: number;
      available_stock: number;
      matched_clients: {
        client_code: string;
        client_name: string;
        importance: number | null;
        match_score: number;
        match_reasons: string[];
        avg_purchase_price: number;
      }[];
    }

    const newArrivalMatches: NewArrivalMatch[] = [];
    try {
      // 9-A: 신규 와인 목록 조회
      // 1) wines 테이블: status='new' 최대 20건 (최신순)
      const { data: newWines } = await supabase
        .from('wines')
        .select('item_code, item_name_kr, country, grape_varieties, wine_type, supply_price, available_stock')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(20);

      const newWineMap = new Map<string, {
        item_name: string; country: string; grapes: string[];
        wine_type: string; supply_price: number; available_stock: number; incoming_stock: number;
      }>();

      for (const w of newWines || []) {
        const grapes = w.grape_varieties
          ? w.grape_varieties.split(/[,\/]/).map((g: string) => g.trim()).filter(Boolean)
          : extractGrapesFromName(w.item_name_kr || '');
        const wType = w.wine_type || extractTypeFromName(w.item_name_kr || '');
        newWineMap.set(w.item_code, {
          item_name: w.item_name_kr || w.item_code,
          country: w.country || '',
          grapes,
          wine_type: wType,
          supply_price: w.supply_price || 0,
          available_stock: w.available_stock || 0,
          incoming_stock: 0,
        });
      }

      // 2) inventory_cdv에서 incoming_stock > 0 인 품목 추가 (wines에 없는 것만, 최대 20건 채움)
      if (newWineMap.size < 20) {
        const remaining = 20 - newWineMap.size;
        const { data: incomingItems } = await supabase
          .from('inventory_cdv')
          .select('item_no, item_name, supply_price, available_stock, incoming_stock')
          .gt('incoming_stock', 0)
          .limit(remaining + 50); // 여유 확보

        for (const inv of incomingItems || []) {
          if (newWineMap.size >= 20) break;
          if (newWineMap.has(inv.item_no)) {
            // 이미 있으면 incoming_stock만 업데이트
            const existing = newWineMap.get(inv.item_no)!;
            existing.incoming_stock = inv.incoming_stock || 0;
            continue;
          }
          // wines 메타 조회 (wineMetaMap 재사용 가능하면 사용)
          const meta = wineMetaMap.get(inv.item_no);
          const grapes = meta?.grapes || extractGrapesFromName(inv.item_name || '');
          const wType = meta?.wineType || extractTypeFromName(inv.item_name || '');
          newWineMap.set(inv.item_no, {
            item_name: inv.item_name || inv.item_no,
            country: meta?.country || '',
            grapes: Array.isArray(grapes) ? grapes : [],
            wine_type: wType,
            supply_price: inv.supply_price || 0,
            available_stock: inv.available_stock || 0,
            incoming_stock: inv.incoming_stock || 0,
          });
        }
      }

      // incoming_stock 업데이트: newWineMap의 wines 항목에도 inventory_cdv 값 반영
      if (newWineMap.size > 0) {
        const wineItemCodes = Array.from(newWineMap.keys());
        for (let i = 0; i < wineItemCodes.length; i += 500) {
          const batch = wineItemCodes.slice(i, i + 500);
          const { data: invData } = await supabase
            .from('inventory_cdv')
            .select('item_no, incoming_stock, available_stock')
            .in('item_no', batch);
          for (const d of invData || []) {
            const w = newWineMap.get(d.item_no);
            if (w) {
              if (d.incoming_stock > 0) w.incoming_stock = d.incoming_stock;
              if (d.available_stock > 0) w.available_stock = d.available_stock;
            }
          }
        }
      }

      // 9-B: clientPrefs는 상위 스코프에서 이미 구축됨

      // 9-C: 매칭 스코어링 (와인별 × 거래처별)
      for (const [itemNo, wine] of newWineMap) {
        const matchedClients: NewArrivalMatch['matched_clients'] = [];

        for (const [clientCode, pref] of clientPrefs) {
          if (pref.totalOrders < 3) continue; // 최소 3건 이상 거래처만

          let score = 0;
          const reasons: string[] = [];
          const totalOrders = pref.totalOrders;

          // 국가 매칭 (max 30)
          if (wine.country) {
            const countryHits = pref.countryCount.get(wine.country) || 0;
            if (countryHits > 0) {
              const countryScore = 30 * (countryHits / totalOrders);
              score += countryScore;
              reasons.push('같은 국가');
            }
          }

          // 품종 매칭 (max 30)
          if (wine.grapes.length > 0) {
            let grapeHits = 0;
            for (const g of wine.grapes) {
              grapeHits += (pref.grapeCount.get(g) || 0);
            }
            if (grapeHits > 0) {
              const grapeScore = 30 * (grapeHits / totalOrders);
              score += grapeScore;
              reasons.push('같은 품종');
            }
          }

          // 타입 매칭 (max 20)
          if (wine.wine_type) {
            const typeHits = pref.typeCount.get(wine.wine_type) || 0;
            if (typeHits > 0) {
              const typeScore = 20 * (typeHits / totalOrders);
              score += typeScore;
              reasons.push('같은 타입');
            }
          }

          // 가격 적합도 (max 20)
          if (wine.supply_price > 0 && pref.totalAmount > 0 && pref.totalOrders > 0) {
            const avgPrice = pref.totalAmount / pref.totalOrders;
            if (avgPrice > 0) {
              const priceDiffRatio = Math.abs(wine.supply_price - avgPrice) / avgPrice;
              if (priceDiffRatio <= 0.5) {
                const priceScore = 20 * (1 - priceDiffRatio);
                score += priceScore;
                reasons.push('가격대 적합');
              }
            }
          }

          const finalScore = Math.round(score);
          if (finalScore < 20) continue;

          const clientAgg = clientMap.get(clientCode);
          matchedClients.push({
            client_code: clientCode,
            client_name: clientAgg?.client_name || clientCode,
            importance: importanceMap.get(clientCode) ?? null,
            match_score: finalScore,
            match_reasons: reasons,
            avg_purchase_price: pref.totalOrders > 0 ? Math.round(pref.totalAmount / pref.totalOrders) : 0,
          });
        }

        // 상위 5개 거래처 (score 내림차순)
        matchedClients.sort((a, b) => b.match_score - a.match_score);
        matchedClients.splice(5);

        if (matchedClients.length === 0) continue;

        newArrivalMatches.push({
          type: 'new_arrival_match',
          item_no: itemNo,
          item_name: wine.item_name,
          country: wine.country,
          wine_type: wine.wine_type,
          grape: wine.grapes.join(', '),
          supply_price: wine.supply_price,
          incoming_stock: wine.incoming_stock,
          available_stock: wine.available_stock,
          matched_clients: matchedClients,
        });
      }

      // 매칭 클라이언트 수 기준 내림차순
      newArrivalMatches.sort((a, b) => {
        const maxA = a.matched_clients[0]?.match_score || 0;
        const maxB = b.matched_clients[0]?.match_score || 0;
        return maxB - maxA;
      });
      newArrivalMatches.splice(20);
    } catch (arrivalErr) {
      console.error('New arrival match scan error:', arrivalErr);
    }

    // ═══════════════════════════════════════════
    // 10. 스마트 방문 스케줄링 (Visit Schedule)
    //     경과일 + 중요도 기반 방문 우선순위 산출
    // ═══════════════════════════════════════════
    interface VisitSchedule {
      type: 'visit_schedule';
      client_code: string;
      client_name: string;
      importance: number | null;
      visit_urgency: 'critical' | 'high' | 'medium';
      visit_score: number;
      days_since_contact: number;
      last_contact_date: string;
      last_contact_type: string;
      visit_cycle_days: number;
      days_overdue: number;
      suggested_type: 'visit' | 'call';
      top_items: string[];
    }

    const visitSchedules: VisitSchedule[] = [];
    try {
      // 10-A: completed 미팅의 거래처별 최종 meeting_date 조회
      const completedMeetingMap = new Map<string, string>();
      {
        const { data: completedMeetings } = await supabase
          .from('meetings')
          .select('client_code, meeting_date')
          .eq('status', 'completed')
          .order('meeting_date', { ascending: false });
        for (const m of completedMeetings || []) {
          if (!m.client_code) continue;
          const mDate = m.meeting_date?.toString().slice(0, 10) || '';
          if (!completedMeetingMap.has(m.client_code) || mDate > completedMeetingMap.get(m.client_code)!) {
            completedMeetingMap.set(m.client_code, mDate);
          }
        }
      }

      // 10-B: planned 미팅이 있는 거래처 (제외 대상)
      const plannedMeetingClients = new Set<string>();
      {
        const { data: plannedMeetings } = await supabase
          .from('meetings')
          .select('client_code')
          .eq('status', 'planned')
          .gte('meeting_date', today);
        for (const m of plannedMeetings || []) {
          if (m.client_code) plannedMeetingClients.add(m.client_code);
        }
      }

      // 10-C: 거래처별 마지막 접촉일 계산 및 스코어링
      // allClientDetails (manager의 전체 거래처) 순회
      const processedCodes = new Set<string>();

      for (const cd of allClientDetails) {
        const code = cd.client_code;
        if (processedCodes.has(code)) continue;
        processedCodes.add(code);

        // planned 미팅 있으면 제외
        if (plannedMeetingClients.has(code)) continue;

        // 마지막 접촉일 산출: MAX(shipment, meeting_completed, last_visit_date)
        const candidates: { date: string; type: string }[] = [];

        // shipments에서 마지막 출고일
        const clientAgg = clientMap.get(code);
        if (clientAgg) {
          const shipDates = clientAgg.shipments.map(s => s.date).filter(d => d.length > 0).sort();
          if (shipDates.length > 0) {
            candidates.push({ date: shipDates[shipDates.length - 1], type: 'shipment' });
          }
        }

        // completed 미팅
        const meetingDate = completedMeetingMap.get(code);
        if (meetingDate) {
          candidates.push({ date: meetingDate, type: 'meeting' });
        }

        // last_visit_date
        const visitDate = lastVisitDateMap.get(code);
        if (visitDate) {
          candidates.push({ date: visitDate, type: 'visit_record' });
        }

        if (candidates.length === 0) continue;

        // 가장 최근 날짜
        candidates.sort((a, b) => b.date.localeCompare(a.date));
        const lastContactDate = candidates[0].date;
        const lastContactType = candidates[0].type;

        const daysSinceContact = Math.floor((todayMs - new Date(lastContactDate).getTime()) / DAY_MS);
        if (daysSinceContact < 0) continue;

        const visitCycleDays = visitCycleMap.get(code) || 30;
        const daysOverdue = daysSinceContact - visitCycleDays;

        // 방문 우선순위 점수 (0~100)
        // 초과일 비율: min(daysOverdue / visitCycleDays * 40, 40) — max 40
        const overdueScore = daysOverdue > 0 ? Math.min((daysOverdue / visitCycleDays) * 40, 40) : 0;

        // 중요도 가중: importance=1→30, 2→24, 3→15, 4→8, 5→3 — max 30
        const importance = importanceMap.get(code) ?? null;
        let impScore = 0;
        if (importance === 1) impScore = 30;
        else if (importance === 2) impScore = 24;
        else if (importance === 3) impScore = 15;
        else if (importance === 4) impScore = 8;
        else if (importance === 5) impScore = 3;

        // 비활동 보너스: >60일 → +15, >90일 → +30 — max 30
        let inactivityBonus = 0;
        if (daysSinceContact > 90) inactivityBonus = 30;
        else if (daysSinceContact > 60) inactivityBonus = 15;

        const visitScore = Math.round(overdueScore + impScore + inactivityBonus);

        if (visitScore < 30) continue;

        // visit_urgency
        let visitUrgency: 'critical' | 'high' | 'medium';
        if (visitScore >= 70) visitUrgency = 'critical';
        else if (visitScore >= 50) visitUrgency = 'high';
        else visitUrgency = 'medium';

        // 추천 방문 유형
        let suggestedType: 'visit' | 'call' = 'call';
        if (importance !== null && importance <= 2) {
          suggestedType = 'visit';
        } else if (daysOverdue >= 30) {
          suggestedType = 'visit';
        } else if (daysOverdue >= 14) {
          suggestedType = 'visit';
        }
        // daysOverdue < 14 → 'call' (default)

        // top 3 품목
        const topItems: string[] = [];
        if (clientAgg) {
          const sorted = Array.from(clientAgg.items.entries())
            .sort((a, b) => b[1].qty - a[1].qty)
            .slice(0, 3);
          for (const [, v] of sorted) topItems.push(v.name);
        }

        visitSchedules.push({
          type: 'visit_schedule',
          client_code: code,
          client_name: cd.client_name || clientAgg?.client_name || code,
          importance,
          visit_urgency: visitUrgency,
          visit_score: visitScore,
          days_since_contact: daysSinceContact,
          last_contact_date: lastContactDate,
          last_contact_type: lastContactType,
          visit_cycle_days: visitCycleDays,
          days_overdue: daysOverdue,
          suggested_type: suggestedType,
          top_items: topItems,
        });
      }

      // score 내림차순, 최대 30건
      visitSchedules.sort((a, b) => b.visit_score - a.visit_score);
      visitSchedules.splice(30);
    } catch (visitErr) {
      console.error('Visit schedule scan error:', visitErr);
    }

    // ═══════════════════════════════════════════
    // 11. 시즌 선제 추천 (Season Recommendation)
    //     다음달 시즌에 맞는 와인을 거래처별 취향 기반으로 추천
    // ═══════════════════════════════════════════
    interface SeasonRecommendation {
      type: 'season_recommendation';
      season_name: string;
      target_month: number;
      season_change: boolean;
      item_no: string;
      item_name: string;
      country: string;
      wine_type: string;
      grape: string;
      supply_price: number;
      available_stock: number;
      season_fit_score: number;
      matched_clients: {
        client_code: string;
        client_name: string;
        importance: number | null;
        match_score: number;
        match_reasons: string[];
      }[];
    }

    const seasonRecommendations: SeasonRecommendation[] = [];
    let seasonName = '';
    let targetMonth = 0;
    let seasonChange = false;

    try {
      // 11-A: 다음달 시즌 판단
      const currentMonth = now.getMonth() + 1;
      targetMonth = currentMonth === 12 ? 1 : currentMonth + 1;

      const currentSeason = getSeasonInfo(currentMonth);
      const nextSeason = getSeasonInfo(targetMonth);
      seasonName = nextSeason.season;
      seasonChange = currentSeason.season !== nextSeason.season;

      // 11-B: 시즌 적합 와인 선별 (fullInvMap + wineMetaMap 재사용)
      const seasonWines: {
        item_no: string; item_name: string; country: string;
        wine_type: string; grape: string; supply_price: number;
        available_stock: number; season_fit_score: number;
      }[] = [];

      for (const [itemNo, inv] of fullInvMap) {
        const meta = wineMetaMap.get(itemNo);
        const wType = meta?.wineType || extractTypeFromName(inv.item_name);
        const grapes = meta?.grapes || extractGrapesFromName(inv.item_name);
        const country = meta?.country || '';

        let score = 0;

        // 타입 일치: +40
        if (nextSeason.types.length > 0 && wType) {
          const typeMatch = nextSeason.types.some(t =>
            wType === t || t === wType
          );
          if (typeMatch) score += 40;
        }

        // 품종 일치: +30
        if (nextSeason.grapes.length > 0 && grapes.length > 0) {
          const grapeMatch = grapes.some(g =>
            nextSeason.grapes.some(sg => g === sg)
          );
          if (grapeMatch) score += 30;
        }

        if (score < 30) continue;

        seasonWines.push({
          item_no: itemNo,
          item_name: inv.item_name,
          country,
          wine_type: wType,
          grape: grapes.join(', '),
          supply_price: inv.supply_price,
          available_stock: inv.available_stock,
          season_fit_score: score,
        });
      }

      // 시즌 적합도 내림차순, 최대 50개
      seasonWines.sort((a, b) => b.season_fit_score - a.season_fit_score);
      seasonWines.splice(50);

      // 11-C: 거래처별 매칭 (clientPrefs 재사용)
      for (const wine of seasonWines) {
        const matchedClients: SeasonRecommendation['matched_clients'] = [];

        for (const [clientCode, pref] of clientPrefs) {
          if (pref.totalOrders < 3) continue;

          let clientScore = 0;
          const reasons: string[] = [];
          const totalOrders = pref.totalOrders;

          // 국가 매칭 (max 20)
          if (wine.country) {
            const countryHits = pref.countryCount.get(wine.country) || 0;
            if (countryHits > 0) {
              clientScore += Math.min(20 * (countryHits / totalOrders), 20);
              reasons.push('같은 국가');
            }
          }

          // 품종 매칭 (max 20)
          if (wine.grape) {
            const wineGrapes = wine.grape.split(', ').filter(Boolean);
            let grapeHits = 0;
            for (const g of wineGrapes) {
              grapeHits += (pref.grapeCount.get(g) || 0);
            }
            if (grapeHits > 0) {
              clientScore += Math.min(20 * (grapeHits / totalOrders), 20);
              reasons.push('같은 품종');
            }
          }

          // 가격대 적합 (max 10)
          if (wine.supply_price > 0 && pref.totalAmount > 0 && pref.totalOrders > 0) {
            const avgPrice = pref.totalAmount / pref.totalOrders;
            if (avgPrice > 0) {
              const priceDiffRatio = Math.abs(wine.supply_price - avgPrice) / avgPrice;
              if (priceDiffRatio <= 0.5) {
                clientScore += Math.round(10 * (1 - priceDiffRatio));
                reasons.push('가격대 적합');
              }
            }
          }

          if (clientScore < 5) continue;

          // 최종 추천 점수: season_fit + client_match → normalize 0~100
          const totalScore = wine.season_fit_score + clientScore; // max 70 + 50 = 120
          const normalizedScore = Math.round((totalScore / 120) * 100);

          if (normalizedScore < 50) continue;

          const clientAgg = clientMap.get(clientCode);
          matchedClients.push({
            client_code: clientCode,
            client_name: clientAgg?.client_name || clientCode,
            importance: importanceMap.get(clientCode) ?? null,
            match_score: normalizedScore,
            match_reasons: reasons,
          });
        }

        // 상위 5개 거래처
        matchedClients.sort((a, b) => b.match_score - a.match_score);
        matchedClients.splice(5);

        if (matchedClients.length === 0) continue;

        seasonRecommendations.push({
          type: 'season_recommendation',
          season_name: seasonName,
          target_month: targetMonth,
          season_change: seasonChange,
          item_no: wine.item_no,
          item_name: wine.item_name,
          country: wine.country,
          wine_type: wine.wine_type,
          grape: wine.grape,
          supply_price: wine.supply_price,
          available_stock: wine.available_stock,
          season_fit_score: wine.season_fit_score,
          matched_clients: matchedClients,
        });
      }

      // 매칭 점수 기준 내림차순, 최대 20건
      seasonRecommendations.sort((a, b) => {
        const maxA = a.matched_clients[0]?.match_score || 0;
        const maxB = b.matched_clients[0]?.match_score || 0;
        return maxB - maxA;
      });
      seasonRecommendations.splice(20);
    } catch (seasonErr) {
      console.error('Season recommendation scan error:', seasonErr);
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
      new_arrivals_count: newArrivalMatches.length,
      visit_critical: visitSchedules.filter(v => v.visit_urgency === 'critical').length,
      visit_total: visitSchedules.length,
      season_name: seasonName,
      season_reco_count: seasonRecommendations.length,
    };

    return NextResponse.json({
      actions,
      reorder_nudges: combinedNudges,
      meeting_reminders: meetingReminders,
      stock_depletions: stockDepletions,
      upsell_suggestions: upsellSuggestions,
      new_arrival_matches: newArrivalMatches,
      visit_schedules: visitSchedules,
      season_recommendations: seasonRecommendations,
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
