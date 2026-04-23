import { readSheetRows, parsePrice, trimCell } from './common';
import type { MasterItem } from './types';

let cachedDownloads: MasterItem[] | null = null;
let cachedPriceMap: Map<string, number> | null = null;
let cachedRetailMap: Map<string, number> | null = null;
let cachedDlRetailMap: Map<string, number> | null = null;

export function loadDownloadsSheet(): MasterItem[] {
  if (cachedDownloads) return cachedDownloads;

  const data = readSheetRows('downloads');
  if (!data) return [];

  const items: MasterItem[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    const itemNo = trimCell(row[1]);       // 품번
    const koreanName = trimCell(row[2]);   // 품명
    if (!itemNo || !koreanName) continue;

    // 빈티지가 2자리 숫자면 연도로 변환
    let vintage = trimCell(row[6]);
    if (vintage && vintage.length === 2) {
      const year = parseInt(vintage);
      vintage = year < 50 ? `20${vintage}` : `19${vintage}`;
    }

    items.push({
      itemNo,
      englishName: '', // Downloads 시트에는 영문명 없음
      koreanName,
      vintage: vintage || undefined,
      country: trimCell(row[8]) || undefined,
      producer: '',
      region: '',
      supplyPrice: parsePrice(row[17]),  // R열
      retailPrice: parsePrice(row[18]),  // S열
    });
  }

  cachedDownloads = items;
  console.log(`[masterSheet] Loaded ${items.length} items from Downloads sheet`);
  return items;
}

/**
 * Downloads 시트 item_no -> supply_price Map
 */
export function getDownloadsPriceMap(): Map<string, number> {
  if (cachedPriceMap) {
    console.log(`[masterSheet] Using cached Downloads price map: ${cachedPriceMap.size} items`);
    return cachedPriceMap;
  }

  const items = loadDownloadsSheet();
  const priceMap = new Map<string, number>();
  for (const item of items) {
    if (item.supplyPrice && item.supplyPrice > 0) {
      priceMap.set(item.itemNo, item.supplyPrice);
    }
  }
  cachedPriceMap = priceMap;
  console.log(`[masterSheet] Downloads price map created: ${priceMap.size} items with supply_price`);

  // 찰스 하이직 확인
  const charles = ['00NV801', '00NV805', '00NV806'];
  charles.forEach((itemNo) => {
    const price = priceMap.get(itemNo);
    console.log(`[masterSheet] Price check: ${itemNo} = ${price ? price.toLocaleString() + '원' : '❌ 없음'}`);
  });

  return priceMap;
}

/**
 * Downloads 시트 item_no -> retail_price(판매가) Map
 */
export function getDownloadsRetailPriceMap(): Map<string, number> {
  if (cachedRetailMap) return cachedRetailMap;

  const items = loadDownloadsSheet();
  const retailMap = new Map<string, number>();
  for (const item of items) {
    if (item.retailPrice && item.retailPrice > 0) {
      retailMap.set(item.itemNo, item.retailPrice);
    }
  }
  cachedRetailMap = retailMap;
  console.log(`[masterSheet] Downloads retail price map created: ${retailMap.size} items`);
  return retailMap;
}

/**
 * DL 시트(와인잔 재고) item_no -> retail_price Map (S열=index 18)
 */
export function getDlRetailPriceMap(): Map<string, number> {
  if (cachedDlRetailMap) return cachedDlRetailMap;

  const data = readSheetRows('dl');
  if (!data) return new Map();

  const retailMap = new Map<string, number>();
  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    const itemNo = trimCell(row[1]);
    if (!itemNo) continue;
    const retail = parsePrice(row[18]); // S열
    if (retail) retailMap.set(itemNo, retail);
  }

  cachedDlRetailMap = retailMap;
  console.log(`[masterSheet] DL retail price map created: ${retailMap.size} items`);
  return retailMap;
}

export function clearDownloadsCache() {
  cachedDownloads = null;
  cachedPriceMap = null;
  cachedRetailMap = null;
  cachedDlRetailMap = null;
}
