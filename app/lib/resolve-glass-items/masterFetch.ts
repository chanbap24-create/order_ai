import { supabase } from "@/app/lib/db";
import { stripQtyAndUnit } from "./normalize";

/* ================= 멀티 토큰 검색 ================= */

export function getAllTokens(rawName: string): string[] {
  const base = stripQtyAndUnit(rawName);
  const tokens = base.split(" ").filter(Boolean);
  const clean = tokens
    .map((t) => t.replace(/["'`]/g, "").trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));
  return clean;
}

export async function fetchFromGlassMasterByTokens(
  rawName: string,
  limit = 80,
): Promise<Array<{ item_no: string; item_name: string }>> {
  const tokens = getAllTokens(rawName);
  if (tokens.length === 0) return [];

  try {
    const results = new Map<string, { item_no: string; item_name: string; priority: number }>();

    // 전략 1: AND 검색
    if (tokens.length >= 2) {
      try {
        const orFilter = tokens.map(t => `item_name.ilike.%${t}%`).join(',');
        const { data } = await supabase
          .from('glass_items')
          .select('item_no, item_name')
          .or(orFilter)
          .limit(500);
        const andResults = (data || [])
          .filter(r => tokens.every(t => r.item_name.toLowerCase().includes(t.toLowerCase())))
          .slice(0, 30);

        for (const r of andResults) {
          if (!results.has(r.item_no)) {
            results.set(r.item_no, { ...r, priority: 3 });
          }
        }
        console.log(`[Glass MultiToken] AND: "${tokens.join('" AND "')}" → ${andResults.length}`);
      } catch (e) {
        console.error('[Glass MultiToken] AND 검색 실패:', e);
      }
    }

    // 전략 2: Half 검색
    if (tokens.length >= 3) {
      try {
        const halfCount = Math.ceil(tokens.length / 2);
        const halfTokens = tokens.slice(0, halfCount);
        const halfOrFilter = halfTokens.map(t => `item_name.ilike.%${t}%`).join(',');
        const { data } = await supabase
          .from('glass_items')
          .select('item_no, item_name')
          .or(halfOrFilter)
          .limit(500);
        const halfResults = (data || [])
          .filter(r => halfTokens.every(t => r.item_name.toLowerCase().includes(t.toLowerCase())))
          .slice(0, 40);

        for (const r of halfResults) {
          if (!results.has(r.item_no)) {
            results.set(r.item_no, { ...r, priority: 2 });
          }
        }
        console.log(`[Glass MultiToken] Half: "${halfTokens.join('" AND "')}" → ${halfResults.length}`);
      } catch (e) {
        console.error('[Glass MultiToken] Half 검색 실패:', e);
      }
    }

    // 전략 3: OR 검색
    try {
      const orFilter = tokens.map(t => `item_name.ilike.%${t}%`).join(',');
      const { data } = await supabase
        .from('glass_items')
        .select('item_no, item_name')
        .or(orFilter)
        .limit(30);
      const orResults = (data || []) as Array<{ item_no: string; item_name: string }>;

      for (const r of orResults) {
        if (!results.has(r.item_no)) {
          results.set(r.item_no, { ...r, priority: 1 });
        }
      }
      console.log(`[Glass MultiToken] OR: "${tokens.join('" OR "')}" → ${orResults.length}`);
    } catch (e) {
      console.error('[Glass MultiToken] OR 검색 실패:', e);
    }

    const sorted = Array.from(results.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map(({ item_no, item_name }) => ({ item_no, item_name }));

    console.log(`[Glass MultiToken] 총 후보: ${sorted.length} (중복 제거 후)`);
    return sorted;
  } catch (e) {
    console.error('[Glass MultiToken] 전체 검색 실패:', e);
    return [];
  }
}
