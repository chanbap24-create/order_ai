export interface Meeting {
  id: number;
  client_code: string;
  meeting_date: string;
  meeting_time: string | null;
  meeting_type: string;
  status: string;
  purpose: string | null;
  ai_briefing: unknown;
  client_name: string;
  client_importance: number;
  client_business_type: string;
  client_manager: string;
}

export interface PurchasedItem {
  item_no: string;
  item_name: string;
  buy_count: number;
  last_date: string;
  avg_unit_price: number;
  supply_price: number;
  grade: string;
  country?: string;
  wine_type?: string;
}

export interface Recommendation {
  item_no: string;
  item_name: string;
  score: number;
  tags: string[];
  reason: string;
  price: number;
  stock: number;
  country?: string;
  region?: string;
  grape?: string;
  wine_type?: string;
}

export interface RecentOrder {
  item_name: string;
  ship_date: string;
  quantity: number;
}

export interface BriefingData {
  generated_at: string;
  client_summary: {
    total_purchases: number;
    avg_price: number;
    top_countries: string[];
    top_grapes: string[];
    top_types: string[];
    last_order_date: string | null;
    trend: string;
    yearly_revenue?: number;
    importance?: number | null;
  };
  avg_discount_rate?: number | null;
  purchased_items?: PurchasedItem[];
  recommendations: Recommendation[];
  recent_orders: RecentOrder[];
}

export interface ShipClient {
  client_code: string;
  client_name: string;
  business_type: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  items: {
    item_no: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }[];
}

export interface ShipmentsData {
  clients: ShipClient[];
  totals: { supply: number; tax: number; total: number };
  count: number;
}
