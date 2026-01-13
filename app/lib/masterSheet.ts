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
        const parsed = Number(supplyPriceRaw);
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
 * 캐시 초기화 (테스트용)
 */
export function clearMasterSheetCache() {
  cachedMasterItems = null;
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
