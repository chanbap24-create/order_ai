/**
 * masterSheet.ts
 * order-ai.xlsx의 English 시트를 읽어서 신규 품목 매칭에 사용
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface MasterItem {
  itemNo: string;      // B열: 품목코드
  englishName: string; // H열: 영문 품목명
  koreanName: string;  // I열: 한글 품목명
  vintage?: string;    // J열: 빈티지
  country?: string;    // D열: 국가
  producer?: string;   // E열: 생산자
  region?: string;     // F열: 지역
  supplyPrice?: number; // L열: 공급가
  retailPrice?: number; // S열: 판매가 (소비자가)
}

let cachedMasterItems: MasterItem[] | null = null;

/**
 * order-ai.xlsx의 English 시트를 읽어서 MasterItem[] 반환
 */
export function loadMasterSheet(): MasterItem[] {
  // 캐시가 있으면 재사용
  if (cachedMasterItems) {
    return cachedMasterItems;
  }

  const xlsxPath = path.join(process.cwd(), 'order-ai.xlsx');
  
  if (!fs.existsSync(xlsxPath)) {
    console.warn('[masterSheet] order-ai.xlsx not found:', xlsxPath);
    return [];
  }

  try {
    // 파일을 buffer로 읽기
    const buffer = fs.readFileSync(xlsxPath);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.find(
      (name) => name.toLowerCase() === 'english'
    );

    if (!sheetName) {
      console.warn('[masterSheet] English sheet not found');
      return [];
    }

    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const items: MasterItem[] = [];

    // Row 0은 타이틀, Row 1부터 데이터 시작
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // B열(index 1): 품목코드
      const itemNo = row[1]?.toString().trim();
      // H열(index 7): 영문명
      const englishName = row[7]?.toString().trim();
      // I열(index 8): 한글명
      const koreanName = row[8]?.toString().trim();

      // 필수 필드가 없으면 스킵
      if (!itemNo || !englishName || !koreanName) {
        continue;
      }

      // L열(index 11): 공급가
      const supplyPriceRaw = row[11];
      let supplyPrice: number | undefined = undefined;
      if (supplyPriceRaw != null) {
        // 쉼표와 공백 제거 후 숫자로 변환
        const cleaned = String(supplyPriceRaw).replace(/[,\s]/g, '').trim();
        const parsed = Number(cleaned);
        if (!isNaN(parsed) && parsed > 0) {
          supplyPrice = parsed;
        }
      }

      items.push({
        itemNo,
        englishName,
        koreanName,
        vintage: row[9]?.toString().trim(),
        country: row[3]?.toString().trim(),
        producer: row[4]?.toString().trim(),
        region: row[5]?.toString().trim(),
        supplyPrice,
      });
    }

    cachedMasterItems = items;
    console.log(`[masterSheet] Loaded ${items.length} items from English sheet`);
    return items;
  } catch (error) {
    console.error('[masterSheet] Error loading Excel:', error);
    return [];
  }
}

/**
 * Downloads 시트에서 와인 품목 로드
 */
let cachedDownloadsItems: MasterItem[] | null = null;

