import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";

/**
 * 최근 출고일 맵 (item_no → lastShipped timestamp ms).
 * 못 찾으면 빈 맵. 기존 로직 영향 없음.
 */
export async function buildLastShippedMap(clientCode: string) {
  const map = new Map<string, number>();
  try {
    const { data: rows } = await supabase
      .from("client_item_stats")
      .select("item_no, updated_at")
      .eq("client_code", clientCode);

    for (const r of rows || []) {
      const itemNo = String(r.item_no || "").trim();
      if (!itemNo) continue;
      const t = new Date(String(r.updated_at || "")).getTime();
      if (Number.isFinite(t) && t > 0) map.set(itemNo, t);
    }
  } catch (e) {
    // 비치명적: 실패 시 빈/부분 맵으로 진행하되, 조용히 묻히지 않게 기록.
    logger.warn("buildLastShippedMap 실패(빈 맵으로 진행)", { clientCode, error: String(e) });
  }
  return map;
}

/**
 * English 시트 영문명 맵 로드 (item_no → name_en).
 */
export async function loadEnglishMap() {
  try {
    const { data: rows } = await supabase
      .from("item_english")
      .select("item_no, name_en");
    const m = new Map<string, string>();
    for (const r of rows || []) {
      const k = String(r.item_no ?? "").trim();
      const v = String(r.name_en ?? "").trim();
      if (k && v) m.set(k, v);
    }
    return m;
  } catch {
    return new Map<string, string>();
  }
}
