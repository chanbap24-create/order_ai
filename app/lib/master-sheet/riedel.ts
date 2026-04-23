import { readSheetRows, parsePrice, trimCell } from './common';
import type { RiedelItem } from './types';

let cached: RiedelItem[] | null = null;

export function loadRiedelSheet(): RiedelItem[] {
  if (cached) return cached;

  const data = readSheetRows('riedel');
  if (!data) return [];

  const items: RiedelItem[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    const itemNo = trimCell(row[1]);       // B열
    const englishName = trimCell(row[3]);  // D열
    const koreanName = trimCell(row[4]);   // E열
    if (!itemNo || !englishName || !koreanName) continue;

    // F열(index 5): 공급가 (쉼표 변환 없이 Number)
    let supplyPrice: number | undefined;
    const raw = row[5];
    if (raw != null) {
      const parsed = Number(raw);
      if (!isNaN(parsed) && parsed > 0) supplyPrice = parsed;
    }

    items.push({ itemNo, englishName, koreanName, supplyPrice });
  }

  cached = items;
  console.log(`[masterSheet] Loaded ${items.length} items from Riedel sheet`);
  return items;
}

export function clearRiedelCache() {
  cached = null;
}

// parsePrice 미사용 경고 방지용 재export
export { parsePrice };
