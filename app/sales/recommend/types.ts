export interface ClientOption {
  client_code: string;
  client_name: string;
  importance?: number;
  manager?: string;
  business_type?: string;
}

export interface ScoredItem {
  item_no: string;
  item_name: string;
  country: string;
  region?: string;
  grape: string;
  wine_type?: string;
  price: number;
  stock: number;
  score: number;
  tags: string[];
  reason: string;
  buy_count?: number;
  last_order?: string;
  image_url?: string;
  brand?: string;
  vintage?: string;
}

export interface RecommendResult {
  client: {
    code: string;
    name: string;
    importance: number;
    business_type: string;
    manager: string;
  };
  recommendations: ScoredItem[];
  summary: {
    total_items: number;
    avg_price: number;
    last_order_date: string | null;
    top_countries: string[];
    top_grapes: string[];
    top_types: string[];
    top_regions?: string[];
    analysis?: {
      types: string[];
      broad_regions: string[];
      flavors: string[];
      avg_price: number;
      band_pct: number;
      region_dist?: { label: string; count: number; pct: number }[];
    };
  };
}
