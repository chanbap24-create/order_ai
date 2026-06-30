// 시음주 선정 설정(법인별): 재고/가격/와인타입 필터.
import { supabase } from "@/app/lib/db";

export const WINE_TYPES = ["레드", "화이트", "스파클링", "로제", "주정강화"] as const;

export interface TastingSettings {
  company: "CDV" | "DL";
  min_stock: number;
  price_min: number | null;
  price_max: number | null;
  wine_types: string[]; // 빈 배열 = 전체 허용
}

export function defaultSettings(company: "CDV" | "DL"): TastingSettings {
  return { company, min_stock: 1, price_min: null, price_max: null, wine_types: [] };
}

export async function getTastingSettings(company: "CDV" | "DL"): Promise<TastingSettings> {
  const { data } = await supabase
    .from("tasting_settings")
    .select("company, min_stock, price_min, price_max, wine_types")
    .eq("company", company)
    .maybeSingle();
  if (!data) return defaultSettings(company);
  return {
    company,
    min_stock: Number(data.min_stock) || 0,
    price_min: data.price_min == null ? null : Number(data.price_min),
    price_max: data.price_max == null ? null : Number(data.price_max),
    wine_types: Array.isArray(data.wine_types) ? data.wine_types : [],
  };
}

export async function upsertTastingSettings(
  s: TastingSettings,
  updatedBy?: string,
): Promise<void> {
  const { error } = await supabase.from("tasting_settings").upsert(
    {
      company: s.company,
      min_stock: Math.max(0, Math.trunc(s.min_stock) || 0),
      price_min: s.price_min == null ? null : Math.max(0, Math.trunc(s.price_min)),
      price_max: s.price_max == null ? null : Math.max(0, Math.trunc(s.price_max)),
      wine_types: (s.wine_types || []).filter((w) => (WINE_TYPES as readonly string[]).includes(w)),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    },
    { onConflict: "company" },
  );
  if (error) throw new Error(error.message);
}

/** ScoredItem이 설정 필터(재고/가격/타입)를 통과하는지. */
export function passesFilter(
  s: TastingSettings,
  cand: { stock?: number; price?: number; wine_type?: string },
): boolean {
  if ((cand.stock || 0) < s.min_stock) return false;
  if (s.price_min != null && (cand.price || 0) < s.price_min) return false;
  if (s.price_max != null && (cand.price || 0) > s.price_max) return false;
  if (s.wine_types.length > 0 && !s.wine_types.includes(cand.wine_type || "")) return false;
  return true;
}
