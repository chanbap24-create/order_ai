import { readSheetRows, parsePrice, trimCell } from './common';
import type { MasterItem } from './types';

let cached: MasterItem[] | null = null;

/**
 * order-ai.xlsx의 English 시트를 읽어서 MasterItem[] 반환.
 * 신규 품목 매칭용. 캐싱됨.
 */
export function loadMasterSheet(): MasterItem[] {
  if (cached) return cached;

  const data = readSheetRows('english');
  if (!data) return [];

  const items: MasterItem[] = [];

  // Row 0은 타이틀, Row 1부터 데이터 시작
  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    const itemNo = trimCell(row[1]);       // B열
    const englishName = trimCell(row[7]);  // H열
    const koreanName = trimCell(row[8]);   // I열

    if (!itemNo || !englishName || !koreanName) continue;

    items.push({
      itemNo,
      englishName,
      koreanName,
      vintage: trimCell(row[9]) || undefined,
      country: trimCell(row[3]) || undefined,
      producer: trimCell(row[4]) || undefined,
      region: trimCell(row[5]) || undefined,
      supplyPrice: parsePrice(row[11]),  // L열
    });
  }

  cached = items;
  console.log(`[masterSheet] Loaded ${items.length} items from English sheet`);
  return items;
}

export function clearEnglishCache() {
  cached = null;
}
