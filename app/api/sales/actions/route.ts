import { NextRequest, NextResponse } from 'next/server';
import { resolveManagerScope } from '@/app/lib/authz';
import { DAY_MS } from './lib/constants';
import {
  fetchShipmentsForManager, fetchAllClientDetails, fetchMissingClientDetails,
  createMeetingsPromise, fetchAllWines, fetchInStockInventory,
} from './lib/dataLoaders';
import { buildClientAggregates, buildMetaMaps, buildClientPrefs } from './lib/aggregators';
import { detectChurnRisks } from './lib/churnRisk';
import { detectReorderNudges, sliceDisplayNudges } from './lib/reorderNudge';
import { detectMeetingReminders } from './lib/meetingReminder';
import { detectStockDepletions } from './lib/stockDepletion';
import { detectUpsellSuggestions } from './lib/upsell';
import { detectNewArrivalMatches } from './lib/newArrival';
import { detectVisitSchedules } from './lib/visitSchedule';
import { detectSeasonRecommendations } from './lib/seasonRecommend';
import type { ClientDetail } from './lib/types';

// GET: 이탈 위험 + 재주문 + 미팅 + 재고소진 + 업셀 + 신규입고매칭 + 방문스케줄 + 시즌추천 스캔
// ?manager=XXX
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // 일반 user 는 본인 manager 로 강제 (타 매니저 영업액션 데이터 조회 방지)
    const scope = await resolveManagerScope(searchParams.get('manager'));
    if (!scope.ok) return scope.res;
    const manager = scope.manager || scope.session.manager;

    // 기준 날짜 (KST, UTC+9)
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const today = kstNow.toISOString().slice(0, 10);
    const todayMs = new Date(today).getTime();
    const threeMonthsAgo = new Date(kstNow); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(kstNow); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date(kstNow); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const sevenDaysLater = new Date(kstNow); sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const threeStr = threeMonthsAgo.toISOString().slice(0, 10);
    const sixStr = sixMonthsAgo.toISOString().slice(0, 10);
    const twelveStr = twelveMonthsAgo.toISOString().slice(0, 10);
    const sevenStr = sevenDaysLater.toISOString().slice(0, 10);

    // Phase 1: 독립 조회 병렬 시작 (client_details + meetings + shipments)
    const allDetailsPromise = fetchAllClientDetails(manager);
    const meetingPromise = createMeetingsPromise(today, sevenStr);
    const allShipments = await fetchShipmentsForManager(manager, twelveStr);

    // 2. 거래처 집계 + 거래처×품목 구매일 맵
    const { clientMap, clientItemDates } = buildClientAggregates(allShipments);

    // 3. client_details 병합 (manager 전체 + shipments에만 있는 거래처)
    const allClientDetails: ClientDetail[] = await allDetailsPromise;
    const importanceMap = new Map<string, number | null>();
    const visitCycleMap = new Map<string, number>();
    const lastVisitDateMap = new Map<string, string | null>();
    for (const d of allClientDetails) {
      importanceMap.set(d.client_code, d.importance);
      visitCycleMap.set(d.client_code, d.visit_cycle_days);
      lastVisitDateMap.set(d.client_code, d.last_visit_date);
    }

    const missingCodes = Array.from(clientMap.keys()).filter((c) => !importanceMap.has(c));
    if (missingCodes.length > 0) {
      const extras = await fetchMissingClientDetails(missingCodes);
      for (const d of extras) {
        importanceMap.set(d.client_code, d.importance);
        visitCycleMap.set(d.client_code, d.visit_cycle_days);
        lastVisitDateMap.set(d.client_code, d.last_visit_date);
      }
    }

    // 4. 이탈 위험
    const actions = detectChurnRisks(clientMap, importanceMap, todayMs, threeStr, sixStr);

    // 5. 재주문 알림 (+ 재고 lookup)
    const allNudges = await detectReorderNudges(clientItemDates, clientMap, importanceMap, todayMs);
    const combinedNudges = sliceDisplayNudges(allNudges);

    // 6. 미팅 리마인더
    let meetingReminders: Awaited<ReturnType<typeof detectMeetingReminders>> = [];
    try {
      const { data: meetingData } = await meetingPromise;
      meetingReminders = detectMeetingReminders(meetingData, manager, todayMs);
    } catch (meetingErr) {
      console.error('Meeting reminder scan error:', meetingErr);
    }

    // 7. 재고 소진
    let stockDepletions: Awaited<ReturnType<typeof detectStockDepletions>> = [];
    try {
      stockDepletions = await detectStockDepletions(allShipments);
    } catch (stockErr) {
      console.error('Stock depletion scan error:', stockErr);
    }

    // 8~11: 공용 메타 로드 (wines + inventory)
    let wineMetaMap = new Map<string, Awaited<ReturnType<typeof buildMetaMaps>>['wineMetaMap'] extends Map<string, infer V> ? V : never>();
    let fullInvMap = new Map<string, Awaited<ReturnType<typeof buildMetaMaps>>['fullInvMap'] extends Map<string, infer V> ? V : never>();
    try {
      const [allWines, allInv] = await Promise.all([fetchAllWines(), fetchInStockInventory()]);
      const built = buildMetaMaps(allWines, allInv);
      wineMetaMap = built.wineMetaMap;
      fullInvMap = built.fullInvMap;
    } catch (err) {
      console.error('Wine meta / inventory build error:', err);
    }

    const clientPrefs = buildClientPrefs(allShipments, wineMetaMap);

    // 8. 업셀 추천
    let upsellSuggestions: Awaited<ReturnType<typeof detectUpsellSuggestions>> = [];
    try {
      upsellSuggestions = detectUpsellSuggestions(actions, combinedNudges, clientMap, wineMetaMap, fullInvMap);
    } catch (upsellErr) {
      console.error('Upsell suggestion scan error:', upsellErr);
    }

    // 9. 신규 입고 매칭
    let newArrivalMatches: Awaited<ReturnType<typeof detectNewArrivalMatches>> = [];
    try {
      newArrivalMatches = await detectNewArrivalMatches(clientPrefs, clientMap, importanceMap, wineMetaMap);
    } catch (arrivalErr) {
      console.error('New arrival match scan error:', arrivalErr);
    }

    // 10. 방문 스케줄링
    let visitSchedules: Awaited<ReturnType<typeof detectVisitSchedules>> = [];
    try {
      visitSchedules = await detectVisitSchedules(
        allClientDetails, clientMap, importanceMap,
        visitCycleMap, lastVisitDateMap,
        today, todayMs,
      );
    } catch (visitErr) {
      console.error('Visit schedule scan error:', visitErr);
    }

    // 11. 시즌 선제 추천
    let seasonRecommendations: ReturnType<typeof detectSeasonRecommendations>['recos'] = [];
    let seasonName = '';
    let targetMonth = 0;
    let seasonChange = false;
    try {
      const { recos, seasonName: sn, targetMonth: tm, seasonChange: sc } = detectSeasonRecommendations(
        kstNow.getUTCMonth() + 1,
        clientPrefs, clientMap, importanceMap,
        wineMetaMap, fullInvMap,
      );
      seasonRecommendations = recos;
      seasonName = sn;
      targetMonth = tm;
      seasonChange = sc;
    } catch (seasonErr) {
      console.error('Season recommendation scan error:', seasonErr);
    }

    // 최종 summary
    const summary = {
      critical_count: actions.filter((a) => a.risk_level === 'critical').length,
      high_count: actions.filter((a) => a.risk_level === 'high').length,
      medium_count: actions.filter((a) => a.risk_level === 'medium').length,
      total_clients: clientMap.size,
      reorder_high: allNudges.filter((n) => n.urgency === 'high').length,
      reorder_medium: allNudges.filter((n) => n.urgency === 'medium').length,
      reorder_in_stock: allNudges.filter((n) => n.stock_status === 'in_stock' || n.stock_status === 'low_stock').length,
      reorder_out_of_stock: allNudges.filter((n) => n.stock_status === 'out_of_stock').length,
      meetings_upcoming: meetingReminders.length,
      stock_alerts: stockDepletions.length,
      upsell_count: upsellSuggestions.length,
      new_arrivals_count: newArrivalMatches.length,
      visit_critical: visitSchedules.filter((v) => v.visit_urgency === 'critical').length,
      visit_total: visitSchedules.length,
      season_name: seasonName,
      season_reco_count: seasonRecommendations.length,
    };

    // targetMonth/seasonChange는 summary에 포함되지 않음 (기존 스키마 유지)
    void targetMonth; void seasonChange; void DAY_MS;

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
      { error: '액션 스캔 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
