import { supabase } from "@/app/lib/db";
import { searchMasterSheet } from "@/app/lib/masterMatcher";
import { getDownloadsPriceMap } from "@/app/lib/masterSheet";
import { stripQtyAndUnit } from "./normalize";
import { tokenSynonymMap } from "./tokenSynonyms";
import { scoreItem } from "./scoreItem";

/* ================= 마스터에서 후보 확장 ================= */

/**
 * 모든 유효한 토큰 추출 (기존: 꼬리 2개만 → 개선: 모든 토큰)
 */
export function getAllTokens(rawName: string): string[] {
  const base = stripQtyAndUnit(rawName);
  const tokens = base.split(" ").filter(Boolean);
  const clean = tokens
    .map((t) => t.replace(/["'`]/g, "").trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));
  return clean;
}

/**
 * 멀티 토큰 검색: AND + Half + OR 전략
 */
export async function fetchFromMasterByTail(
  rawName: string,
  limit = 80,
): Promise<Array<{ item_no: string; item_name: string }>> {
  const table = 'inventory_cdv';
  const itemNoCol = 'item_no';
  const itemNameCol = 'item_name';

  const tokens = getAllTokens(rawName);
  if (tokens.length === 0) return [];

  function getTokenWithSynonyms(token: string): string[] {
    const synonyms = tokenSynonymMap.get(token.toLowerCase());
    return synonyms ? Array.from(synonyms) : [token];
  }

  function matchesAllTokensWithSynonyms(itemName: string, checkTokens: string[]): boolean {
    const nameLower = itemName.toLowerCase();
    return checkTokens.every(t => {
      if (nameLower.includes(t.toLowerCase())) return true;
      const syns = tokenSynonymMap.get(t.toLowerCase());
      if (syns) {
        for (const syn of syns) {
          if (nameLower.includes(syn)) return true;
        }
      }
      return false;
    });
  }

  try {
    const results = new Map<string, { item_no: string; item_name: string; priority: number }>();

    // 전략 1: AND (모든 토큰)
    if (tokens.length >= 2) {
      try {
        const expandedTokens = tokens.flatMap(t => getTokenWithSynonyms(t));
        const uniqueTokens = [...new Set(expandedTokens)];
        const orFilter = uniqueTokens.map(t => `${itemNameCol}.ilike.%${t}%`).join(',');
        const { data } = await supabase
          .from(table)
          .select(`${itemNoCol}, ${itemNameCol}`)
          .or(orFilter)
          .limit(500);
        const andResults = (data || [])
          .filter((r: any) => matchesAllTokensWithSynonyms(String(r[itemNameCol]), tokens))
          .slice(0, 30);

        for (const r of andResults) {
          const itemNo = String((r as any)[itemNoCol]);
          const itemName = String((r as any)[itemNameCol]);
          if (!results.has(itemNo)) {
            results.set(itemNo, { item_no: itemNo, item_name: itemName, priority: 3 });
          }
        }
        console.log(`[MultiToken] AND 검색: "${tokens.join('" AND "')}" → ${andResults.length}개`);
      } catch (e) {
        console.error('[MultiToken] AND 검색 실패:', e);
      }
    }

    // 전략 2: Half (절반 이상 토큰)
    if (tokens.length >= 3) {
      try {
        const halfCount = Math.ceil(tokens.length / 2);
        const halfTokens = tokens.slice(0, halfCount);
        const halfExpanded = halfTokens.flatMap(t => getTokenWithSynonyms(t));
        const halfUnique = [...new Set(halfExpanded)];
        const halfOrFilter = halfUnique.map(t => `${itemNameCol}.ilike.%${t}%`).join(',');
        const { data } = await supabase
          .from(table)
          .select(`${itemNoCol}, ${itemNameCol}`)
          .or(halfOrFilter)
          .limit(500);
        const halfResults = (data || [])
          .filter((r: any) => matchesAllTokensWithSynonyms(String(r[itemNameCol]), halfTokens))
          .slice(0, 40);

        for (const r of halfResults) {
          const itemNo = String((r as any)[itemNoCol]);
          const itemName = String((r as any)[itemNameCol]);
          if (!results.has(itemNo)) {
            results.set(itemNo, { item_no: itemNo, item_name: itemName, priority: 2 });
          }
        }
        console.log(`[MultiToken] Half 검색: "${halfTokens.join('" AND "')}" → ${halfResults.length}개`);
      } catch (e) {
        console.error('[MultiToken] Half 검색 실패:', e);
      }
    }

    // 전략 3: OR (하나라도, 동의어 확장)
    try {
      const orExpanded = tokens.flatMap(t => getTokenWithSynonyms(t));
      const orUnique = [...new Set(orExpanded)];
      const orFilter = orUnique.map(t => `${itemNameCol}.ilike.%${t}%`).join(',');
      const { data } = await supabase
        .from(table)
        .select(`${itemNoCol}, ${itemNameCol}`)
        .or(orFilter)
        .limit(50);
      const orResults = (data || []);

      for (const r of orResults) {
        const itemNo = String((r as any)[itemNoCol]);
        const itemName = String((r as any)[itemNameCol]);
        if (!results.has(itemNo)) {
          results.set(itemNo, { item_no: itemNo, item_name: itemName, priority: 1 });
        }
      }
      console.log(`[MultiToken] OR 검색: "${tokens.join('" OR "')}" → ${orResults.length}개`);
    } catch (e) {
      console.error('[MultiToken] OR 검색 실패:', e);
    }

    const sorted = Array.from(results.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map(({ item_no, item_name }) => ({ item_no, item_name }));

    console.log(`[MultiToken] 총 후보: ${sorted.length}개 (중복 제거 후)`);
    return sorted;
  } catch (e) {
    console.error('[MultiToken] 전체 검색 실패:', e);
    return [];
  }
}

/* ================= 신규 품목 검색 (English 시트) ================= */

export async function searchNewItemFromMaster(
  query: string,
): Promise<Array<{ item_no: string; item_name: string; score: number; is_new_item?: boolean; supply_price?: number }>> {
  try {
    const masterItems = searchMasterSheet(query, 20);

    const downloadsPriceMap = getDownloadsPriceMap();
    console.log(`[searchNewItemFromMaster] Downloads price map loaded: ${downloadsPriceMap.size} items`);

    const rescored = await Promise.all(masterItems.map(async item => {
      const koreanScore = scoreItem(query, item.koreanName);
      const englishScore = scoreItem(query, item.englishName);
      const maxScore = Math.max(koreanScore, englishScore);

      let supplyPrice: number | undefined = downloadsPriceMap.get(item.itemNo) ?? item.supplyPrice;
      console.log(`[searchNewItemFromMaster] 🔍 ${item.itemNo}: Downloads=${downloadsPriceMap.get(item.itemNo)}, master=${item.supplyPrice}, 선택=${supplyPrice}`);

      if (!supplyPrice) {
        try {
          const { data: itemRow } = await supabase
            .from('inventory_cdv')
            .select('supply_price')
            .eq('item_no', String(item.itemNo))
            .maybeSingle();
          if (itemRow?.supply_price) {
            supplyPrice = itemRow.supply_price;
            console.log(`[searchNewItemFromMaster] ✅ DB에서 공급가 조회: ${item.itemNo} = ${supplyPrice}원`);
          }
        } catch (e) {
          console.error(`[searchNewItemFromMaster] ❌ DB 조회 실패: ${item.itemNo}`, e);
        }
      }

      console.log(`[searchNewItemFromMaster] 🎯 최종: ${item.itemNo} = ${supplyPrice}원`);

      const resultItem = {
        item_no: item.itemNo,
        item_name: `${item.koreanName} / ${item.englishName}${item.vintage ? ` (${item.vintage})` : ''}`,
        score: maxScore,
        is_new_item: true,
        supply_price: supplyPrice,
      };

      console.log(`[searchNewItemFromMaster] 📦 반환 객체:`, JSON.stringify(resultItem, null, 2));
      return resultItem;
    }));

    return rescored
      .filter(item => (item.score ?? 0) > 0.3)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 10);
  } catch (err) {
    console.error('신규 품목 검색 실패:', err);
    return [];
  }
}

/* ================= 영문명 맵 로드 ================= */

export async function loadEnglishMap(): Promise<Map<string, string>> {
  try {
    const { data: rows } = await supabase
      .from('item_english')
      .select('item_no, name_en');
    const m = new Map<string, string>();
    for (const r of (rows || [])) {
      const k = String((r as any).item_no ?? "").trim();
      const v = String((r as any).name_en ?? "").trim();
      if (k && v) m.set(k, v);
    }
    return m;
  } catch {
    return new Map<string, string>();
  }
}
