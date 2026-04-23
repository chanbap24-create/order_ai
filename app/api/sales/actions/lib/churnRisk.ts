import { DAY_MS } from './constants';
import type { ActionItem, ClientAgg } from './types';

/**
 * 거래처별 이탈 risk_score 산출 (inactivity + revenue decline + freq decline + importance).
 * 30 미만은 필터링. 상위부터 정렬.
 */
export function detectChurnRisks(
  clientMap: Map<string, ClientAgg>,
  importanceMap: Map<string, number | null>,
  todayMs: number,
  threeStr: string,
  sixStr: string,
): ActionItem[] {
  const actions: ActionItem[] = [];

  for (const [clientCode, agg] of clientMap) {
    const dates = agg.shipments.map((s) => s.date).filter((d) => d.length > 0).sort();
    if (dates.length === 0) continue;

    const lastDate = dates[dates.length - 1];
    const firstDate = dates[0];
    const daysSinceLast = Math.floor((todayMs - new Date(lastDate).getTime()) / DAY_MS);

    const totalSpanDays = Math.max(
      Math.floor((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / DAY_MS),
      1,
    );
    const orderCount = dates.length;
    const avgInterval = Math.max(orderCount > 1 ? totalSpanDays / (orderCount - 1) : 30, 30);

    // 비활동 기간 점수 (max 40)
    const overdueRatio = daysSinceLast / avgInterval;
    const inactivityScore = overdueRatio > 1 ? Math.min(overdueRatio * 20, 40) : 0;

    // 매출 감소 점수 (max 30)
    let recentQtr = 0, prevQtr = 0;
    let recentCount = 0, prevCount = 0;
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

    // 주문빈도 감소 점수 (max 20)
    const freqDecline = prevCount > 0 ? (prevCount - recentCount) / Math.max(prevCount, 1) : 0;
    const freqScore = freqDecline > 0 ? Math.min(freqDecline * 20, 20) : 0;

    // 중요도 가중 (max 10)
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
  return actions;
}
