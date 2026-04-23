import { loadMasterSheet } from './english';
import { loadDownloadsSheet, getDownloadsPriceMap } from './downloads';
import type { MasterItem } from './types';

/**
 * English + Downloads 통합 로드.
 * English 시트 기준으로 검색, Downloads에서 공급가만 가져오기.
 * Downloads에만 있는 품목은 그대로 추가.
 */
export function loadAllMasterItemsV2(): MasterItem[] {
  const englishItems = loadMasterSheet();
  const downloadsPriceMap = getDownloadsPriceMap();

  console.log(`[loadAllMasterItemsV2] English items: ${englishItems.length}, Downloads prices: ${downloadsPriceMap.size}`);

  const itemMap = new Map<string, MasterItem>();

  for (const item of englishItems) {
    const downloadPrice = downloadsPriceMap.get(item.itemNo);
    itemMap.set(item.itemNo, {
      ...item,
      // 공급가: Downloads 우선, 없으면 English 값 사용
      supplyPrice: downloadPrice ?? item.supplyPrice,
    });
  }

  const charles = itemMap.get('00NV801');
  if (charles) {
    console.log(`[loadAllMasterItemsV2] 00NV801 최종 체크: ${charles.koreanName}, supply_price=${charles.supplyPrice}`);
  }
  const charles805 = itemMap.get('00NV805');
  if (charles805) {
    console.log(`[loadAllMasterItemsV2] 00NV805 최종 체크: ${charles805.koreanName}, supply_price=${charles805.supplyPrice}`);
  }

  // Downloads에만 있는 품목 추가
  const downloadsItems = loadDownloadsSheet();
  console.log(`[loadAllMasterItemsV2] 🔍 Downloads items total: ${downloadsItems.length}`);

  let downloadsOnlyCount = 0;
  for (const dlItem of downloadsItems) {
    if (!itemMap.has(dlItem.itemNo)) {
      itemMap.set(dlItem.itemNo, dlItem);
      downloadsOnlyCount++;
      if (dlItem.itemNo.startsWith('00NV')) {
        console.log(`[loadAllMasterItemsV2] ✅ Downloads only item added: ${dlItem.itemNo} (${dlItem.koreanName}), supply_price=${dlItem.supplyPrice}`);
      }
    }
  }
  console.log(`[loadAllMasterItemsV2] 📦 Downloads-only items added: ${downloadsOnlyCount}`);

  const allItems = Array.from(itemMap.values());
  console.log(`[masterSheet] Total items: ${allItems.length} (English: ${englishItems.length}, Downloads only: ${downloadsItems.length - englishItems.length})`);
  return allItems;
}
