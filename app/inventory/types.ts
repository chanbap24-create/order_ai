/** Inventory 페이지 도메인 타입 */

export type WarehouseTab = "CDV" | "DL";

export interface InventoryItem {
  item_no: string;
  item_name: string;
  brand?: string;
  importer?: string;
  volume_ml?: string;
  barcode?: string;
  supply_price: number;
  discount_price: number;
  wholesale_price: number;
  retail_price: number;
  min_price: number;
  total_stock?: number;
  stock_excl_available?: number;
  pending_shipment?: number;
  available_stock: number;
  bonded_warehouse?: number;
  anseong_warehouse?: number;
  incoming_stock: number;
  sales_30days: number;
  avg_sales_90d?: number;
  avg_sales_365d?: number;
  yongma_logistics?: number;
  yongma_reserve?: number;
  yongma_marketing?: number;
  yongma_sales1?: number;
  yongma_sales2?: number;
  gig_warehouse?: number;
  gig_marketing?: number;
  gig_sales1?: number;
  vintage: string;
  alcohol_content: string;
  country: string;
}

export interface QuoteItem {
  id: number;
  item_code: string;
  barcode?: string;
  country: string;
  brand: string;
  region: string;
  image_url: string;
  vintage: string;
  product_name: string;
  english_name: string;
  korean_name: string;
  supply_price: number;
  min_price: number;
  retail_price: number;
  discount_rate: number;
  discounted_price: number;
  quantity: number;
  note: string;
  tasting_note: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type InvColumnKey =
  | "item_no" | "item_name" | "category" | "brand" | "importer" | "volume_ml" | "barcode"
  | "supply_price" | "discount_price" | "wholesale_price" | "retail_price" | "min_price"
  | "total_stock" | "stock_excl_available" | "pending_shipment" | "available_stock"
  | "bonded_warehouse" | "anseong_warehouse" | "incoming_stock"
  | "sales_30days" | "avg_sales_90d" | "avg_sales_365d"
  | "yongma_logistics" | "yongma_reserve" | "yongma_marketing" | "yongma_sales1" | "yongma_sales2"
  | "gig_warehouse" | "gig_marketing" | "gig_sales1"
  | "vintage" | "alcohol_content" | "country";

export interface InvColumnConfig {
  key: InvColumnKey;
  label: string;
  cdvOnly?: boolean;
  dlOnly?: boolean;
}

export type QuoteColumnKey =
  | "item_code" | "category" | "barcode" | "country" | "brand" | "region" | "image_url"
  | "vintage" | "product_name" | "english_name" | "korean_name"
  | "supply_price" | "min_price" | "retail_price" | "discount_rate"
  | "discounted_price" | "retail_discounted_price" | "quantity" | "normal_total" | "discount_total"
  | "min_price_total" | "retail_normal_total" | "retail_discount_total"
  | "note" | "tasting_note" | "grape_varieties";

export interface QuoteColumnConfig {
  key: QuoteColumnKey;
  label: string;
  editable?: boolean;
  type?: "text" | "number" | "percent" | "currency" | "computed";
}

export interface DocSettings {
  companyName: string;
  address: string;
  addressEn: string;
  websiteUrl: string;
  sender: string;
  title: string;
  content1: string;
  content2: string;
  content3: string;
  unit: string;
  representative: string;
  sealText: string;
}

export interface WineProfile {
  grape?: string;
  description?: string;
}

/** 고급 필터의 Range(범위) 필드 단위 */
export interface RangeFilter {
  enabled: boolean;
  min: string;
  max: string;
}

/** 고급 필터의 Select(선택) 필드 단위 */
export interface SelectFilter {
  enabled: boolean;
  value: string;
}

/** 고급 필터 전체 shape (페이지 state 구조 그대로) */
export interface AdvancedFilters {
  stock: RangeFilter;
  sales30: RangeFilter;
  sales90: RangeFilter;
  vintage: RangeFilter;
  supplyPrice: RangeFilter;
  retailPrice: RangeFilter;
  minPrice: RangeFilter;
  category: SelectFilter;
  country: SelectFilter;
}

export const EMPTY_ADVANCED_FILTERS: AdvancedFilters = {
  stock: { enabled: false, min: "", max: "" },
  sales30: { enabled: false, min: "", max: "" },
  sales90: { enabled: false, min: "", max: "" },
  vintage: { enabled: false, min: "", max: "" },
  supplyPrice: { enabled: false, min: "", max: "" },
  retailPrice: { enabled: false, min: "", max: "" },
  minPrice: { enabled: false, min: "", max: "" },
  category: { enabled: false, value: "" },
  country: { enabled: false, value: "" },
};
