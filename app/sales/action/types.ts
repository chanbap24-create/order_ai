export interface ActionItem {
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

export interface ReorderNudge {
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

export interface MeetingReminder {
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

export interface StockDepletion {
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

export interface UpsellSuggestion {
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

export interface NewArrivalMatch {
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

export interface SeasonRecommendation {
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

export interface VisitSchedule {
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

export interface ActionSummary {
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

export type ChurnFilter = 'all' | 'critical' | 'high' | 'medium';
export type ReorderFilter = 'all' | 'in_stock' | 'out_of_stock';
export type VisitFilter = 'all' | 'critical' | 'high' | 'medium';

export const EMPTY_SUMMARY: ActionSummary = {
  critical_count: 0,
  high_count: 0,
  medium_count: 0,
  total_clients: 0,
  reorder_high: 0,
  reorder_medium: 0,
  reorder_in_stock: 0,
  reorder_out_of_stock: 0,
  meetings_upcoming: 0,
  stock_alerts: 0,
  upsell_count: 0,
  new_arrivals_count: 0,
  visit_critical: 0,
  visit_total: 0,
  season_name: '',
  season_reco_count: 0,
};
