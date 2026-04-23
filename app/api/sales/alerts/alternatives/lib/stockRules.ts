import { supabase } from '@/app/lib/db';

export const DEFAULT_STOCK_RULES = {
  price_300k: 6, price_200k: 12, price_100k: 60,
  price_50k: 120, price_20k: 180, price_under_20k: 300,
};

export type StockRules = typeof DEFAULT_STOCK_RULES;

export async function loadStockRules(): Promise<StockRules> {
  const { data } = await supabase
    .from('admin_settings').select('value').eq('key', 'recommend_stock_rules').maybeSingle();
  return data ? { ...DEFAULT_STOCK_RULES, ...JSON.parse(data.value) } : { ...DEFAULT_STOCK_RULES };
}

export function minStockForPrice(price: number, SR: StockRules): number {
  if (price >= 300000) return SR.price_300k;
  if (price >= 200000) return SR.price_200k;
  if (price >= 100000) return SR.price_100k;
  if (price >= 50000) return SR.price_50k;
  if (price >= 20000) return SR.price_20k;
  return SR.price_under_20k;
}
