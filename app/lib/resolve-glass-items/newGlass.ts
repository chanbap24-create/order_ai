import { searchRiedelSheet } from "@/app/lib/riedelMatcher";

/* ================= 신규 품목 검색 (Riedel 시트) ================= */

export function searchNewGlassFromRiedel(
  query: string,
): Array<{ code: string; item_name: string; score: number; is_new_item?: boolean; price?: number }> {
  try {
    const candidates = searchRiedelSheet(query, 3);
    return candidates.map((c) => ({
      code: c.code,
      item_name: `${c.koreanName} / ${c.englishName}`,
      score: Number(c.score.toFixed(3)),
      is_new_item: true,
      price: c.price,
    }));
  } catch (err) {
    console.error('신규 Glass 품목 검색 실패:', err);
    return [];
  }
}