export function loadDownloadsSheet(): MasterItem[] {
  if (cachedDownloadsItems) {
    return cachedDownloadsItems;
  }

  const xlsxPath = path.join(process.cwd(), 'order-ai.xlsx');
  
  if (!fs.existsSync(xlsxPath)) {
    console.warn('[masterSheet] order-ai.xlsx not found:', xlsxPath);
    return [];
  }

  try {
    const buffer = fs.readFileSync(xlsxPath);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.find(
      (name) => name.toLowerCase() === 'downloads'
    );

    if (!sheetName) {
      console.warn('[masterSheet] Downloads sheet not found');
      return [];
    }

    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const items: MasterItem[] = [];

    // Row 0: 헤더, Row 1부터 데이터 시작
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 품번 (index 1)
      const itemNo = row[1]?.toString().trim();
      // 품명/한글명 (index 2)
      const koreanName = row[2]?.toString().trim();
      // Downloads 시트에는 영문명 없음
      const englishName = '';

      // 필수 필드가 없으면 스킵
      if (!itemNo || !koreanName) {
        continue;
      }

      // 빈티지 (index 6)
      let vintage = row[6]?.toString().trim();
      // 빈티지가 2자리 숫자면 연도로 변환 (예: "17" → "2017")
      if (vintage && vintage.length === 2) {
        const year = parseInt(vintage);
        vintage = year < 50 ? `20${vintage}` : `19${vintage}`;
      }

      // 공급가 (R열 = index 17)
      const supplyPriceRaw = row[17];
      let supplyPrice: number | undefined = undefined;
      if (supplyPriceRaw != null) {
        // 쉼표와 공백 제거 후 숫자로 변환
        const cleaned = String(supplyPriceRaw).replace(/[,\s]/g, '').trim();
        const parsed = Number(cleaned);
        if (!isNaN(parsed) && parsed > 0) {
          supplyPrice = parsed;
        }
      }

      // 판매가/소비자가 (S열 = index 18)
      const retailPriceRaw = row[18];
      let retailPrice: number | undefined = undefined;
      if (retailPriceRaw != null) {
        const cleaned = String(retailPriceRaw).replace(/[,\s]/g, '').trim();
        const parsed = Number(cleaned);
        if (!isNaN(parsed) && parsed > 0) {
          retailPrice = parsed;
        }
      }

      items.push({
        itemNo,
        englishName, // Downloads 시트에는 영문명 없음 (빈 문자열)
        koreanName,
        vintage,
        country: row[8]?.toString().trim(), // 국가 (index 8)
        producer: '', // Downloads 시트에는 생산자 정보 없음
        region: '', // Downloads 시트에는 지역 정보 없음
        supplyPrice,
        retailPrice,
      });
    }

    cachedDownloadsItems = items;
    console.log(`[masterSheet] Loaded ${items.length} items from Downloads sheet`);
    return items;
  } catch (error) {
    console.error('[masterSheet] Error loading Downloads sheet:', error);
    return [];
  }
}

/**
 * Downloads 시트를 item_no -> supply_price Map으로 로드 (빠른 조회용)
 */
let cachedDownloadsPriceMap: Map<string, number> | null = null;

export function getDownloadsPriceMap(): Map<string, number> {
  if (cachedDownloadsPriceMap) {
    console.log(`[masterSheet] Using cached Downloads price map: ${cachedDownloadsPriceMap.size} items`);
    return cachedDownloadsPriceMap;
  }
  
  const downloadsItems = loadDownloadsSheet();
  const priceMap = new Map<string, number>();
  
  for (const item of downloadsItems) {
    if (item.supplyPrice && item.supplyPrice > 0) {
      priceMap.set(item.itemNo, item.supplyPrice);
    }
  }
  
  cachedDownloadsPriceMap = priceMap;
  console.log(`[masterSheet] Downloads price map created: ${priceMap.size} items with supply_price`);
  
  // 찰스 하이직 확인
  const charles = ['00NV801', '00NV805', '00NV806'];
  charles.forEach(itemNo => {
    const price = priceMap.get(itemNo);
    console.log(`[masterSheet] Price check: ${itemNo} = ${price ? price.toLocaleString() + '원' : '❌ 없음'}`);
  });
  
  return priceMap;
}

/**
 * Downloads 시트를 item_no -> retail_price(판매가/소비자가) Map으로 로드
 */
let cachedDownloadsRetailPriceMap: Map<string, number> | null = null;

export function getDownloadsRetailPriceMap(): Map<string, number> {
  if (cachedDownloadsRetailPriceMap) {
    return cachedDownloadsRetailPriceMap;
  }

  const downloadsItems = loadDownloadsSheet();
  const retailMap = new Map<string, number>();

  for (const item of downloadsItems) {
    if (item.retailPrice && item.retailPrice > 0) {
      retailMap.set(item.itemNo, item.retailPrice);
    }
  }

  cachedDownloadsRetailPriceMap = retailMap;
  console.log(`[masterSheet] Downloads retail price map created: ${retailMap.size} items`);
  return retailMap;
}

/**
 * English + Downloads 시트 통합 로드 V2
 * ✅ 새 로직: English 시트 기준으로 검색, Downloads에서 공급가만 가져오기
 * ✅ V2: 함수 이름 변경으로 캐시 무효화
 */
