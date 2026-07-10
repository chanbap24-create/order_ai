// app/lib/pricing/discountConfig.ts
// 업태별 할인율 등급조건(가격공식)을 DB(discount_config)에서 로드/저장. 없으면 기본값.
import { supabase } from '../db';
import { DEFAULT_DISCOUNT_CONFIG, type DiscountConfig, type Tier } from './discountRate';

function isTierArray(v: unknown): v is Tier[] {
  return Array.isArray(v) && v.every((t) => t && typeof (t as Tier).min === 'number' && typeof (t as Tier).add === 'number');
}

/** 저장값이 손상돼도 안전하게 기본값으로 채워 완전한 config 반환. */
function coerce(raw: unknown): DiscountConfig {
  const d = DEFAULT_DISCOUNT_CONFIG;
  const r = (raw || {}) as Partial<DiscountConfig>;
  const v = r.venue || ({} as DiscountConfig['venue']);
  const s = r.shop || ({} as DiscountConfig['shop']);
  const w = r.wholesale || ({} as DiscountConfig['wholesale']);
  const num = (x: unknown, fb: number) => (typeof x === 'number' && Number.isFinite(x) ? x : fb);
  return {
    venue: {
      base: num(v.base, d.venue.base),
      sales: isTierArray(v.sales) ? v.sales : d.venue.sales,
      listing: isTierArray(v.listing) ? v.listing : d.venue.listing,
      riedel: num(v.riedel, d.venue.riedel),
    },
    shop: {
      base: num(s.base, d.shop.base),
      sales: isTierArray(s.sales) ? s.sales : d.shop.sales,
      qty: isTierArray(s.qty) ? s.qty : d.shop.qty,
    },
    wholesale: {
      baseLow: num(w.baseLow, d.wholesale.baseLow),
      baseHigh: num(w.baseHigh, d.wholesale.baseHigh),
      priceThreshold: num(w.priceThreshold, d.wholesale.priceThreshold),
      qty: isTierArray(w.qty) ? w.qty : d.wholesale.qty,
    },
  };
}

export async function getDiscountConfig(corporation = 'CDV'): Promise<DiscountConfig> {
  const { data } = await supabase
    .from('discount_config')
    .select('config')
    .eq('corporation', corporation)
    .maybeSingle();
  return coerce(data?.config);
}

export async function saveDiscountConfig(corporation: string, config: unknown): Promise<DiscountConfig> {
  const clean = coerce(config); // 서버에서도 정규화 후 저장
  const { error } = await supabase
    .from('discount_config')
    .upsert({ corporation, config: clean, updated_at: new Date().toISOString() }, { onConflict: 'corporation' });
  if (error) throw error;
  return clean;
}
