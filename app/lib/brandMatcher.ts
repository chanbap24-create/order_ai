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
import XLSX from "xlsx";
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
function normalize(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[()\-_/.,'"]/g, "");
}

// ========== English 시트 캐싱 ==========
let cachedEnglishData: WineItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1분

function loadEnglishSheet(): WineItem[] {
  const now = Date.now();
  if (cachedEnglishData && now - cacheTimestamp < CACHE_TTL) {
    return cachedEnglishData;
  }

  const xlsxPath =
    process.env.ORDER_AI_XLSX_PATH || path.join(process.cwd(), "order-ai.xlsx");

  if (!fs.existsSync(xlsxPath)) {
    console.warn(`[BrandMatcher] order-ai.xlsx not found at ${xlsxPath}`);
    return [];
  }

  try {
    const workbook = XLSX.readFile(xlsxPath);
    const sheet = workbook.Sheets["English"];
    if (!sheet) {
      console.warn(`[BrandMatcher] 'English' sheet not found`);
      return [];
    }

    // 5행부터 데이터 시작 (3행=헤더, 4행=공백)
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      range: 4, // 5행부터
      header: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"],
      defval: "",
    });

    const items: WineItem[] = [];
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

    cachedEnglishData = items;
    cacheTimestamp = now;
    console.log(`[BrandMatcher] Loaded ${items.length} items from English sheet`);
    return items;
  } catch (err) {
    console.error(`[BrandMatcher] Failed to load English sheet:`, err);
    return [];
  }
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
  minScore = 0.5
): Array<WineItem & { score: number }> {
  const brandGroups = getItemsByBrand();
  const brandKey = normalize(brandInfo.supplier_en);

  const wines = brandGroups.get(brandKey) || [];
  if (wines.length === 0) {
    console.log(`[BrandMatcher] No wines found for brand: ${brandInfo.supplier_kr}`);
    return [];
  }

  const normalizedQuery = normalize(wineQuery);
  const results: Array<WineItem & { score: number }> = [];

  for (const wine of wines) {
    // 영문/한글 와인명 비교
    const scoreEn = stringSimilarity.compareTwoStrings(normalizedQuery, normalize(wine.wine_en));
    const scoreKr = stringSimilarity.compareTwoStrings(normalizedQuery, normalize(wine.wine_kr));
    const score = Math.max(scoreEn, scoreKr);

    if (score >= minScore) {
      results.push({ ...wine, score });
    }
  }

  // 점수 내림차순 정렬
  results.sort((a, b) => b.score - a.score);

  console.log(
    `[BrandMatcher] searchWineInBrand("${wineQuery}") in ${brandInfo.supplier_kr} → ${results.length} results`
  );

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
    const wines = searchWineInBrand(brand, preprocessed, wineMinScore);

    if (wines.length > 0) {
      results.push({ brand, wines });
    }
  }

  console.log(`[BrandMatcher] Found ${results.length} brand(s) with matching wines`);
  return results;
}
