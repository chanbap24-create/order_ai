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
      // 영문명 (index 6)
      const englishName = row[6]?.toString().trim();
      // 한글명 (index 7)
      const koreanName = row[7]?.toString().trim();

      // 필수 필드가 없으면 스킵
      if (!itemNo || !koreanName) {
        continue;
      }

      // 빈티지 (index 8)
      let vintage = row[8]?.toString().trim();
      // 빈티지가 2자리 숫자면 연도로 변환 (예: "17" → "2017")
      if (vintage && vintage.length === 2) {
        const year = parseInt(vintage);
        vintage = year < 50 ? `20${vintage}` : `19${vintage}`;
      }

      // 공급가 (index 10)
      const supplyPriceRaw = row[10];
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
        englishName: englishName || '', // Downloads 시트에 영문명 추가
        koreanName,
        vintage,
        country: row[2]?.toString().trim(), // 국가 (index 2)
        producer: row[3]?.toString().trim(), // 생산자 (index 3)
        region: row[4]?.toString().trim(), // 지역 (index 4)
        supplyPrice, // 공급가 추가
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
 * English + Downloads 시트 통합 로드
 */
export function loadAllMasterItems(): MasterItem[] {
  const englishItems = loadMasterSheet();
  const downloadsItems = loadDownloadsSheet();
  
  // 중복 제거: item_no를 기준으로 English 우선
  const itemMap = new Map<string, MasterItem>();
  
  // Downloads 먼저 추가
  for (const item of downloadsItems) {
    itemMap.set(item.itemNo, item);
  }
  
  // English로 덮어쓰기 (우선순위)
  for (const item of englishItems) {
    itemMap.set(item.itemNo, item);
  }
  
  const allItems = Array.from(itemMap.values());
  console.log(`[masterSheet] Total items: ${allItems.length} (English: ${englishItems.length}, Downloads: ${downloadsItems.length})`);
  return allItems;
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearMasterSheetCache() {
  cachedMasterItems = null;
  cachedDownloadsItems = null;
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
