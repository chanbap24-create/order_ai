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
  rec_discount?: number; // 권장 할인율(0~1, 가격공식 기반). 견적 자동입력용
  rec_quantity?: number; // 권장 수량(최빈가에 가장 많이 딸린 수량). 견적 자동입력용
  rec_note?: string;     // 비고: 수량 사다리("12병 +5% / 36병 +10%") 등. 견적 note로
  promo?: boolean;       // 프로모션 지정 품목 → 프로모션가 적용(추천되면 항상)
  promoPin?: boolean;    // 무조건 추천(활성) + 거래처 사용 타입 → 타입배분 무관 강제 포함
}

export interface RecommendResult {
  client: {
    code: string;
    name: string;
    importance: number;
    business_type: string;
    manager: string;
    grade?: number; // 거래처 등급 0~4 (추천점수 가중치 기준)
    category?: 'venue' | 'shop' | 'wholesale'; // 업태(업소·호텔/샵/도매)
    riedel?: boolean; // 리델 사용 업장 여부(업소/호텔만 의미, 그 외 undefined)
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
