/**
 * masterSheet.ts - order-ai.xlsx 시트 로더 배럴.
 * 실제 구현은 master-sheet/ 하위 모듈에 분산.
 */

import { clearEnglishCache } from './master-sheet/english';
import { clearDownloadsCache } from './master-sheet/downloads';
import { clearRiedelCache } from './master-sheet/riedel';

export type { MasterItem, RiedelItem } from './master-sheet/types';

export { loadMasterSheet } from './master-sheet/english';
export {
  loadDownloadsSheet,
  getDownloadsPriceMap,
  getDownloadsRetailPriceMap,
  getDlRetailPriceMap,
} from './master-sheet/downloads';
export { loadRiedelSheet } from './master-sheet/riedel';
export { loadAllMasterItemsV2 } from './master-sheet/combined';

// 하위 호환성을 위한 별칭
export { loadAllMasterItemsV2 as loadAllMasterItems } from './master-sheet/combined';

/**
 * 캐시 초기화 (테스트용)
 */
export function clearMasterSheetCache() {
  clearEnglishCache();
  clearDownloadsCache();
  clearRiedelCache();
}
