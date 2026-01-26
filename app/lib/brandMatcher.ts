/**
 * 🎯 2단계 계층적 검색: 생산자(브랜드) 우선 매칭
 * 
 * Step 1: 입력 자연어 → English 시트의 브랜드명(E열 영문, M열 한글)과 비교
 * Step 2: 유사도 0.6 이상인 브랜드의 와인들만 필터링 → 와인명 매칭
 * 
 * 예시:
 * - 입력: "클레멍라발레샤블리" 
 * - Step 1: "클레멍 라발리" (Clement Lavallee) 브랜드 매칭 (0.85 점)
 * - Step 2: 해당 브랜드 와인 중 "샤블리" 검색 → 3021049 CL 샤블리
 */

import { db } from "@/app/lib/db";
import stringSimilarity from "string-similarity";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { preprocessNaturalLanguage } from "@/app/lib/naturalLanguagePreprocessor";

// ========== 타입 정의 ==========
export interface BrandInfo {
  supplier_en: string;    // E열: 영문 생산자명 (예: Clement Lavallee)
  supplier_kr: string;    // M열: 한글 생산자명 (예: 클레멍 라발리)
  score: number;          // 유사도 점수 (0~1)
}

export interface WineItem {
  item_no: string;        // B열: 품목번호
  wine_en: string;        // H열: 영문 와인명
  wine_kr: string;        // I열: 한글 와인명
  supplier_en: string;    // E열
  supplier_kr: string;    // M열
  vintage?: string;       // J열: 빈티지
  volume?: number;        // K열: 용량
  price?: number;         // L열: 공급가
}

// ========== 정규화 함수 ==========
/**
 * 정규화: 소문자 + 공백/특수문자 제거 + 한글 자모 정규화
 * ✅ 한글 발음 유사 변환: ㅁ ↔ ㅇ (예: 클레멈 ↔ 클레멍)
 */
function normalize(s: string): string {
  let result = String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")  // ✅ 공백 완전 제거
    .trim()
    .replace(/[()\-_/.,'"]/g, "");
  
  // ✅ 한글 발음 유사 문자 정규화
  // "클레멈" (종성 ㅁ=16) → "클레멍" (종성 ㅇ=21) 변환
  const HANGUL_BASE = 0xAC00;
  const JONGSEONG_M = 16;  // ㅁ
  const JONGSEONG_NG = 21; // ㅇ
  
  result = result.replace(/./g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - HANGUL_BASE;
      const jongseong = offset % 28;
      
      // ㅁ → ㅇ 변환
      if (jongseong === JONGSEONG_M) {
        const newCode = code - JONGSEONG_M + JONGSEONG_NG;
        return String.fromCharCode(newCode);
      }
    }
    return char;
  });
  
  return result;
}

// ========== English + Downloads 시트 캐싱 ==========
let cachedEnglishData: WineItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 1000; // 10초 (개발용 - 운영 시 60초로 변경)

