export type QuoteItem = {
  id: number;
  item_code: string;
  country: string;
  brand: string;
  region: string;
  image_url: string;
  vintage: string;
  product_name: string;
  english_name: string;
  korean_name: string;
  supply_price: number;
  retail_price: number;
  discount_rate: number;
  discounted_price: number;
  quantity: number;
  note: string;
  tasting_note: string;
  created_at: string;
  updated_at: string;
};

export type WineProfile = {
  item_code: string;
  country: string;
  region: string;
  sub_region: string;
  appellation: string;
  grape_varieties: string;
  wine_type: string;
  body: string;
  sweetness: string;
  tasting_aroma: string;
  tasting_palate: string;
  food_pairing: string;
  description_kr: string;
  description_en: string;
  alcohol: string;
  serving_temp: string;
  aging_potential: string;
  created_at: string;
  updated_at: string;
};

export type QuoteColumnKey =
  | 'item_code'
  | 'country'
  | 'brand'
  | 'region'
  | 'image_url'
  | 'vintage'
  | 'product_name'
  | 'english_name'
  | 'korean_name'
  | 'supply_price'
  | 'retail_price'
  | 'discount_rate'
  | 'discounted_price'
  | 'quantity'
  | 'normal_total'
  | 'discount_total'
  | 'note'
  | 'tasting_note'
  | 'grape_varieties'
  | 'description_kr';

export type QuoteColumnConfig = {
  key: QuoteColumnKey;
  label: string;
  editable?: boolean;
  type?: 'text' | 'number' | 'percent' | 'currency' | 'computed';
};
