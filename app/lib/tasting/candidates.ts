// 시음주 후보 목록 = 와인(부자재 제외) 중 필터(재고/가격/타입) 통과. 재고 최다순.
import { supabase } from "@/app/lib/db";
import { normalizeType, bucketLabel } from "@/app/api/sales/recommend/lib/wineType";
import { WINE_TYPES, type TastingSettings } from "./settings";

export interface TastingCandidate {
  item_no: string;
  item_name: string;
  available_stock: number;
  supply_price: number;
  wine_type: string;
  score?: number; // 거래처 AI 추천 점수(있을 때)
}

/** 거래처 AI 추천견적(buildCandidates) 후보 — 점수순. 필터는 호출측/클라이언트에서. CDV만. */
export async function getAiCandidates(
  clientCode: string,
  company: "CDV" | "DL",
): Promise<TastingCandidate[]> {
  if (company !== "CDV") return [];
  const { buildCandidates } = await import("@/app/api/sales/recommend/lib/buildCandidates");
  const { scored } = await buildCandidates(clientCode);
  return (scored || []).map((s) => ({
    item_no: s.item_no,
    item_name: s.item_name,
    available_stock: Number(s.stock) || 0,
    supply_price: Number(s.price) || 0,
    wine_type: s.wine_type || "",
    score: s.score,
  }));
}

/** 후보가 설정 필터(재고/가격/타입)를 통과하는지. 타입 전체선택/미선택은 전체 허용. */
export function passesTasting(
  c: TastingCandidate,
  settings: { min_stock: number; price_min: number | null; price_max: number | null; wine_types: string[] },
): boolean {
  if (c.available_stock < settings.min_stock) return false;
  if (settings.price_min != null && c.supply_price < settings.price_min) return false;
  if (settings.price_max != null && c.supply_price > settings.price_max) return false;
  const tf = settings.wine_types;
  if (tf.length > 0 && tf.length < WINE_TYPES.length && !tf.includes(c.wine_type)) return false;
  return true;
}

/** wines 테이블에서 품번→타입 버킷. wines에 없는 품번(부자재·소모품)은 맵에 없음. */
async function typesFor(codes: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 300) {
    const { data } = await supabase
      .from("wines")
      .select("item_code, wine_type, item_name")
      .in("item_code", codes.slice(i, i + 300));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data || []) as any[]) {
      map.set(r.item_code, bucketLabel(normalizeType(r.wine_type || "", r.item_name || "")));
    }
  }
  return map;
}

export async function listTastingCandidates(
  company: "CDV" | "DL",
  settings: TastingSettings,
  limit = 50,
): Promise<TastingCandidate[]> {
  const table = company === "DL" ? "inventory_dl" : "inventory_cdv";
  let q = supabase
    .from(table)
    .select("item_no, item_name, supply_price, available_stock")
    .gte("available_stock", Math.max(1, settings.min_stock));
  if (settings.price_min != null) q = q.gte("supply_price", settings.price_min);
  if (settings.price_max != null) q = q.lte("supply_price", settings.price_max);
  // 부자재가 재고 상위를 차지하므로 넉넉히 받아 와인만 추린다.
  const { data } = await q.order("available_stock", { ascending: false }).limit(1500);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pool: TastingCandidate[] = ((data || []) as any[]).map((r) => ({
    item_no: r.item_no,
    item_name: r.item_name,
    available_stock: Number(r.available_stock) || 0,
    supply_price: Number(r.supply_price) || 0,
    wine_type: "",
  }));

  if (company === "CDV") {
    // 와인만: 타입이 실제로 잡히는 것만 남긴다. 부자재(종이백·케이스·스토퍼)는 wines에 있어도
    // wine_type 이 비어 있어 제외된다.
    const tmap = await typesFor(pool.map((r) => r.item_no));
    pool = pool
      .map((r) => ({ ...r, wine_type: tmap.get(r.item_no) || "" }))
      .filter((r) => r.wine_type !== "");
    // 타입 필터: 일부만 선택했을 때만 적용. 전체 선택/미선택은 전체 허용.
    const tf = settings.wine_types;
    if (tf.length > 0 && tf.length < WINE_TYPES.length) {
      pool = pool.filter((r) => tf.includes(r.wine_type));
    }
  }
  return pool.slice(0, limit);
}

/** 단일 품번 재고·공급가(1픽 표시용). */
export async function getItemBrief(
  company: "CDV" | "DL",
  itemNo: string,
): Promise<{ available_stock: number; supply_price: number } | null> {
  const table = company === "DL" ? "inventory_dl" : "inventory_cdv";
  const { data } = await supabase
    .from(table)
    .select("available_stock, supply_price")
    .eq("item_no", itemNo)
    .maybeSingle();
  if (!data) return null;
  return { available_stock: Number(data.available_stock) || 0, supply_price: Number(data.supply_price) || 0 };
}
