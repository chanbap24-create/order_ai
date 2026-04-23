export interface TypeQty { name: string; qty: number }
export interface CountryRow { name: string; qty: number; amount: number; items: number; avg_price: number; types: TypeQty[] }
export interface RegionRow { name: string; qty: number; amount: number; avg_price: number }
export interface TypeRow { name: string; qty: number; amount: number; avg_price: number }
export interface TopItem { item_no: string; item_name: string; qty: number; amount: number; avg_price: number; country: string; region: string | null; wine_type: string | null }
export interface MonthlyRow { month: string; qty: number }

export interface AnalysisData {
  total_qty: number;
  total_amount: number;
  total_items: number;
  daily_avg: number;
  monthly_avg: number;
  match_rate: { country: number; region: number; type: number };
  countries: CountryRow[];
  regions: Record<string, RegionRow[]>;
  types: TypeRow[];
  top_items: TopItem[];
  monthly: MonthlyRow[];
}

export interface FilterOptions {
  countries: string[];
  regions: Record<string, string[]>;
  sub_regions: Record<string, Record<string, string[]>>;
  types: string[];
  brands: { code: string; name: string }[];
  volumes: string[];
}

export type ViewMode = 'summary' | 'items' | 'trend';
