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
  breakdown?: string[]; // 점수 분해(표시용)
  rec_discount?: number; // 권장 할인율(0~1, 출고 기반). 견적 자동입력용
  rec_quantity?: number; // 권장 수량(최빈가에 가장 많이 딸린 수량). 견적 자동입력용
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
  typeShares?: Record<string, number>; // 타입 분포(본인+업장+업태 블렌드) — 비례배분 selection용
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
      type_prices?: { type: string; avg: number; lo?: number; hi?: number }[];
      region_dist?: { label: string; count: number; pct: number }[];
      period_months?: number;
      purchased?: { name: string; region: string; count: number; last: string | null }[];
    };
  };
}
