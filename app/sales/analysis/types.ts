export interface SuggestionItem {
  code: string;
  name: string;
}

export interface SelectedRankClient {
  client_code: string;
  client_name: string;
  importance: number;
  manager: string | null;
  business_type: string | null;
  client_type?: string;
}

export interface ClientRankItem {
  client_code: string;
  client_name: string;
  importance: number;
  manager: string | null;
  business_type: string | null;
}

export interface ClientRankStats {
  totalSales: number;
  lastShipDate: string | null;
  orderCount: number;
  changeRate: number;
}

export interface ClientDetail {
  client_code: string;
  client_name: string;
  client_type: string;
  importance: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  business_type: string | null;
  manager: string | null;
  memo: string | null;
  visit_cycle_days: number;
  last_visit_date: string | null;
  next_visit_date: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export type AnalysisType = "wine" | "glass";

export type ItemStat = {
  item_no: string;
  item_name: string;
  buy_count: number;
  avg_price: number;
};

export type RecentShipment = {
  item_name: string;
  quantity: number;
  total_amount: number;
  ship_date: string;
};

export type DetailStats = {
  totalSales: number;
  lastShipDate: string | null;
  recentShipments: RecentShipment[];
  itemStats: ItemStat[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PreferencesData = {
  priceRanges: any[];
  regions: any[];
  brands: any[];
  grapes: any[];
  tastes: { name: string; count: number; qty: number }[];
};
