import { supabase } from '@/app/lib/db';

export const DEFAULT_W = {
  REORDER: 35, COUNTRY_MATCH: 5, GRAPE_MATCH: 12, TYPE_MATCH: 8,
  PRICE_FIT: 10, SALES_VELOCITY: 5, SEASONAL: 7, UPSELL: 3,
};

export const DEFAULT_STOCK_RULES = {
  price_300k: 6, price_200k: 12, price_100k: 60,
  price_50k: 120, price_20k: 180, price_under_20k: 300, months_supply: 3,
};

export type Weights = typeof DEFAULT_W;
export type StockRules = typeof DEFAULT_STOCK_RULES;

export async function loadSettings(): Promise<{ W: Weights; SR: StockRules }> {
  const [wRes, sRes] = await Promise.all([
    supabase.from('admin_settings').select('value').eq('key', 'recommend_weights').maybeSingle(),
    supabase.from('admin_settings').select('value').eq('key', 'recommend_stock_rules').maybeSingle(),
  ]);
  const W = wRes.data ? { ...DEFAULT_W, ...JSON.parse(wRes.data.value) } : { ...DEFAULT_W };
  const SR = sRes.data ? { ...DEFAULT_STOCK_RULES, ...JSON.parse(sRes.data.value) } : { ...DEFAULT_STOCK_RULES };
  return { W, SR };
}

export function makeMinStockForPrice(SR: StockRules) {
  return (price: number): number => {
    if (price >= 300000) return SR.price_300k;
    if (price >= 200000) return SR.price_200k;
    if (price >= 100000) return SR.price_100k;
    if (price >= 50000) return SR.price_50k;
    if (price >= 20000) return SR.price_20k;
    return SR.price_under_20k;
  };
}
