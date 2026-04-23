import { supabase } from '@/app/lib/db';
import { DAY_MS } from './constants';
import type { ClientAgg, ClientDetail, VisitSchedule } from './types';

/**
 * 매니저 거래처 대상 방문 우선순위 스케줄링.
 * 경과일 + 중요도 + 비활동 보너스로 score 산출. 30 미만 제외.
 */
export async function detectVisitSchedules(
  allClientDetails: ClientDetail[],
  clientMap: Map<string, ClientAgg>,
  importanceMap: Map<string, number | null>,
  visitCycleMap: Map<string, number>,
  lastVisitDateMap: Map<string, string | null>,
  todayStr: string,
  todayMs: number,
): Promise<VisitSchedule[]> {
  const [completedRes, plannedRes] = await Promise.all([
    supabase
      .from('meetings')
      .select('client_code, meeting_date')
      .eq('status', 'completed')
      .order('meeting_date', { ascending: false }),
    supabase
      .from('meetings')
      .select('client_code')
      .eq('status', 'planned')
      .gte('meeting_date', todayStr),
  ]);

  // completed 미팅 거래처별 최종일
  const completedMeetingMap = new Map<string, string>();
  for (const m of completedRes.data || []) {
    if (!m.client_code) continue;
    const mDate = m.meeting_date?.toString().slice(0, 10) || '';
    if (!completedMeetingMap.has(m.client_code) || mDate > completedMeetingMap.get(m.client_code)!) {
      completedMeetingMap.set(m.client_code, mDate);
    }
  }

  // planned 미팅 있는 거래처는 제외
  const plannedMeetingClients = new Set<string>();
  for (const m of plannedRes.data || []) {
    if (m.client_code) plannedMeetingClients.add(m.client_code);
  }

  const schedules: VisitSchedule[] = [];
  const processedCodes = new Set<string>();

  for (const cd of allClientDetails) {
    const code = cd.client_code;
    if (processedCodes.has(code)) continue;
    processedCodes.add(code);

    if (plannedMeetingClients.has(code)) continue;

    // 마지막 접촉일: MAX(shipment, meeting_completed, last_visit_date)
    const candidates: { date: string; type: string }[] = [];

    const clientAgg = clientMap.get(code);
    if (clientAgg) {
      const shipDates = clientAgg.shipments.map((s) => s.date).filter((d) => d.length > 0).sort();
      if (shipDates.length > 0) {
        candidates.push({ date: shipDates[shipDates.length - 1], type: 'shipment' });
      }
    }

    const meetingDate = completedMeetingMap.get(code);
    if (meetingDate) candidates.push({ date: meetingDate, type: 'meeting' });

    const visitDate = lastVisitDateMap.get(code);
    if (visitDate) candidates.push({ date: visitDate, type: 'visit_record' });

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => b.date.localeCompare(a.date));
    const lastContactDate = candidates[0].date;
    const lastContactType = candidates[0].type;

    const daysSinceContact = Math.floor((todayMs - new Date(lastContactDate).getTime()) / DAY_MS);
    if (daysSinceContact < 0) continue;

    const visitCycleDays = visitCycleMap.get(code) || 30;
    const daysOverdue = daysSinceContact - visitCycleDays;

    // overdue score (max 40)
    const overdueScore = daysOverdue > 0 ? Math.min((daysOverdue / visitCycleDays) * 40, 40) : 0;

    // importance 가중 (max 30)
    const importance = importanceMap.get(code) ?? null;
    let impScore = 0;
    if (importance === 1) impScore = 30;
    else if (importance === 2) impScore = 24;
    else if (importance === 3) impScore = 15;
    else if (importance === 4) impScore = 8;
    else if (importance === 5) impScore = 3;

    // inactivity bonus (max 30)
    let inactivityBonus = 0;
    if (daysSinceContact > 90) inactivityBonus = 30;
    else if (daysSinceContact > 60) inactivityBonus = 15;

    const visitScore = Math.round(overdueScore + impScore + inactivityBonus);
    if (visitScore < 30) continue;

    let visitUrgency: 'critical' | 'high' | 'medium';
    if (visitScore >= 70) visitUrgency = 'critical';
    else if (visitScore >= 50) visitUrgency = 'high';
    else visitUrgency = 'medium';

    // 추천 방문 유형
    let suggestedType: 'visit' | 'call' = 'call';
    if (importance !== null && importance <= 2) suggestedType = 'visit';
    else if (daysOverdue >= 30) suggestedType = 'visit';
    else if (daysOverdue >= 14) suggestedType = 'visit';

    const topItems: string[] = [];
    if (clientAgg) {
      const sorted = Array.from(clientAgg.items.entries())
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 3);
      for (const [, v] of sorted) topItems.push(v.name);
    }

    schedules.push({
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

  schedules.sort((a, b) => b.visit_score - a.visit_score);
  schedules.splice(30);
  return schedules;
}
