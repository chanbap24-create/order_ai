export type FilterType = 'all' | 'low_stock' | 'out_of_stock' | 'vintage_change';

export interface NextVintageInfo {
  item_no: string;
  vintage: string;
  available: number;
  bonded: number;
  incoming: number;
}

export interface ClientDetail {
  client_code: string;
  client_name: string;
  total_qty: number;
  last_date: string;
}

export interface AlertItem {
  item_no: string;
  item_name: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'vintage_change';
  /** 품절이지만 후속 빈티지 재고 존재 → vintage_change 로 재분류된 경우의 후속 정보 */
  next_vintage?: NextVintageInfo;
  current_stock: number;
  threshold: number;
  country: string;
  supply_price: number;
  avg_sales_90d: number;
  days_remaining: number | null;
  clients: ClientDetail[];
  total_shipped: number;
}

export interface Alternative {
  item_no: string;
  item_name: string;
  country: string;
  region: string;
  grape: string;
  wine_type: string;
  price: number;
  stock: number;
  match_level: number;
  match_label: string;
  match_reasons: string[];
}

export interface AlertsResponse {
  alerts: AlertItem[];
  total: number;
  out_of_stock_count: number;
  low_stock_count: number;
  vintage_change_count?: number;
  auto_restored: number;
  scanned_at: string;
}

export interface AlertCounts {
  total: number;
  low: number;
  out: number;
  vintage?: number;
}