function loadEnglishSheet(): WineItem[] {
  const now = Date.now();
  if (cachedEnglishData && now - cacheTimestamp < CACHE_TTL) {
    return cachedEnglishData;
  }

  const xlsxPath =
    process.env.ORDER_AI_XLSX_PATH || path.join(process.cwd(), "order-ai.xlsx");

  console.log(`[BrandMatcher] Trying to load from: ${xlsxPath}`);
  console.log(`[BrandMatcher] File exists: ${fs.existsSync(xlsxPath)}`);
  console.log(`[BrandMatcher] process.cwd(): ${process.cwd()}`);

  if (!fs.existsSync(xlsxPath)) {
    console.warn(`[BrandMatcher] order-ai.xlsx not found at ${xlsxPath}`);
    return [];
  }

  try {
    const fileBuffer = fs.readFileSync(xlsxPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    const items: WineItem[] = [];
    
    // === English 시트 로드 ===
    const englishSheet = workbook.Sheets["English"];
    if (englishSheet) {
      // 5행부터 데이터 시작 (3행=헤더, 4행=공백)
      const jsonData = XLSX.utils.sheet_to_json(englishSheet, {
        range: 4, // 5행부터
        header: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"],
        defval: "",
      });

      for (const row of jsonData as any[]) {
        // B열(품목번호)이 없으면 스킵
        if (!row.B) continue;

        items.push({
          item_no: String(row.B || "").trim(),
          wine_en: String(row.H || "").trim(),
          wine_kr: String(row.I || "").trim(),
          supplier_en: String(row.E || "").trim(),
          supplier_kr: String(row.M || "").trim(),
          vintage: String(row.J || "").trim() || undefined,
          volume: row.K ? Number(row.K) : undefined,
          price: row.L ? Number(row.L) : undefined,
        });
      }
      console.log(`[BrandMatcher] Loaded ${items.length} items from English sheet`);
    }
    
    // === Downloads 시트 로드 (팔콘 등 추가 품목) ===
    const downloadsSheet = workbook.Sheets["Downloads"];
    if (downloadsSheet) {
      const downloadsData = XLSX.utils.sheet_to_json(downloadsSheet, {
        header: 1, // Row array 형태로 로드
        defval: "",
      }) as any[][];
      
      // Row 0: 헤더, Row 1부터 데이터
      const downloadsCount = items.length;
      for (let i = 1; i < downloadsData.length; i++) {
        const row = downloadsData[i];
        const item_no = String(row[1] || "").trim(); // 품번
        const wine_kr = String(row[2] || "").trim(); // 품명
        
        if (!item_no || !wine_kr) continue;
        
        // 빈티지 추출 (품번 3,4번째 자리)
        let vintage = undefined;
        if (item_no.length >= 4) {
          const vintageCode = item_no.substring(2, 4);
          const year = parseInt(vintageCode);
          if (!isNaN(year)) {
            vintage = year < 50 ? `20${vintageCode}` : `19${vintageCode}`;
          }
        }
        
        items.push({
          item_no,
          wine_en: "", // Downloads에는 영문명 없음
          wine_kr,
          supplier_en: "",
          supplier_kr: "",
          vintage,
          volume: undefined,
          price: undefined,
        });
      }
      console.log(`[BrandMatcher] Loaded ${items.length - downloadsCount} additional items from Downloads sheet`);
    }

    cachedEnglishData = items;
    cacheTimestamp = now;
    console.log(`[BrandMatcher] Total loaded: ${items.length} items`);
    return items;
  } catch (err) {
    console.error(`[BrandMatcher] Failed to load sheets:`, err);
    return [];
  }
}

// ========== 캐시 관리 ==========
export function clearBrandMatcherCache() {
  cachedEnglishData = null;
  cachedBrandGroups = null;
  cacheTimestamp = 0;
  console.log('[BrandMatcher] 캐시 초기화됨');
}

// ========== 생산자별 그룹화 캐싱 ==========
let cachedBrandGroups: Map<string, WineItem[]> | null = null;

function getItemsByBrand(): Map<string, WineItem[]> {
  if (cachedBrandGroups) return cachedBrandGroups;

  const items = loadEnglishSheet();
  const groups = new Map<string, WineItem[]>();

  for (const item of items) {
    // 영문 생산자명을 기준으로 그룹화 (정규화)
    const key = normalize(item.supplier_en);
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  cachedBrandGroups = groups;
  console.log(`[BrandMatcher] Grouped into ${groups.size} brands`);
  return groups;
}

// ========== 1단계: 생산자(브랜드) 매칭 ==========
/**
 * 입력 자연어에서 생산자(브랜드)를 매칭합니다.
 * 
 * 개선사항:
 * 1) 별칭 테이블(item_alias)로 먼저 확장 (VG → 뱅상 지라르댕)
 * 2) English 시트의 E열(영문), M열(한글)과 유사도 비교
 * 3) 부분 문자열 매칭도 지원 (클레멍라발리 ⊂ 클레멍라발리샤블리)
 */
export function matchBrand(input: string, minScore = 0.6): BrandInfo[] {
  const items = loadEnglishSheet();
  if (items.length === 0) return [];

  // 중복 제거: 생산자별로 한 번만
  const brandMap = new Map<string, { supplier_en: string; supplier_kr: string }>();
  for (const item of items) {
    const key = normalize(item.supplier_en);
    if (!key || brandMap.has(key)) continue;

    brandMap.set(key, {
      supplier_en: item.supplier_en,
      supplier_kr: item.supplier_kr,
    });
  }

  const normalizedInput = normalize(input);
  const candidates: BrandInfo[] = [];
  
  // ✅ 개선: 부분 문자열 매칭도 고려
  // 예: "클레멈라발리" ⊂ "클레멈라발리샤블리" → 0.8+ 점수

  for (const [key, brand] of brandMap) {
    // 토큰 분할은 정규화 **전**에 (공백이 있을 때)
    const brandTokensEn = brand.supplier_en.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
    const brandTokensKr = brand.supplier_kr.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    
    // 정규화 (공백 제거 포함)
    const normEn = normalize(brand.supplier_en);
    const normKr = normalize(brand.supplier_kr);
    
    // 영문/한글 둘 다 비교해서 높은 점수 채택
    let scoreEn = stringSimilarity.compareTwoStrings(normalizedInput, normEn);
    let scoreKr = stringSimilarity.compareTwoStrings(normalizedInput, normKr);
    
    // ✅ 부분 문자열 매칭 보너스
    // "클레멈라발리" ⊂ "클레멈라발리샤블리" → +0.2 보너스
    if (normalizedInput.includes(normEn) || normEn.includes(normalizedInput)) {
      scoreEn = Math.max(scoreEn, 0.75);
    }
    if (normalizedInput.includes(normKr) || normKr.includes(normalizedInput)) {
      scoreKr = Math.max(scoreKr, 0.75);
    }
    
    // ✅ 토큰 매칭 보너스 (브랜드 키워드가 입력에 포함되면)
    // 예: "로쉬벨렌" ⊂ "배산임수로쉬벨렌사비니레본"
    // 영문 토큰 매칭
    const enTokenMatches = brandTokensEn.filter(token => normalizedInput.includes(normalize(token))).length;
    if (enTokenMatches > 0 && brandTokensEn.length > 0) {
      const tokenScore = (enTokenMatches / brandTokensEn.length) * 0.8;
      scoreEn = Math.max(scoreEn, tokenScore);
    }
    
    // 한글 토큰 매칭
    const krTokenMatches = brandTokensKr.filter(token => normalizedInput.includes(normalize(token))).length;
    if (krTokenMatches > 0 && brandTokensKr.length > 0) {
      const tokenScore = (krTokenMatches / brandTokensKr.length) * 0.8;
      scoreKr = Math.max(scoreKr, tokenScore);
    }
    
    const score = Math.max(scoreEn, scoreKr);

    if (score >= minScore) {
      candidates.push({
        supplier_en: brand.supplier_en,
        supplier_kr: brand.supplier_kr,
        score,
      });
    }
  }

  // 점수 내림차순 정렬
  candidates.sort((a, b) => b.score - a.score);

  console.log(
    `[BrandMatcher] matchBrand("${input}") → ${candidates.length} candidates (minScore=${minScore})`
  );
  if (candidates.length > 0) {
    console.log(`[BrandMatcher] Top match: ${candidates[0].supplier_kr} (${candidates[0].score.toFixed(2)})`);
  }

  return candidates;
}

// ========== 2단계: 해당 브랜드의 와인만 검색 ==========
export function searchWineInBrand(
  brandInfo: BrandInfo,
  wineQuery: string,
  minScore = 0.3  // ✅ 임계값 낮춤 (브랜드 매칭 후이므로)
): Array<WineItem & { score: number }> {
  const brandGroups = getItemsByBrand();
  const brandKey = normalize(brandInfo.supplier_en);

  const wines = brandGroups.get(brandKey) || [];
  if (wines.length === 0) {
    console.log(`[BrandMatcher] No wines found for brand: ${brandInfo.supplier_kr}`);
    return [];
  }

  console.log(`[BrandMatcher] Searching ${wines.length} wines in brand: ${brandInfo.supplier_kr}`);

  const normalizedQuery = normalize(wineQuery);
  const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length >= 2);
  console.log(`[BrandMatcher] Query tokens:`, queryTokens);
  const results: Array<WineItem & { score: number }> = [];

  for (const wine of wines) {
    const normEn = normalize(wine.wine_en);
    const normKr = normalize(wine.wine_kr);
    
    // ✅ 개선: 문자열 유사도 + 토큰 매칭
    let scoreEn = stringSimilarity.compareTwoStrings(normalizedQuery, normEn);
    let scoreKr = stringSimilarity.compareTwoStrings(normalizedQuery, normKr);
    
    // 토큰 매칭 보너스 (쿼리 토큰 중 와인명에 포함된 비율)
    const tokenMatchCount = queryTokens.filter(token => 
      normEn.includes(token) || normKr.includes(token)
    ).length;
    
    if (tokenMatchCount > 0 && queryTokens.length > 0) {
      const tokenBonus = (tokenMatchCount / queryTokens.length) * 0.5;
      scoreEn = Math.max(scoreEn, tokenBonus);
      scoreKr = Math.max(scoreKr, tokenBonus);
    }
    
    const score = Math.max(scoreEn, scoreKr);
    
    // Debug first wine
    if (wines.indexOf(wine) === 0) {
      console.log(`[BrandMatcher] First wine: "${wine.wine_kr}"`);
      console.log(`[BrandMatcher]   normKr: "${normKr}"`);
      console.log(`[BrandMatcher]   scoreKr: ${scoreKr.toFixed(3)}, tokenMatches: ${tokenMatchCount}/${queryTokens.length}, final: ${score.toFixed(3)}`);
    }

    if (score >= minScore) {
      results.push({ ...wine, score });
    }
  }

  // 점수 내림차순 정렬
  results.sort((a, b) => b.score - a.score);

  console.log(
    `[BrandMatcher] searchWineInBrand("${wineQuery}") in ${brandInfo.supplier_kr} → ${results.length} results`
  );
  
  // 상위 3개 결과 로깅
  if (results.length > 0) {
    console.log(`[BrandMatcher] Top wines:`);
    results.slice(0, 3).forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.wine_kr} (${w.score.toFixed(3)})`);
    });
  }

  return results;
}

// ========== 통합 검색: 별칭 확장 → 브랜드 → 와인 ==========
export interface HierarchicalSearchResult {
  brand: BrandInfo;
  wines: Array<WineItem & { score: number }>;
}

/**
 * 🎯 통합 검색: 별칭 확장 + 브랜드 우선 매칭
 * 
 * Step 0: 별칭 확장 (VG → 뱅상 지라르댕)
 * Step 1: 브랜드 매칭
 * Step 2: 해당 브랜드의 와인만 검색
 */
export function hierarchicalSearch(
  input: string,
  brandMinScore = 0.6,
  wineMinScore = 0.5,
  topBrands = 3
): HierarchicalSearchResult[] {
  console.log(`[BrandMatcher] hierarchicalSearch("${input}")`);

  // ✅ Step 0: 별칭 확장 (VG → 뱅상 지라르댕, cl → 클레멍 라발리)
  const preprocessed = preprocessNaturalLanguage(input);
  console.log(`[BrandMatcher] After alias expansion: "${preprocessed}"`);

  // Step 1: 브랜드 매칭
  const brandCandidates = matchBrand(preprocessed, brandMinScore);
  if (brandCandidates.length === 0) {
    console.log(`[BrandMatcher] No brand matched for "${preprocessed}"`);
    return [];
  }

  // Step 2: 상위 N개 브랜드에서 와인 검색
  const results: HierarchicalSearchResult[] = [];
  for (let i = 0; i < Math.min(topBrands, brandCandidates.length); i++) {
    const brand = brandCandidates[i];
    
    // ✅ 브랜드명 제거 후 와인 검색
    // 예: "배산임수 클레멈 라발리 샤블리" → "샤블리" (브랜드명 제거)
    let wineQuery = preprocessed;
    
    // 영문/한글 브랜드명 모두 제거
    const brandEn = normalize(brand.supplier_en);
    const brandKr = normalize(brand.supplier_kr);
    const queryNorm = normalize(wineQuery);
    
    // 정규화된 문자열에서 브랜드명 제거 + 잡음 제거
    let cleanQuery = queryNorm
      .replace(new RegExp(brandEn, 'gi'), ' ')
      .replace(new RegExp(brandKr, 'gi'), ' ')
      // 흔한 약어 제거 (cl, vg 등은 이미 별칭 확장됨)
      .replace(/\b(cl|vg|rf|dd|lr|ps|ck|hp|em|ch|at|lb|bl|mr|lm|pe|ar)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 원본 입력에서 와인 키워드 추출 (영문/한글 3글자 이상)
    const wineKeywords = input.match(/([가-힣]{2,}|[A-Za-z]{3,})/g) || [];
    const filteredKeywords = wineKeywords.filter(kw => {
      const kwNorm = normalize(kw);
      // 브랜드명에 포함되지 않은 키워드만
      return !brandEn.includes(kwNorm) && !brandKr.includes(kwNorm);
    }).join(' ');
    
    // 정제된 쿼리가 비어있으면 키워드 기반으로 검색
    if (!cleanQuery || cleanQuery.length < 2) {
      cleanQuery = filteredKeywords;
    }
    
    console.log(`[BrandMatcher] Wine query after brand removal: "${queryNorm}" → "${cleanQuery}"`);
    
    const wines = searchWineInBrand(brand, cleanQuery || preprocessed, wineMinScore);

    if (wines.length > 0) {
      results.push({ brand, wines });
    }
  }

  console.log(`[BrandMatcher] Found ${results.length} brand(s) with matching wines`);
  return results;
}
