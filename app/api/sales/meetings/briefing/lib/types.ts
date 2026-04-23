export interface PurchaseAggEntry {
  count: number;
  lastDate: string;
  totalPrice: number;
  name: string;
}

export interface ClientAnalysis {
  totalPurchases: number;
  purchaseAgg: Record<string, PurchaseAggEntry>;
  avgPrice: number;
  countryCount: Record<string, number>;
  grapeCount: Record<string, number>;
  typeCount: Record<string, number>;
  topCountries: string[];
  topGrapes: string[];
  topTypes: string[];
  lastOrderDate: string | null;
  yearlyRevenue: number;
  trend: 'up' | 'down' | 'stable';
  recentQtr: number;
  prevQtr: number;
}

export interface ScoredItem {
  item_no: string;
  item_name: string;
  score: number;
  tags: string[];
  reason: string;
  price: number;
  stock: number;
  country: string;
  region: string;
  grape: string;
  wine_type: string;
  brand: string;
}
