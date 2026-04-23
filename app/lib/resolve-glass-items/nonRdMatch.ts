import { norm } from "./normalize";

/* ================= 비-RD 품목 키워드 매핑 ================= */
// 마닐라박스, 쇼핑백 등 RD 코드가 없는 8 건의 부자재 품목
const NON_RD_KEYWORDS: Array<{
  keywords: string[]; item_no: string; item_name: string;
}> = [
  { keywords: ["마닐라", "특대", "마닐라박스특대"], item_no: "D000074", item_name: "마닐라박스(특대)" },
  { keywords: ["6본입", "데구스타지오네", "데구박스"], item_no: "D026001", item_name: "6본입 데구스타지오네 박스" },
  { keywords: ["2본입", "마닐라"], item_no: "D200018", item_name: "2본입 마닐라 박스" },
  { keywords: ["1본입", "스템잔", "스템"], item_no: "D200159", item_name: "1본입 마닐라 박스(2016)-스템잔용" },
  { keywords: ["1본입", "오잔", "소"], item_no: "D200160", item_name: "1본입 마닐라 박스(소)-오잔용" },
  { keywords: ["쇼핑백", "소", "리델"], item_no: "D200166", item_name: "2020 리델 쇼핑백(소)" },
  { keywords: ["쇼핑백", "중", "종이"], item_no: "E200102", item_name: "2019 종이 쇼핑백(중)" },
  { keywords: ["린넨", "리델"], item_no: "D200201", item_name: "리델 린넨" },
];

export function matchNonRDItem(query: string):
  { item_no: string; item_name: string; score: number } | null {
  const q = norm(query);
  if (!q) return null;

  let bestMatch: { item_no: string; item_name: string; score: number } | null = null;

  for (const entry of NON_RD_KEYWORDS) {
    const matchedCount = entry.keywords.filter(kw => q.includes(norm(kw))).length;
    if (matchedCount === 0) continue;

    const score = matchedCount / entry.keywords.length;
    if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        item_no: entry.item_no,
        item_name: entry.item_name,
        score: Math.min(0.95, 0.7 + score * 0.25),
      };
    }
  }

  return bestMatch;
}
