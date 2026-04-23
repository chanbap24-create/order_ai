/** 품번 첫 글자 → 상품 분류 */
export const ITEM_CATEGORY_MAP: Record<string, string> = {
  "0": "Champagne",
  "1": "Sparkling",
  "2": "Red",
  "3": "White",
  "4": "Rosé",
  "5": "Icewine",
  "6": "Grappa",
  "7": "Set",
  "8": "POS Material",
  "9": "자재",
  A: "Port",
  D: "대유",
  E: "자재(대유)",
  Z: "타사제품",
};

export function getItemCategory(itemNo: string): string {
  const first = (itemNo || "").charAt(0).toUpperCase();
  return ITEM_CATEGORY_MAP[first] || first || "-";
}
