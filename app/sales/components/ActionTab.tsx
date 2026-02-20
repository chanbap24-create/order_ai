'use client';

import { useState, useEffect, useCallback } from 'react';

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

interface ActionSummary {
  critical_count: number;
  high_count: number;
  medium_count: number;
  total_clients: number;
  reorder_high: number;
  reorder_medium: number;
  reorder_in_stock: number;
  reorder_out_of_stock: number;
  meetings_upcoming: number;
  stock_alerts: number;
  upsell_count: number;
  new_arrivals_count: number;
  visit_critical: number;
  visit_total: number;
  season_name: string;
  season_reco_count: number;
}

interface ActionTabProps {
  currentManager: string;
  isAdmin: boolean;
  onCountChange?: (count: number) => void;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#c62828',
  high: '#E65100',
  medium: '#F57F17',
};

const RISK_BG: Record<string, string> = {
  critical: '#FFEBEE',
  high: '#FFF3E0',
  medium: '#FFFDE7',
};

const RISK_LABELS: Record<string, string> = {
  critical: '긴급',
  high: '주의',
  medium: '관찰',
};

const VISIT_URGENCY_COLORS: Record<string, string> = {
  critical: '#4E342E',
  high: '#6D4C41',
  medium: '#8D6E63',
};

const VISIT_URGENCY_BG: Record<string, string> = {
  critical: '#D7CCC8',
  high: '#EFEBE9',
  medium: '#FBF8F6',
};

const VISIT_URGENCY_LABELS: Record<string, string> = {
  critical: '긴급',
  high: '주의',
  medium: '관찰',
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  shipment: '출고',
  meeting: '미팅',
  visit_record: '방문기록',
};

type ChurnFilter = 'all' | 'critical' | 'high' | 'medium';
type ReorderFilter = 'all' | 'in_stock' | 'out_of_stock';
type VisitFilter = 'all' | 'critical' | 'high' | 'medium';

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

function importanceStars(imp: number | null): string {
  if (!imp || imp < 1 || imp > 5) return '';
  return '★'.repeat(6 - imp) + '☆'.repeat(imp - 1);
}

const MEETING_TYPE_LABEL: Record<string, string> = {
  visit: '방문',
  call: '전화',
  email: '이메일',
};