export function loadAllMasterItemsV2(): MasterItem[] {
  const englishItems = loadMasterSheet();
  const downloadsPriceMap = getDownloadsPriceMap();
  
  console.log(`[loadAllMasterItemsV2] English items: ${englishItems.length}, Downloads prices: ${downloadsPriceMap.size}`);
  
  // English 시트 기준으로 시작
  const itemMap = new Map<string, MasterItem>();
  
  for (const item of englishItems) {
    // Downloads에서 공급가 조회
    const downloadPrice = downloadsPriceMap.get(item.itemNo);
    
    itemMap.set(item.itemNo, {
      ...item,
      // 공급가: Downloads 우선, 없으면 English 값 사용
      supplyPrice: downloadPrice ?? item.supplyPrice,
    });
  }
  
  // 찰스 하이직 확인
  const charles = itemMap.get('00NV801');
  if (charles) {
    console.log(`[loadAllMasterItemsV2] 00NV801 최종 체크: ${charles.koreanName}, supply_price=${charles.supplyPrice}`);
  }
  const charles805 = itemMap.get('00NV805');
  if (charles805) {
    console.log(`[loadAllMasterItemsV2] 00NV805 최종 체크: ${charles805.koreanName}, supply_price=${charles805.supplyPrice}`);
  }
  
  // Downloads에만 있는 품목 추가 (English에 없는 것들)
  const downloadsItems = loadDownloadsSheet();
  console.log(`[loadAllMasterItemsV2] 🔍 Downloads items total: ${downloadsItems.length}`);
  
  let downloadsOnlyCount = 0;
  for (const dlItem of downloadsItems) {
    if (!itemMap.has(dlItem.itemNo)) {
      // English에 없는 품목은 Downloads 데이터 그대로 추가
      itemMap.set(dlItem.itemNo, dlItem);
      downloadsOnlyCount++;
      
      // 00NV로 시작하는 품목 로그
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

// 하위 호환성을 위한 별칭
export const loadAllMasterItems = loadAllMasterItemsV2;

/**
 * 캐시 초기화 (테스트용)
 */
export function clearMasterSheetCache() {
  cachedMasterItems = null;
  cachedDownloadsItems = null;
  cachedDownloadsPriceMap = null;
  cachedDownloadsRetailPriceMap = null;
  cachedRiedelItems = null;
}

/* ==================== Riedel 시트 (Glass용) ==================== */

export interface RiedelItem {
  itemNo: string;      // B열: 품목코드
  englishName: string; // D열: 영문 품목명
  koreanName: string;  // E열: 한글 품목명
  supplyPrice?: number; // F열: 공급가
}

let cachedRiedelItems: RiedelItem[] | null = null;

/**
 * order-ai.xlsx의 Riedel 시트를 읽어서 RiedelItem[] 반환
 */
export function loadRiedelSheet(): RiedelItem[] {
  // 캐시가 있으면 재사용
  if (cachedRiedelItems) {
    return cachedRiedelItems;
  }

  const xlsxPath = path.join(process.cwd(), 'order-ai.xlsx');
  
  if (!fs.existsSync(xlsxPath)) {
    console.warn('[masterSheet] order-ai.xlsx not found:', xlsxPath);
    return [];
  }

  try {
    // 파일을 buffer로 읽기
    const buffer = fs.readFileSync(xlsxPath);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.find(
      (name) => name.toLowerCase() === 'riedel'
    );

    if (!sheetName) {
      console.warn('[masterSheet] Riedel sheet not found');
      return [];
    }

    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const items: RiedelItem[] = [];

    // Row 0은 타이틀, Row 1부터 데이터 시작
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // B열(index 1): 품목코드
      const itemNo = row[1]?.toString().trim();
      // D열(index 3): 영문명
      const englishName = row[3]?.toString().trim();
      // E열(index 4): 한글명
      const koreanName = row[4]?.toString().trim();

      // 필수 필드가 없으면 스킵
      if (!itemNo || !englishName || !koreanName) {
        continue;
      }

      // F열(index 5): 공급가
      const supplyPriceRaw = row[5];
      let supplyPrice: number | undefined = undefined;
      if (supplyPriceRaw != null) {
        const parsed = Number(supplyPriceRaw);
        if (!isNaN(parsed) && parsed > 0) {
          supplyPrice = parsed;
        }
      }

      items.push({
        itemNo,
        englishName,
        koreanName,
        supplyPrice,
      });
    }

    cachedRiedelItems = items;
    console.log(`[masterSheet] Loaded ${items.length} items from Riedel sheet`);
    return items;
  } catch (error) {
    console.error('[masterSheet] Error loading Riedel sheet:', error);
    return [];
  }
}
