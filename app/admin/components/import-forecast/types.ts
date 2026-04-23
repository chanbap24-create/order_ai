export interface YearDetail {
  year: string;
  qty: number;
  correctedQty: number;
  items: number;
  clients: number;
  qtyPerItem: number;
  qtyPerItemCorrected: number;
}

export interface WineDetail {
  item_code: string;
  item_name: string;
  supply_price: number;
  avg_import_cost: number;
  avg_selling_price: number;
  region: string | null;
  total_qty: number;
  corrected_qty: number;
  stockout_factor: number;
  client_count: number;
  years_sold: number;
  annual_avg: number;
  annual_avg_corrected: number;
}

export interface TopClient {
  client_name: string;
  total_qty: number;
  item_count: number;
  business_type?: string;
}

export interface WineDistribution {
  median: number;
  p25: number;
  p75: number;
  count: number;
}

export interface ChannelStat {
  channel: string;
  qty: number;
  annual_qty: number;
  clients: number;
  wines: number;
  qty_per_wine: number;
  pct: number;
}

export interface ManagerStat {
  manager: string;
  years_active: number;
  avg_annual_qty: number;
  avg_annual_qty_corrected: number;
  avg_items: number;
  qty_per_item_raw: number;
  qty_per_item: number;
  qty_per_item_year1: number | null;
  avg_clients: number;
  min_qty: number;
  max_qty: number;
  wine_distribution: WineDistribution;
  channels?: ChannelStat[];
  year_details?: YearDetail[];
  wine_details?: WineDetail[];
  top_clients?: TopClient[];
}

export interface ExcludedWine {
  item_name: string;
  supply_price: number;
  region: string | null;
}

export interface StockoutInfo {
  correctedWines: number;
  totalWines: number;
  avgFactor: number;
}

export interface BulkDetail {
  date: string;
  client: string;
  wine: string;
  qty: number;
  manager: string;
}

export interface BulkInfo {
  excluded: number;
  qty: number;
  threshold: number;
  details: BulkDetail[];
}

export interface SampleInfo {
  excluded: number;
  qty: number;
}

export interface PriceStats {
  avg: number;
  min: number;
  max: number;
}

export interface LearningCurve {
  ratio: number;
  sampleSize: number;
  details: { name: string; year1: number; mature: number; ratio: number }[];
}

export interface WineShipment {
  date: string;
  client: string;
  qty: number;
  price: number;
  manager: string;
}

export interface TrendData {
  year: string;
  prevYear: string;
  items: Record<string, { cur: number; prev: number; pct: number }>;
}

export type DetailTab = 'wines' | 'years' | 'clients' | 'channels';

export interface BrandListItem {
  name: string;
  abbr: string;
  country: string;
  count: number;
}
