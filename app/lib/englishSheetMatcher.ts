/**
 * ========================================
 * English 시트 기반 품목 매칭
 * ========================================
 * 
 * English 시트의 H열(영어명)을 사용해서
 * 영어 검색어를 한글 품목 코드로 매칭
 */

import * as XLSX from 'xlsx';
import { db } from "@/app/lib/db";
import path from 'path';

interface EnglishMapping {
  code: string;
  englishName: string;
  koreanName?: string;
  supplyPrice?: number;
}

let englishMappingCache: Map<string, EnglishMapping> | null = null;

/**
 * English 시트 로드 및 캐싱
 */
function loadEnglishMapping(): Map<string, EnglishMapping> {
  if (englishMappingCache) {
    return englishMappingCache;
  }

  const mapping = new Map<string, EnglishMapping>();

  try {
    const xlsxPath = process.env.ORDER_AI_XLSX_PATH || path.join(process.cwd(), 'order-ai.xlsx');
    const workbook = XLSX.readFile(xlsxPath);

    if (!workbook.SheetNames.includes('English')) {
      console.log('⚠️  English 시트가 없습니다.');
      return mapping;
    }

    const sheet = workbook.Sheets['English'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // 헤더 스킵하고 데이터 로드
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const code = row[1];        // B열
      const englishName = row[7]; // H열
      const supplyPrice = row[11]; // L열 (공급가)

      if (code && englishName) {
        const codeStr = String(code).trim();
        
        // DB에서 한글명 가져오기
        try {
          const item = db.prepare('SELECT item_name FROM items WHERE item_no = ?').get(codeStr) as { item_name: string } | undefined;
          
          mapping.set(codeStr, {
            code: codeStr,
            englishName: String(englishName).trim(),
            koreanName: item?.item_name,
            supplyPrice: supplyPrice ? Number(supplyPrice) : undefined
          });
        } catch (err) {
          // DB 오류는 무시하고 계속
          mapping.set(codeStr, {
            code: codeStr,
            englishName: String(englishName).trim(),
            supplyPrice: supplyPrice ? Number(supplyPrice) : undefined
          });
        }
      }
    }

    englishMappingCache = mapping;
    console.log(`✅ English 시트 로드 완료: ${mapping.size}개 품목`);
  } catch (error) {
    console.error('❌ English 시트 로드 실패:', error);
  }

  return mapping;
}

/**
 * 정규화 함수 (공백, 특수문자 제거)
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['"'""\s\-_]/g, '')  // 따옴표, 공백, 하이픈 제거
    .replace(/é/g, 'e')             // 악센트 제거
    .replace(/[^\w가-힣]/g, '')    // 특수문자 제거
    .trim();
}

/**
 * English 시트에서 검색
 */
export function searchEnglishSheet(query: string): EnglishMapping[] {
  const mapping = loadEnglishMapping();
  
  if (mapping.size === 0) {
    return [];
  }

  // 정규화 전에 단어 추출 (공백으로 분리)
  const queryWords = query
    .toLowerCase()
    .replace(/['"'"",]/g, '') // 따옴표, 쉼표 제거
    .replace(/é/g, 'e')
    .split(/\s+/)
    .filter(w => w.length >= 3); // 3글자 이상만
  
  const matches: Array<EnglishMapping & { score: number }> = [];

  for (const [code, item] of mapping.entries()) {
    // 품목명도 단어로 분리
    const nameWords = item.englishName
      .toLowerCase()
      .replace(/['"'"",]/g, '')
      .replace(/é/g, 'e')
      .split(/\s+/)
      .filter(w => w.length >= 2);
    
    let score = 0;

    // 1) 완전 일치
    const normalizedQuery = normalize(query);
    const normalizedName = normalize(item.englishName);
    
    if (normalizedName === normalizedQuery) {
      score = 1.0;
    }
    // 2) 포함 관계
    else if (normalizedName.includes(normalizedQuery)) {
      score = 0.9;
    }
    else if (normalizedQuery.includes(normalizedName)) {
      score = 0.85;
    }
    // 3) 키워드 매칭 (단어 단위)
    else {
      const matchedWords = queryWords.filter(qw =>
        nameWords.some(nw => {
          // 정확히 일치하거나 포함 관계
          return nw === qw || nw.includes(qw) || qw.includes(nw);
        })
      );

      if (matchedWords.length > 0) {
        score = (matchedWords.length / queryWords.length) * 0.8;
      }
    }

    // 점수가 0.4 이상이면 후보로 추가 (임계값 낮춤)
    if (score >= 0.4) {
      matches.push({ ...item, score });
    }
  }

  // 점수 순으로 정렬
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * English 시트에서 품목 코드 찾기 (단일 결과)
 */
export function findItemCodeFromEnglish(query: string): string | null {
  const matches = searchEnglishSheet(query);
  
  if (matches.length > 0) {
    console.log(`✅ English 시트 매칭: [${matches[0].code}] ${matches[0].englishName}`);
    return matches[0].code;
  }

  return null;
}

/**
 * English 시트에서 여러 후보 찾기
 */
export function findMultipleFromEnglish(query: string, limit: number = 5): EnglishMapping[] {
  const matches = searchEnglishSheet(query);
  return matches.slice(0, limit);
}
