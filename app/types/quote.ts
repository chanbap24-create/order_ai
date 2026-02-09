export type QuoteItem = {
  id: number;
  item_code: string;
  country: string;
  brand: string;
  region: string;
  image_url: string;
  vintage: string;
  product_name: string;
  supply_price: number;
  discount_rate: number;
  discounted_price: number;
  quantity: number;
  note: string;
  tasting_note: string;
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
  | 'supply_price'
  | 'discount_rate'
  | 'discounted_price'
  | 'quantity'
  | 'normal_total'
  | 'discount_total'
  | 'note'
  | 'tasting_note';

export type QuoteColumnConfig = {
  key: QuoteColumnKey;
  label: string;
  editable?: boolean;
  type?: 'text' | 'number' | 'percent' | 'currency' | 'computed';
};