export default function ActionTab({ currentManager, isAdmin, onCountChange }: ActionTabProps) {
  const [managers, setManagers] = useState<string[]>([]);
  const [selectedManager, setSelectedManager] = useState(isAdmin ? '' : currentManager);

  const [actions, setActions] = useState<ActionItem[]>([]);
  const [nudges, setNudges] = useState<ReorderNudge[]>([]);
  const [meetings, setMeetings] = useState<MeetingReminder[]>([]);
  const [stockDepletions, setStockDepletions] = useState<StockDepletion[]>([]);
  const [upsells, setUpsells] = useState<UpsellSuggestion[]>([]);
  const [newArrivals, setNewArrivals] = useState<NewArrivalMatch[]>([]);
  const [visitSchedules, setVisitSchedules] = useState<VisitSchedule[]>([]);
  const [seasonRecos, setSeasonRecos] = useState<SeasonRecommendation[]>([]);
  const [summary, setSummary] = useState<ActionSummary>({
    critical_count: 0, high_count: 0, medium_count: 0, total_clients: 0,
    reorder_high: 0, reorder_medium: 0, reorder_in_stock: 0, reorder_out_of_stock: 0,
    meetings_upcoming: 0, stock_alerts: 0, upsell_count: 0, new_arrivals_count: 0,
    visit_critical: 0, visit_total: 0, season_name: '', season_reco_count: 0,
  });
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [churnFilter, setChurnFilter] = useState<ChurnFilter>('all');
  const [reorderFilter, setReorderFilter] = useState<ReorderFilter>('all');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<Record<string, any[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);
  const [churnCollapsed, setChurnCollapsed] = useState(false);
  const [reorderCollapsed, setReorderCollapsed] = useState(false);
  const [meetingCollapsed, setMeetingCollapsed] = useState(false);
  const [stockCollapsed, setStockCollapsed] = useState(false);
  const [upsellCollapsed, setUpsellCollapsed] = useState(false);
  const [newArrivalCollapsed, setNewArrivalCollapsed] = useState(false);
  const [visitCollapsed, setVisitCollapsed] = useState(false);
  const [seasonCollapsed, setSeasonCollapsed] = useState(false);
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');

  // 담당자 목록 (관리자용)
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch('/api/sales/clients/managers');
        const data = await res.json();
        if (data.managers) setManagers(data.managers);
      } catch { /* ignore */ }
    })();
  }, [isAdmin]);

  const doScan = useCallback(async (mgr: string) => {
    if (!mgr) return;
    setScanning(true);
    try {
      const res = await fetch(`/api/sales/actions?manager=${encodeURIComponent(mgr)}`);
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
      const s = data.summary || {
        critical_count: 0, high_count: 0, medium_count: 0, total_clients: 0,
        reorder_high: 0, reorder_medium: 0, reorder_in_stock: 0, reorder_out_of_stock: 0,
        meetings_upcoming: 0, stock_alerts: 0, upsell_count: 0, new_arrivals_count: 0,
        visit_critical: 0, visit_total: 0, season_name: '', season_reco_count: 0,
      };
      setSummary(s);
      setLastScanned(data.scanned_at || new Date().toISOString());
      // 배지: 이탈(critical+high) + 재주문(in_stock) + 미팅(D-0~D-2) + 재고(out_of_stock)
      const churnBadge = (s.critical_count || 0) + (s.high_count || 0);
      const reorderBadge = (s.reorder_in_stock || 0);
      const meetingBadge = (data.meeting_reminders || []).filter((m: MeetingReminder) => m.days_until <= 2).length;
      const stockBadge = (data.stock_depletions || []).filter((d: StockDepletion) => d.alert_type === 'out_of_stock').length;
      const arrivalBadge = (data.new_arrival_matches || []).length;
      const visitBadge = (data.visit_schedules || []).filter((v: VisitSchedule) => v.visit_urgency === 'critical').length;
      const seasonBadge = (data.season_recommendations || []).length;
      onCountChange?.(churnBadge + reorderBadge + meetingBadge + stockBadge + arrivalBadge + visitBadge + seasonBadge);
    } catch (err) {
      console.error('Action scan failed:', err);
    } finally {
      setScanning(false);
    }
  }, [onCountChange]);

  // 초기 스캔
  useEffect(() => {
    const mgr = isAdmin ? selectedManager : currentManager;
    if (mgr) doScan(mgr);
  }, [isAdmin, selectedManager, currentManager, doScan]);

  // 카드 클릭 → 최근 주문 5건 로드
  const handleCardClick = useCallback(async (clientCode: string) => {
    if (expandedClient === clientCode) {
      setExpandedClient(null);
      return;
    }
    setExpandedClient(clientCode);
    if (recentOrders[clientCode]) return;

    setLoadingOrders(clientCode);
    try {
      const res = await fetch(`/api/sales/clients/stats?code=${encodeURIComponent(clientCode)}`);
      const data = await res.json();
      if (data.recent_shipments) {
        setRecentOrders(prev => ({ ...prev, [clientCode]: data.recent_shipments.slice(0, 5) }));
      }
    } catch { /* ignore */ }
    finally { setLoadingOrders(null); }
  }, [expandedClient, recentOrders]);

  const filteredChurn = churnFilter === 'all' ? actions : actions.filter(a => a.risk_level === churnFilter);
  const filteredNudges = reorderFilter === 'all'
    ? nudges
    : reorderFilter === 'in_stock'
      ? nudges.filter(n => n.stock_status === 'in_stock' || n.stock_status === 'low_stock')
      : nudges.filter(n => n.stock_status === 'out_of_stock' || n.stock_status === 'unknown');

  const filteredVisits = visitFilter === 'all' ? visitSchedules : visitSchedules.filter(v => v.visit_urgency === visitFilter);

  const mgr = isAdmin ? selectedManager : currentManager;
  const churnCount = actions.length;
  const nudgeCount = nudges.length;
  const meetingCount = meetings.length;
  const stockCount = stockDepletions.length;
  const upsellCount = upsells.length;
  const newArrivalCount = newArrivals.length;
  const visitCount = visitSchedules.length;
  const seasonCount = seasonRecos.length;
  const hasAnyData = churnCount > 0 || nudgeCount > 0 || meetingCount > 0 || stockCount > 0 || upsellCount > 0 || newArrivalCount > 0 || visitCount > 0 || seasonCount > 0;

  return (
    <div>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
            오늘의 액션
          </h2>
          {lastScanned && (
            <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>
              마지막 스캔: {new Date(lastScanned).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <select
              value={selectedManager}
              onChange={e => setSelectedManager(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #e0dcd4',
                fontSize: 16,
                background: '#fff',
                color: selectedManager ? '#1a1a2e' : '#999',
                outline: 'none',
              }}
            >
              <option value="">담당자 선택</option>
              {managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <button
            onClick={() => doScan(mgr)}
            disabled={scanning || !mgr}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #e0dcd4',
              background: scanning ? '#f5f5f0' : 'white',
              fontSize: 12,
              fontWeight: 600,
              color: '#666',
              cursor: scanning || !mgr ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {scanning ? '스캔 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* ═══ 요약 카드 2행 ═══ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {[
          { label: '이탈 긴급', count: summary.critical_count, color: '#c62828', bg: '#FFEBEE' },
          { label: '이탈 주의', count: summary.high_count, color: '#E65100', bg: '#FFF3E0' },
          { label: '재주문(재고有)', count: summary.reorder_in_stock, color: '#1565C0', bg: '#E3F2FD' },
          { label: '재주문(품절)', count: summary.reorder_out_of_stock, color: '#9E9E9E', bg: '#F5F5F5' },
        ].map(s => (
          <div key={s.label} style={{
            flex: '1 1 70px',
            background: s.bg,
            borderRadius: 10,
            padding: '10px 8px',
            textAlign: 'center',
            minWidth: 70,
          }}>
            <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap' }}>
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>
              {s.count}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: '미팅 예정', count: summary.meetings_upcoming, color: '#6A1B9A', bg: '#F3E5F5' },
          { label: '재고 부족', count: summary.stock_alerts, color: '#B71C1C', bg: '#FFEBEE' },
          { label: '업셀 추천', count: summary.upsell_count, color: '#2E7D32', bg: '#E8F5E9' },
          { label: '신규 입고', count: summary.new_arrivals_count, color: '#00838F', bg: '#E0F7FA' },
          { label: '방문 추천', count: summary.visit_total, color: '#795548', bg: '#EFEBE9' },
        ].map(s => (
          <div key={s.label} style={{
            flex: '1 1 70px',
            background: s.bg,
            borderRadius: 10,
            padding: '10px 8px',
            textAlign: 'center',
            minWidth: 80,
          }}>
            <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap' }}>
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>
              {s.count}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          flex: '1 1 120px',
          background: '#E8EAF6',
          borderRadius: 10,
          padding: '10px 8px',
          textAlign: 'center',
          minWidth: 120,
        }}>
          <div style={{ fontSize: 10, color: '#283593', fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap' }}>
            시즌 추천 {summary.season_name ? `(${summary.season_name})` : ''}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#283593' }}>
            {summary.season_reco_count}
          </div>
        </div>
      </div>

      {/* 스캔 중 */}
      {scanning && !hasAnyData && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#999',
          fontSize: 14,
        }}>
          거래처를 분석하고 있습니다...
        </div>
      )}

      {/* 담당자 미선택 */}
      {!mgr && isAdmin && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#999',
          fontSize: 14,
        }}>
          담당자를 선택해주세요.
        </div>
      )}

      {/* ═══ 이탈 위험 섹션 ═══ */}
      {mgr && !scanning && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setChurnCollapsed(!churnCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: '1px solid #e8e6e1',
              marginBottom: churnCollapsed ? 0 : 12,
            }}
          >
            <span style={{ fontSize: 12, color: '#999', transition: 'transform 0.2s', transform: churnCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#c62828' }}>
              이탈 위험 거래처
            </span>
            <span style={{
              fontSize: 11,
              color: 'white',
              background: churnCount > 0 ? '#c62828' : '#ccc',
              borderRadius: 99,
              padding: '1px 8px',
              fontWeight: 600,
            }}>
              {churnCount}
            </span>
          </button>

          {!churnCollapsed && (
            <>
              {churnCount > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                  {([
                    { id: 'all' as ChurnFilter, label: '전체', count: churnCount },
                    { id: 'critical' as ChurnFilter, label: '긴급', count: summary.critical_count },
                    { id: 'high' as ChurnFilter, label: '주의', count: summary.high_count },
                    { id: 'medium' as ChurnFilter, label: '관찰', count: summary.medium_count },
                  ]).map(f => (
                    <button
                      key={f.id}
                      onClick={() => setChurnFilter(f.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: churnFilter === f.id ? `1.5px solid ${f.id === 'all' ? '#5A1515' : RISK_COLORS[f.id] || '#5A1515'}` : '1px solid #e0dcd4',
                        background: churnFilter === f.id ? (f.id === 'all' ? '#faf5f5' : RISK_BG[f.id] || '#faf5f5') : 'white',
                        fontSize: 11,
                        fontWeight: churnFilter === f.id ? 600 : 400,
                        color: churnFilter === f.id ? (f.id === 'all' ? '#5A1515' : RISK_COLORS[f.id] || '#5A1515') : '#999',
                        cursor: 'pointer',
                      }}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              )}

              {churnCount === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: 13 }}>
                  이탈 위험 거래처가 없습니다.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredChurn.map(item => {
                  const isExpanded = expandedClient === item.client_code;
                  const orders = recentOrders[item.client_code];
                  return (
                    <div
                      key={item.client_code}
                      onClick={() => handleCardClick(item.client_code)}
                      style={{
                        background: 'white',
                        borderRadius: 12,
                        borderLeft: `4px solid ${RISK_COLORS[item.risk_level]}`,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: RISK_BG[item.risk_level],
                            color: RISK_COLORS[item.risk_level],
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}>
                            {RISK_LABELS[item.risk_level]} {item.risk_score}
                          </span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#1a1a2e',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {item.client_name}
                          </span>
                        </div>
                        {item.importance != null && item.importance >= 1 && item.importance <= 5 && (
                          <span style={{ fontSize: 12, color: '#F59E0B', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>
                            {importanceStars(item.importance)}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
                        마지막 구매: <strong style={{ color: item.days_since_last >= 60 ? '#c62828' : '#333' }}>
                          {item.days_since_last}일 전
                        </strong>
                        <span style={{ color: '#bbb', marginLeft: 6 }}>({item.last_purchase_date})</span>
                      </div>

                      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                        매출 추이: {fmt(item.prev_revenue)} → {fmt(item.recent_revenue)}
                        {item.revenue_change_pct !== 0 && (
                          <span style={{
                            marginLeft: 6,
                            color: item.revenue_change_pct < 0 ? '#c62828' : '#16a34a',
                            fontWeight: 600,
                          }}>
                            ({item.revenue_change_pct > 0 ? '▲' : '▼'} {Math.abs(item.revenue_change_pct)}%)
                          </span>
                        )}
                      </div>

                      {item.risk_factors.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {item.risk_factors.map((f, i) => (
                            <span key={i} style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: '#f5f5f0',
                              color: '#666',
                              fontSize: 11,
                              fontWeight: 500,
                            }}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.top_items.length > 0 && (
                        <div style={{ fontSize: 12, color: '#999' }}>
                          주요 품목: {item.top_items.join(', ')}
                        </div>
                      )}

                      {isExpanded && (
                        <div style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: '1px solid #f0ece4',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                            최근 주문 내역
                          </div>
                          {loadingOrders === item.client_code && (
                            <div style={{ fontSize: 12, color: '#bbb', padding: '8px 0' }}>로딩 중...</div>
                          )}
                          {orders && orders.length === 0 && (
                            <div style={{ fontSize: 12, color: '#bbb', padding: '8px 0' }}>최근 주문 내역이 없습니다.</div>
                          )}
                          {orders && orders.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {orders.map((o: any, idx: number) => (
                                <div key={idx} style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: 12,
                                  color: '#555',
                                  padding: '4px 0',
                                  borderBottom: idx < orders.length - 1 ? '1px solid #f9f7f3' : 'none',
                                }}>
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {o.item_name || o.item_no}
                                  </span>
                                  <span style={{ marginLeft: 8, color: '#999', whiteSpace: 'nowrap' }}>
                                    {o.quantity || '-'}병
                                  </span>
                                  <span style={{ marginLeft: 8, color: '#999', whiteSpace: 'nowrap' }}>
                                    {o.ship_date?.slice(0, 10) || ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 재주문 타이밍 섹션 ═══ */}
      {mgr && !scanning && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setReorderCollapsed(!reorderCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: '1px solid #e8e6e1',
              marginBottom: reorderCollapsed ? 0 : 12,
            }}
          >
            <span style={{ fontSize: 12, color: '#999', transition: 'transform 0.2s', transform: reorderCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1565C0' }}>
              재주문 타이밍
            </span>
            <span style={{
              fontSize: 11,
              color: 'white',
              background: nudgeCount > 0 ? '#1565C0' : '#ccc',
              borderRadius: 99,
              padding: '1px 8px',
              fontWeight: 600,
            }}>
              {nudgeCount}
            </span>
          </button>

          {!reorderCollapsed && (
            <>
              {nudgeCount > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                  {([
                    { id: 'all' as ReorderFilter, label: '전체', count: nudgeCount, activeColor: '#1565C0', activeBg: '#E3F2FD' },
                    { id: 'in_stock' as ReorderFilter, label: '재고有', count: summary.reorder_in_stock, activeColor: '#2E7D32', activeBg: '#E8F5E9' },
                    { id: 'out_of_stock' as ReorderFilter, label: '품절', count: summary.reorder_out_of_stock, activeColor: '#9E9E9E', activeBg: '#F5F5F5' },
                  ]).map(f => (
                    <button
                      key={f.id}
                      onClick={() => setReorderFilter(f.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: reorderFilter === f.id ? `1.5px solid ${f.activeColor}` : '1px solid #e0dcd4',
                        background: reorderFilter === f.id ? f.activeBg : 'white',
                        fontSize: 11,
                        fontWeight: reorderFilter === f.id ? 600 : 400,
                        color: reorderFilter === f.id ? f.activeColor : '#999',
                        cursor: 'pointer',
                      }}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              )}

              {nudgeCount === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: 13 }}>
                  재주문이 필요한 품목이 없습니다.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredNudges.map((nudge, idx) => {
                  const isOos = nudge.stock_status === 'out_of_stock';
                  const isLow = nudge.stock_status === 'low_stock';
                  const stockColor = isOos ? '#9E9E9E' : isLow ? '#E65100' : '#2E7D32';
                  const stockBg = isOos ? '#F5F5F5' : isLow ? '#FFF3E0' : '#E8F5E9';
                  const stockLabel = isOos ? '품절' : isLow ? `재고 ${nudge.available_stock}병` : `재고 ${nudge.available_stock}병`;

                  return (
                    <div
                      key={`${nudge.client_code}-${nudge.item_no}-${idx}`}
                      style={{
                        background: isOos ? '#FAFAFA' : 'white',
                        borderRadius: 12,
                        borderLeft: `4px solid ${isOos ? '#E0E0E0' : nudge.urgency === 'high' ? '#1565C0' : '#64B5F6'}`,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        padding: '14px 16px',
                        opacity: isOos ? 0.65 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: isOos ? '#F5F5F5' : nudge.urgency === 'high' ? '#E3F2FD' : '#F3F8FF',
                            color: isOos ? '#9E9E9E' : nudge.urgency === 'high' ? '#1565C0' : '#64B5F6',
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}>
                            {nudge.urgency === 'high' ? '긴급' : '주의'}
                          </span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: isOos ? '#999' : '#1a1a2e',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {nudge.client_name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: stockBg,
                            color: stockColor,
                            fontSize: 10,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}>
                            {stockLabel}
                          </span>
                          {nudge.importance != null && nudge.importance >= 1 && nudge.importance <= 5 && (
                            <span style={{ fontSize: 12, color: '#F59E0B', whiteSpace: 'nowrap' }}>
                              {importanceStars(nudge.importance)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 500, color: isOos ? '#999' : '#333', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nudge.item_name}
                      </div>

                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        평균 주기: <strong>{nudge.avg_interval_days}일</strong>
                        <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
                        마지막 구매: <strong style={{ color: nudge.days_since_last >= nudge.avg_interval_days * 1.5 ? '#c62828' : '#1565C0' }}>
                          {nudge.days_since_last}일 전
                        </strong>
                        <span style={{ color: '#bbb', marginLeft: 4 }}>({nudge.last_purchase_date})</span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#FFF3E0',
                          color: '#E65100',
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {nudge.overdue_days}일 초과
                        </span>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#f5f5f0',
                          color: '#666',
                          fontSize: 11,
                        }}>
                          {nudge.purchase_count}회 구매 ({nudge.total_qty}병)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 미팅 리마인더 섹션 ═══ */}
      {mgr && !scanning && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setMeetingCollapsed(!meetingCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: '1px solid #e8e6e1',
              marginBottom: meetingCollapsed ? 0 : 12,
            }}
          >
            <span style={{ fontSize: 12, color: '#999', transition: 'transform 0.2s', transform: meetingCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#6A1B9A' }}>
              미팅 리마인더
            </span>
            <span style={{
              fontSize: 11,
              color: 'white',
              background: meetingCount > 0 ? '#6A1B9A' : '#ccc',
              borderRadius: 99,
              padding: '1px 8px',
              fontWeight: 600,
            }}>
              {meetingCount}
            </span>
          </button>

          {!meetingCollapsed && (
            <>
              {meetingCount === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: 13 }}>
                  예정된 미팅이 없습니다.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {meetings.map(m => {
                  const isToday = m.days_until === 0;
                  const isTomorrow = m.days_until === 1;
                  const dLabel = isToday ? 'D-0 오늘' : isTomorrow ? 'D-1 내일' : `D-${m.days_until}`;

                  return (
                    <div
                      key={m.meeting_id}
                      style={{
                        background: isToday ? '#FFF8E1' : 'white',
                        borderRadius: 12,
                        borderLeft: `4px solid ${isToday ? '#c62828' : '#6A1B9A'}`,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        padding: '14px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: isToday ? '#FFEBEE' : isTomorrow ? '#FFF3E0' : '#F3E5F5',
                            color: isToday ? '#c62828' : isTomorrow ? '#E65100' : '#6A1B9A',
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}>
                            {dLabel}
                          </span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#1a1a2e',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {m.client_name}
                          </span>
                        </div>
                        {m.importance != null && m.importance >= 1 && m.importance <= 5 && (
                          <span style={{ fontSize: 12, color: '#F59E0B', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>
                            {importanceStars(m.importance)}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
                        {m.meeting_date} {m.meeting_time ? m.meeting_time : ''}
                        <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
                        <span style={{
                          display: 'inline-block',
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: '#F3E5F5',
                          color: '#6A1B9A',
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {MEETING_TYPE_LABEL[m.meeting_type] || m.meeting_type}
                        </span>
                      </div>

                      {m.purpose && (
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                          {m.purpose}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: m.briefing_ready ? '#E8F5E9' : '#F5F5F5',
                          color: m.briefing_ready ? '#2E7D32' : '#999',
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {m.briefing_ready ? '브리핑 준비완료' : '브리핑 미작성'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 재고 소진 위험 섹션 ═══ */}
      {mgr && !scanning && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setStockCollapsed(!stockCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: '1px solid #e8e6e1',
              marginBottom: stockCollapsed ? 0 : 12,
            }}
          >
            <span style={{ fontSize: 12, color: '#999', transition: 'transform 0.2s', transform: stockCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#B71C1C' }}>
              재고 소진 위험
            </span>
            <span style={{
              fontSize: 11,
              color: 'white',
              background: stockCount > 0 ? '#B71C1C' : '#ccc',
              borderRadius: 99,
              padding: '1px 8px',
              fontWeight: 600,
            }}>
              {stockCount}
            </span>
          </button>

          {!stockCollapsed && (
            <>
              {stockCount === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: 13 }}>
                  재고 소진 위험 품목이 없습니다.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stockDepletions.map((sd, idx) => {
                  const isOos = sd.alert_type === 'out_of_stock';

                  return (
                    <div
                      key={`${sd.item_no}-${idx}`}
                      style={{
                        background: isOos ? '#FAFAFA' : 'white',
                        borderRadius: 12,
                        borderLeft: `4px solid ${isOos ? '#B71C1C' : '#E65100'}`,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        padding: '14px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: isOos ? '#FFEBEE' : '#FFF3E0',
                            color: isOos ? '#B71C1C' : '#E65100',
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}>
                            {isOos ? '품절' : '재고부족'}
                          </span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#1a1a2e',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {sd.item_name}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                        현재 재고: <strong style={{ color: isOos ? '#B71C1C' : '#E65100' }}>{sd.current_stock}병</strong>
                        <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
                        임계치: {sd.threshold}병
                        {sd.days_remaining !== null && (
                          <>
                            <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
                            잔여: <strong style={{ color: sd.days_remaining < 14 ? '#B71C1C' : '#E65100' }}>{sd.days_remaining}일</strong>
                          </>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#f5f5f0',
                          color: '#666',
                          fontSize: 11,
                        }}>
                          12개월 출고: {sd.total_shipped}병
                        </span>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#f5f5f0',
                          color: '#666',
                          fontSize: 11,
                        }}>
                          공급가: {fmt(sd.supply_price)}원
                        </span>
                        {sd.affected_clients.length > 0 && (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: '#FFF3E0',
                            color: '#E65100',
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            영향 거래처 {sd.affected_clients.length}곳
                          </span>
                        )}
                      </div>

                      {sd.affected_clients.length > 0 && (
                        <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                          {sd.affected_clients.map(c => c.client_name).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 업셀 추천 섹션 ═══ */}
      {mgr && !scanning && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setUpsellCollapsed(!upsellCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: '1px solid #e8e6e1',
              marginBottom: upsellCollapsed ? 0 : 12,
            }}
          >
            <span style={{ fontSize: 12, color: '#999', transition: 'transform 0.2s', transform: upsellCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#2E7D32' }}>
              업셀 추천
            </span>
            <span style={{
              fontSize: 11,
              color: 'white',
              background: upsellCount > 0 ? '#2E7D32' : '#ccc',
              borderRadius: 99,
              padding: '1px 8px',
              fontWeight: 600,
            }}>
              {upsellCount}
            </span>
          </button>

          {!upsellCollapsed && (
            <>
              {upsellCount === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: 13 }}>
                  업셀 추천이 없습니다.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upsells.map((u, idx) => (
                  <div
                    key={`${u.client_code}-${u.suggested_item_no}-${idx}`}
                    style={{
                      background: 'white',
                      borderRadius: 12,
                      borderLeft: '4px solid #2E7D32',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#E8F5E9',
                        color: '#2E7D32',
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        업셀
                      </span>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#1a1a2e',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {u.client_name}
                      </span>
                    </div>

                    {/* 현재 → 추천 화살표 */}
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>
                        {u.current_item_name}
                      </span>
                      <span style={{ color: '#2E7D32', fontWeight: 700, fontSize: 14 }}>→</span>
                      <span style={{ fontWeight: 600, color: '#2E7D32', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                        {u.suggested_item_name}
                      </span>
                    </div>

                    {/* 가격 차이 */}
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                      <span style={{ color: '#2E7D32', fontWeight: 600 }}>+{u.price_diff_pct}%</span>
                      <span style={{ marginLeft: 4 }}>
                        ({fmt(u.current_price)}원 → {fmt(u.suggested_price)}원)
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {u.match_reason.split(' · ').map((r, i) => (
                        <span key={i} style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#E8F5E9',
                          color: '#2E7D32',
                          fontSize: 11,
                          fontWeight: 500,
                        }}>
                          {r}
                        </span>
                      ))}
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#f5f5f0',
                        color: '#666',
                        fontSize: 11,
                      }}>
                        재고 {u.available_stock}병
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 신규 입고 매칭 섹션 ═══ */}
      {mgr && !scanning && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setNewArrivalCollapsed(!newArrivalCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: '1px solid #e8e6e1',
              marginBottom: newArrivalCollapsed ? 0 : 12,
            }}
          >
            <span style={{ fontSize: 12, color: '#999', transition: 'transform 0.2s', transform: newArrivalCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#00838F' }}>
              신규 입고 매칭
            </span>
            <span style={{
              fontSize: 11,
              color: 'white',
              background: newArrivalCount > 0 ? '#00838F' : '#ccc',
              borderRadius: 99,
              padding: '1px 8px',
              fontWeight: 600,
            }}>
              {newArrivalCount}
            </span>
          </button>

          {!newArrivalCollapsed && (
            <>
              {newArrivalCount === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: 13 }}>
                  신규 입고 와인이 없습니다.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {newArrivals.map((wine, idx) => (
                  <div
                    key={`${wine.item_no}-${idx}`}
                    style={{
                      background: 'white',
                      borderRadius: 12,
                      borderLeft: '4px solid #00838F',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      padding: '14px 16px',
                    }}
                  >
                    {/* 와인 헤더 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#E0F7FA',
                        color: '#00838F',
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        NEW
                      </span>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#1a1a2e',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {wine.item_name}
                      </span>
                    </div>

                    {/* 와인 메타 정보 */}
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                      {[wine.country, wine.grape, wine.wine_type, wine.supply_price > 0 ? `₩${fmt(wine.supply_price)}` : ''].filter(Boolean).join(' · ')}
                    </div>

                    {/* 재고 정보 */}
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                      재고: <strong style={{ color: '#00838F' }}>{wine.available_stock}병</strong>
                      {wine.incoming_stock > 0 && (
                        <>
                          <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
                          입고예정: <strong style={{ color: '#00838F' }}>{wine.incoming_stock}병</strong>
                        </>
                      )}
                    </div>

                    {/* 추천 거래처 */}
                    {wine.matched_clients.length > 0 && (
                      <div style={{
                        borderTop: '1px solid #f0ece4',
                        paddingTop: 10,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                          추천 거래처
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {wine.matched_clients.map((c, ci) => (
                            <div key={c.client_code} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              color: '#444',
                              padding: '6px 8px',
                              background: ci === 0 ? '#F0FAFB' : '#FAFAFA',
                              borderRadius: 8,
                            }}>
                              <span style={{
                                fontWeight: 700,
                                color: '#00838F',
                                fontSize: 13,
                                minWidth: 18,
                                textAlign: 'center',
                                flexShrink: 0,
                              }}>
                                {ci + 1}.
                              </span>
                              {c.importance != null && c.importance >= 1 && c.importance <= 5 && (
                                <span style={{ fontSize: 11, color: '#F59E0B', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {importanceStars(c.importance)}
                                </span>
                              )}
                              <span style={{
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0,
                              }}>
                                {c.client_name}
                              </span>
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: c.match_score >= 60 ? '#E0F7FA' : '#F5F5F5',
                                color: c.match_score >= 60 ? '#00838F' : '#888',
                                fontSize: 11,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}>
                                {c.match_score}점
                              </span>
                              <span style={{
                                fontSize: 10,
                                color: '#999',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}>
                                {c.match_reasons.join('·')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 방문 추천 섹션 ═══ */}
      {mgr && !scanning && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setVisitCollapsed(!visitCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: '1px solid #e8e6e1',
              marginBottom: visitCollapsed ? 0 : 12,
            }}
          >
            <span style={{ fontSize: 12, color: '#999', transition: 'transform 0.2s', transform: visitCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#795548' }}>
              방문 추천
            </span>
            <span style={{
              fontSize: 11,
              color: 'white',
              background: visitCount > 0 ? '#795548' : '#ccc',
              borderRadius: 99,
              padding: '1px 8px',
              fontWeight: 600,
            }}>
              {visitCount}
            </span>
          </button>

          {!visitCollapsed && (
            <>
              {visitCount > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                  {([
                    { id: 'all' as VisitFilter, label: '전체', count: visitCount },
                    { id: 'critical' as VisitFilter, label: '긴급', count: visitSchedules.filter(v => v.visit_urgency === 'critical').length },
                    { id: 'high' as VisitFilter, label: '주의', count: visitSchedules.filter(v => v.visit_urgency === 'high').length },
                    { id: 'medium' as VisitFilter, label: '관찰', count: visitSchedules.filter(v => v.visit_urgency === 'medium').length },
                  ]).map(f => (
                    <button
                      key={f.id}
                      onClick={() => setVisitFilter(f.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: visitFilter === f.id ? `1.5px solid ${f.id === 'all' ? '#795548' : VISIT_URGENCY_COLORS[f.id] || '#795548'}` : '1px solid #e0dcd4',
                        background: visitFilter === f.id ? (f.id === 'all' ? '#EFEBE9' : VISIT_URGENCY_BG[f.id] || '#EFEBE9') : 'white',
                        fontSize: 11,
                        fontWeight: visitFilter === f.id ? 600 : 400,
                        color: visitFilter === f.id ? (f.id === 'all' ? '#795548' : VISIT_URGENCY_COLORS[f.id] || '#795548') : '#999',
                        cursor: 'pointer',
                      }}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              )}

              {visitCount === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: 13 }}>
                  방문이 필요한 거래처가 없습니다.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredVisits.map(v => (
                  <div
                    key={v.client_code}
                    style={{
                      background: 'white',
                      borderRadius: 12,
                      borderLeft: `4px solid ${VISIT_URGENCY_COLORS[v.visit_urgency] || '#795548'}`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      padding: '14px 16px',
                    }}
                  >
                    {/* 헤더: 긴급도 + 점수 + 중요도 + 거래처명 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: VISIT_URGENCY_BG[v.visit_urgency],
                          color: VISIT_URGENCY_COLORS[v.visit_urgency],
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}>
                          {VISIT_URGENCY_LABELS[v.visit_urgency]} {v.visit_score}
                        </span>
                        {v.importance != null && v.importance >= 1 && v.importance <= 5 && (
                          <span style={{ fontSize: 12, color: '#F59E0B', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {importanceStars(v.importance)}
                          </span>
                        )}
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#1a1a2e',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {v.client_name}
                        </span>
                      </div>
                    </div>

                    {/* 마지막 접촉 */}
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
                      마지막 접촉: <strong style={{ color: v.days_since_contact >= 60 ? '#4E342E' : '#333' }}>
                        {v.days_since_contact}일 전
                      </strong>
                      <span style={{ color: '#bbb', marginLeft: 6 }}>({v.last_contact_date})</span>
                      <span style={{
                        display: 'inline-block',
                        marginLeft: 6,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: '#F5F5F5',
                        color: '#888',
                        fontSize: 10,
                        fontWeight: 500,
                      }}>
                        {CONTACT_TYPE_LABELS[v.last_contact_type] || v.last_contact_type}
                      </span>
                    </div>

                    {/* 방문주기 + 초과일 */}
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                      방문주기: <strong>{v.visit_cycle_days}일</strong>
                      {v.days_overdue > 0 && (
                        <span style={{ marginLeft: 8, color: '#4E342E', fontWeight: 600 }}>
                          → {v.days_overdue}일 초과
                        </span>
                      )}
                    </div>

                    {/* 태그들 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: v.suggested_type === 'visit' ? '#EFEBE9' : '#F3E5F5',
                        color: v.suggested_type === 'visit' ? '#4E342E' : '#6A1B9A',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {v.suggested_type === 'visit' ? '방문 권장' : '전화 권장'}
                      </span>
                      {v.importance !== null && v.importance <= 2 && (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#FFF8E1',
                          color: '#F57F17',
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {v.importance === 1 ? 'VIP' : '주요거래처'}
                        </span>
                      )}
                    </div>

                    {/* 주요 품목 */}
                    {v.top_items.length > 0 && (
                      <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                        주요 품목: {v.top_items.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 시즌 선제 추천 섹션 ═══ */}
      {mgr && !scanning && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setSeasonCollapsed(!seasonCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: '1px solid #e8e6e1',
              marginBottom: seasonCollapsed ? 0 : 12,
            }}
          >
            <span style={{ fontSize: 12, color: '#999', transition: 'transform 0.2s', transform: seasonCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#283593' }}>
              시즌 선제 추천
            </span>
            {summary.season_name && (
              <span style={{ fontSize: 11, color: '#5C6BC0', fontWeight: 500 }}>
                다음달 {summary.season_reco_count > 0 ? seasonRecos[0]?.target_month : ''}월 · {summary.season_name}
                {seasonRecos[0]?.season_change ? ' (시즌 전환)' : ''}
              </span>
            )}
            <span style={{
              fontSize: 11,
              color: 'white',
              background: seasonCount > 0 ? '#283593' : '#ccc',
              borderRadius: 99,
              padding: '1px 8px',
              fontWeight: 600,
              marginLeft: 'auto',
            }}>
              {seasonCount}
            </span>
          </button>

          {!seasonCollapsed && (
            <>
              {seasonCount === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#bbb', fontSize: 13 }}>
                  시즌 추천 와인이 없습니다.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {seasonRecos.slice(0, 20).map((wine, idx) => (
                  <div
                    key={`${wine.item_no}-${idx}`}
                    style={{
                      background: 'white',
                      borderRadius: 12,
                      borderLeft: `4px solid ${wine.season_change ? '#1A237E' : '#283593'}`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      padding: '14px 16px',
                    }}
                  >
                    {/* 와인 헤더 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#E8EAF6',
                        color: '#283593',
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {wine.season_name}
                      </span>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#1a1a2e',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {wine.item_name}
                      </span>
                    </div>

                    {/* 와인 메타 정보 */}
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                      {[wine.country, wine.wine_type, wine.grape, wine.supply_price > 0 ? `₩${fmt(wine.supply_price)}` : '', `재고 ${wine.available_stock}병`].filter(Boolean).join(' · ')}
                    </div>

                    {/* 추천 거래처 */}
                    {wine.matched_clients.length > 0 && (
                      <div style={{
                        borderTop: '1px solid #f0ece4',
                        paddingTop: 10,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                          추천 거래처
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {wine.matched_clients.map((c, ci) => (
                            <div key={c.client_code} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              color: '#444',
                              padding: '6px 8px',
                              background: ci === 0 ? '#EDE7F6' : '#FAFAFA',
                              borderRadius: 8,
                            }}>
                              <span style={{
                                fontWeight: 700,
                                color: '#283593',
                                fontSize: 13,
                                minWidth: 18,
                                textAlign: 'center',
                                flexShrink: 0,
                              }}>
                                {ci + 1}.
                              </span>
                              {c.importance != null && c.importance >= 1 && c.importance <= 5 && (
                                <span style={{ fontSize: 11, color: '#F59E0B', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {importanceStars(c.importance)}
                                </span>
                              )}
                              <span style={{
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0,
                              }}>
                                {c.client_name}
                              </span>
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: c.match_score >= 70 ? '#E8EAF6' : '#F5F5F5',
                                color: c.match_score >= 70 ? '#283593' : '#888',
                                fontSize: 11,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}>
                                {c.match_score}점
                              </span>
                              <span style={{
                                fontSize: 10,
                                color: '#999',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}>
                                {c.match_reasons.join('·')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 모든 데이터 없음 */}
      {!scanning && mgr && !hasAnyData && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#999',
          fontSize: 14,
        }}>
          모든 거래처가 정상 상태입니다.
        </div>
      )}

      {/* spin 애니메이션 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
