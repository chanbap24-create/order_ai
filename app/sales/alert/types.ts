export type FilterType = 'all' | 'low_stock' | 'out_of_stock';

export interface ClientDetail {
  client_code: string;
  client_name: string;
  total_qty: number;
  last_date: string;
}

export interface AlertItem {
  item_no: string;
  item_name: string;
  alert_type: 'low_stock' | 'out_of_stock';
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
  auto_restored: number;
  scanned_at: string;
}

export interface AlertCounts {
  total: number;
  low: number;
  out: number;
}
