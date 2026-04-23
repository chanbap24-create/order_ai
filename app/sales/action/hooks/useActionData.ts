import { useCallback, useEffect, useState } from "react";
import type {
  ActionItem,
  ActionSummary,
  MeetingReminder,
  NewArrivalMatch,
  ReorderNudge,
  SeasonRecommendation,
  StockDepletion,
  UpsellSuggestion,
  VisitSchedule,
} from "../types";
import { EMPTY_SUMMARY } from "../types";

type Params = {
  currentManager: string;
  isAdmin: boolean;
  onCountChange?: (count: number) => void;
};

/**
 * /api/sales/actions 스캔 결과 + manager 목록 전체 관리.
 * 배지 카운트 계산도 여기서 수행.
 */
export function useActionData(p: Params) {
  const [managers, setManagers] = useState<string[]>([]);
  const [selectedManager, setSelectedManager] = useState(
    p.isAdmin ? "" : p.currentManager,
  );

  const [actions, setActions] = useState<ActionItem[]>([]);
  const [nudges, setNudges] = useState<ReorderNudge[]>([]);
  const [meetings, setMeetings] = useState<MeetingReminder[]>([]);
  const [stockDepletions, setStockDepletions] = useState<StockDepletion[]>([]);
  const [upsells, setUpsells] = useState<UpsellSuggestion[]>([]);
  const [newArrivals, setNewArrivals] = useState<NewArrivalMatch[]>([]);
  const [visitSchedules, setVisitSchedules] = useState<VisitSchedule[]>([]);
  const [seasonRecos, setSeasonRecos] = useState<SeasonRecommendation[]>([]);
  const [summary, setSummary] = useState<ActionSummary>(EMPTY_SUMMARY);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const { onCountChange, isAdmin, currentManager } = p;

  const doScan = useCallback(
    async (mgr: string) => {
      if (!mgr) return;
      setScanning(true);
      try {
        const res = await fetch(
          `/api/sales/actions?manager=${encodeURIComponent(mgr)}`,
        );
        const data = await res.json();
        if (data.error) {
          console.error(data.error);
          return;
        }
        setActions(data.actions || []);
        setNudges(data.reorder_nudges || []);
        setMeetings(data.meeting_reminders || []);
        setStockDepletions(data.stock_depletions || []);
        setUpsells(data.upsell_suggestions || []);
        setNewArrivals(data.new_arrival_matches || []);
        setVisitSchedules(data.visit_schedules || []);
        setSeasonRecos(data.season_recommendations || []);
        const s: ActionSummary = data.summary || EMPTY_SUMMARY;
        setSummary(s);
        setLastScanned(data.scanned_at || new Date().toISOString());

        // 배지: 이탈(critical+high) + 재주문(in_stock) + 미팅(D-0~D-2)
        //     + 재고(out_of_stock) + 신규입고 + 방문(critical) + 시즌
        const churnBadge = (s.critical_count || 0) + (s.high_count || 0);
        const reorderBadge = s.reorder_in_stock || 0;
        const meetingBadge = (data.meeting_reminders || []).filter(
          (m: MeetingReminder) => m.days_until <= 2,
        ).length;
        const stockBadge = (data.stock_depletions || []).filter(
          (d: StockDepletion) => d.alert_type === "out_of_stock",
        ).length;
        const arrivalBadge = (data.new_arrival_matches || []).length;
        const visitBadge = (data.visit_schedules || []).filter(
          (v: VisitSchedule) => v.visit_urgency === "critical",
        ).length;
        const seasonBadge = (data.season_recommendations || []).length;
        onCountChange?.(
          churnBadge +
            reorderBadge +
            meetingBadge +
            stockBadge +
            arrivalBadge +
            visitBadge +
            seasonBadge,
        );
      } catch (err) {
        console.error("Action scan failed:", err);
      } finally {
        setScanning(false);
      }
    },
    [onCountChange],
  );

  // 관리자: manager 목록 로드
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/sales/clients/managers");
        const data = await res.json();
        if (data.managers) setManagers(data.managers);
      } catch {
        // ignore
      }
    })();
  }, [isAdmin]);

  // 초기 + manager 변경 시 자동 스캔
  useEffect(() => {
    const mgr = isAdmin ? selectedManager : currentManager;
    if (mgr) doScan(mgr);
  }, [isAdmin, selectedManager, currentManager, doScan]);

  return {
    managers,
    selectedManager,
    setSelectedManager,
    actions,
    nudges,
    meetings,
    stockDepletions,
    upsells,
    newArrivals,
    visitSchedules,
    seasonRecos,
    summary,
    scanning,
    lastScanned,
    doScan,
  };
}
