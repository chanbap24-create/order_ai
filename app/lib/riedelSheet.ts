/**
 * riedelSheet.ts
 * order-ai.xlsx의 riedel 시트를 읽어서 신규 Glass 품목 매칭에 사용
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface RiedelItem {
  code: string;         // B열: 품목코드 (예: 4100/00R)
  koreanName: string;   // C열: 한글 품목명
  englishName: string;  // D열: 영문 품목명
  price: number;        // F열: 공급가
}

let cachedRiedelItems: RiedelItem[] | null = null;

/**
 * order-ai.xlsx의 riedel 시트를 읽어서 RiedelItem[] 반환
 */
export function loadRiedelSheet(): RiedelItem[] {
  // 캐시가 있으면 재사용
  if (cachedRiedelItems) {
    return cachedRiedelItems;
  }

  const xlsxPath = path.join(process.cwd(), 'order-ai.xlsx');
  
  if (!fs.existsSync(xlsxPath)) {
    console.warn('[riedelSheet] order-ai.xlsx not found:', xlsxPath);
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
      console.warn('[riedelSheet] riedel sheet not found');
      return [];
    }

    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const items: RiedelItem[] = [];

    // Row 5가 헤더, Row 6부터 데이터 시작
    for (let i = 6; i < data.length; i++) {
      const row = data[i];
      
      // B열(index 1): 코드
      const code = row[1]?.toString().trim();
      // C열(index 2): 한글명
      const koreanName = row[2]?.toString().trim();
      // D열(index 3): 영문명
      const englishName = row[3]?.toString().trim();
      // F열(index 5): 공급가
      const priceStr = row[5]?.toString().trim();
      const price = priceStr ? parseFloat(priceStr) : 0;

      // 필수 필드가 없으면 스킵
      if (!code || !koreanName) {
        continue;
      }

      items.push({
        code,
        koreanName,
        englishName: englishName || '',
        price,
      });
    }

    cachedRiedelItems = items;
    console.log(`[riedelSheet] Loaded ${items.length} items from riedel sheet`);
    return items;
  } catch (error) {
    console.error('[riedelSheet] Error loading Excel:', error);
    return [];
  }
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearRiedelSheetCache() {
  cachedRiedelItems = null;
}
