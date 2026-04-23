import { DAY_MS } from './constants';
import { fetchStockMap } from './dataLoaders';
import type { ClientAgg, ReorderNudge } from './types';

/**
 * 거래처×품목 구매 주기 분석 → 주기 x 1.3 초과 시 nudge.
 * 최소 3회 구매 + span 60일 이상만 대상 (단발성 제외).
 */
export async function detectReorderNudges(
  clientItemDates: Map<string, { dates: string[]; totalQty: number }>,
  clientMap: Map<string, ClientAgg>,
  importanceMap: Map<string, number | null>,
  todayMs: number,
): Promise<ReorderNudge[]> {
  const nudges: ReorderNudge[] = [];

  for (const [key, cid] of clientItemDates) {
    const uniqueDates = [...new Set(cid.dates)].sort();
    if (uniqueDates.length < 3) continue;

    const [clientCode, itemNo] = key.split('||');
    const clientAgg = clientMap.get(clientCode);
    if (!clientAgg) continue;

    const intervals: number[] = [];
    for (let i = 1; i < uniqueDates.length; i++) {
      const diff = Math.floor(
        (new Date(uniqueDates[i]).getTime() - new Date(uniqueDates[i - 1]).getTime()) / DAY_MS,
      );
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length === 0) continue;

    // 단발성 구매 제외: 첫~마지막 span 60일 미만
    const firstDate = uniqueDates[0];
    const lastDate = uniqueDates[uniqueDates.length - 1];
    const spanDays = Math.floor((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / DAY_MS);
    if (spanDays < 60) continue;

    const rawAvg = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    const avgInterval = Math.max(rawAvg, 21);

    const daysSinceLast = Math.floor((todayMs - new Date(lastDate).getTime()) / DAY_MS);

    // 주기 x 1.3 초과 시 nudge
    const threshold = Math.round(avgInterval * 1.3);
    if (daysSinceLast <= threshold) continue;

    const overdueDays = daysSinceLast - avgInterval;
    const overdueRatio = daysSinceLast / avgInterval;
    const urgency: 'high' | 'medium' = overdueRatio >= 1.8 ? 'high' : 'medium';

    const itemInfo = clientAgg.items.get(itemNo);
    const importance = importanceMap.get(clientCode) ?? null;

    nudges.push({
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
      available_stock: null,
      stock_status: 'unknown',
    });
  }

  // 재고 병렬 조회 (CDV 우선, DL fallback)
  const nudgeItemNos = [...new Set(nudges.map((n) => n.item_no))];
  const stockMap = await fetchStockMap(nudgeItemNos);

  for (const nudge of nudges) {
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

  // 재고 있는 것 우선 → 긴급도 → overdue_days
  const stockPriority = { in_stock: 0, low_stock: 1, unknown: 2, out_of_stock: 3 };
  nudges.sort((a, b) => {
    const sp = stockPriority[a.stock_status] - stockPriority[b.stock_status];
    if (sp !== 0) return sp;
    if (a.urgency !== b.urgency) return a.urgency === 'high' ? -1 : 1;
    return b.overdue_days - a.overdue_days;
  });

  return nudges;
}

/**
 * nudges에서 표시 대상 70건 (in_stock/low_stock 50 + out_of_stock 20).
 */
export function sliceDisplayNudges(nudges: ReorderNudge[]) {
  const inStock = nudges.filter((n) => n.stock_status !== 'out_of_stock').slice(0, 50);
  const oos = nudges.filter((n) => n.stock_status === 'out_of_stock').slice(0, 20);
  return [...inStock, ...oos];
}
