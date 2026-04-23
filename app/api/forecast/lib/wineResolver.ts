import { getItemCategory } from "./constants";
import type { WineRow } from "./types";

export function buildVintageMap(wineMap: Map<string, WineRow>): Map<string, { abbr: string; data: WineRow }[]> {
  const vintageMap = new Map<string, { abbr: string; data: WineRow }[]>();
  for (const [k, v] of wineMap) {
    const base = k.slice(0, 2) + k.slice(4);
    const abbr = ((v.item_name_kr || '').match(/^([A-Z]{2})\s/) || [])[1] || '';
    if (!vintageMap.has(base)) vintageMap.set(base, []);
    vintageMap.get(base)!.push({ abbr, data: v });
  }
  return vintageMap;
}

export type ResolvedWine = {
  country: string | null;
  region: string | null;
  wineType: string | null;
  wineData: WineRow | null;
  brandCode: string | null;
};

export function resolveWine(
  itemNo: string,
  itemName: string,
  wineMap: Map<string, WineRow>,
  invMap: Map<string, string>,
  brandCountry: Map<string, string>,
  vintageMap: Map<string, { abbr: string; data: WineRow }[]>,
): ResolvedWine {
  let country: string | null = null, region: string | null = null, wineType: string | null = null;
  let wineData: WineRow | null = null;

  // 브랜드 코드: 품명에서 직접 추출
  const brandMatch = (itemName || '').match(/^([A-Z]{2,3})\s/);
  const brandCode = brandMatch ? brandMatch[1] : null;

  const w = wineMap.get(itemNo);
  if (w) { country = w.country; region = w.region; wineType = w.wine_type; wineData = w; }
  if (!country) country = invMap.get(itemNo) || null;
  if (!country) {
    const base = itemNo.slice(0, 2) + itemNo.slice(4);
    const nameAbbr = (itemName.match(/^([A-Z]{2})\s/) || [])[1] || '';
    const candidates = vintageMap.get(base);
    if (candidates) {
      for (const c of candidates) {
        if (nameAbbr && c.abbr && nameAbbr !== c.abbr) continue;
        country = c.data.country; region = c.data.region; wineType = c.data.wine_type;
        if (!wineData) wineData = c.data;
        break;
      }
    }
  }
  if (!country) {
    const m = (itemName || '').match(/^([A-Z]{2,3})\s/);
    if (m && brandCountry.has(m[1])) country = brandCountry.get(m[1])!;
  }
  // 품번 첫 글자 기반 분류 우선
  const codeCategory = getItemCategory(itemNo);
  if (codeCategory) wineType = codeCategory;
  return { country, region, wineType, wineData, brandCode };
}
