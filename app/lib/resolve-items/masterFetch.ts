import { supabase } from "@/app/lib/db";
import { stripQtyAndUnit } from "./normalize";

function getTailTokens(rawName: string) {
  const base = stripQtyAndUnit(rawName);
  const tokens = base.split(" ").filter(Boolean);
  const clean = tokens
    .map((t) => t.replace(/["'`]/g, "").trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));

  // 뒤에서 1~2개
  const tail1 = clean[clean.length - 1];
  const tail2 = clean[clean.length - 2];
  const out: string[] = [];
  if (tail1) out.push(tail1);
  if (tail2) out.push(tail2);
  return out;
}

/**
 * 뒤에서 토큰 1~2개로 inventory_cdv에서 OR ilike 후보 확장.
 */
export async function fetchFromMasterByTail(rawName: string, limit = 60) {
  const tails = getTailTokens(rawName);
  if (tails.length === 0) return [] as Array<{ item_no: string; item_name: string }>;

  try {
    const orFilter = tails.map((t) => `item_name.ilike.%${t}%`).join(",");
    const { data } = await supabase
      .from("inventory_cdv")
      .select("item_no, item_name")
      .or(orFilter)
      .limit(limit);

    return (data || []) as Array<{ item_no: string; item_name: string }>;
  } catch {
    return [] as Array<{ item_no: string; item_name: string }>;
  }
}
