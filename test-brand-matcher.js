/**
 * 브랜드 매칭 테스트 스크립트
 * 
 * TypeScript를 직접 실행할 수 없으므로 로직을 JavaScript로 재현
 */

const stringSimilarity = require("string-similarity");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// 정규화 함수
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[()\-_/.,'"]/g, "");
}

// English 시트 로드
function loadEnglishSheet() {
  const xlsxPath = path.join(__dirname, "order-ai.xlsx");

  if (!fs.existsSync(xlsxPath)) {
    console.error(`❌ order-ai.xlsx not found at ${xlsxPath}`);
    return [];
  }

  try {
    const workbook = XLSX.readFile(xlsxPath);
    const sheet = workbook.Sheets["English"];
    if (!sheet) {
      console.error(`❌ 'English' sheet not found`);
      return [];
    }

    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      range: 4, // 5행부터
      header: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"],
      defval: "",
    });

    const items = [];
    for (const row of jsonData) {
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

    console.log(`✅ Loaded ${items.length} items from English sheet`);
    return items;
  } catch (err) {
    console.error(`❌ Failed to load English sheet:`, err.message);
    return [];
  }
}

// 브랜드 매칭
function matchBrand(items, input, minScore = 0.6) {
  const brandMap = new Map();
  for (const item of items) {
    const key = normalize(item.supplier_en);
    if (!key || brandMap.has(key)) continue;

    brandMap.set(key, {
      supplier_en: item.supplier_en,
      supplier_kr: item.supplier_kr,
    });
  }

  const normalizedInput = normalize(input);
  const candidates = [];

  for (const [key, brand] of brandMap) {
    const scoreEn = stringSimilarity.compareTwoStrings(
      normalizedInput,
      normalize(brand.supplier_en)
    );
    const scoreKr = stringSimilarity.compareTwoStrings(
      normalizedInput,
      normalize(brand.supplier_kr)
    );
    const score = Math.max(scoreEn, scoreKr);

    if (score >= minScore) {
      candidates.push({
        supplier_en: brand.supplier_en,
        supplier_kr: brand.supplier_kr,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// 브랜드별 와인 그룹화
function getItemsByBrand(items) {
  const groups = new Map();

  for (const item of items) {
    const key = normalize(item.supplier_en);
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  return groups;
}

// 특정 브랜드에서 와인 검색
function searchWineInBrand(brandGroups, brandInfo, wineQuery, minScore = 0.5) {
  const brandKey = normalize(brandInfo.supplier_en);
  const wines = brandGroups.get(brandKey) || [];

  if (wines.length === 0) {
    return [];
  }

  const normalizedQuery = normalize(wineQuery);
  const results = [];

  for (const wine of wines) {
    const scoreEn = stringSimilarity.compareTwoStrings(
      normalizedQuery,
      normalize(wine.wine_en)
    );
    const scoreKr = stringSimilarity.compareTwoStrings(
      normalizedQuery,
      normalize(wine.wine_kr)
    );
    const score = Math.max(scoreEn, scoreKr);

    if (score >= minScore) {
      results.push({ ...wine, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// 통합 검색
function hierarchicalSearch(items, input, brandMinScore = 0.6, wineMinScore = 0.5, topBrands = 3) {
  console.log(`\n🔍 hierarchicalSearch("${input}")`);
  console.log(`   brandMinScore=${brandMinScore}, wineMinScore=${wineMinScore}, topBrands=${topBrands}\n`);

  // ✅ Step 0: 별칭 확장 (VG → 뱅상 지라르댕)
  const preprocessed = expandAliases(input);
  if (preprocessed !== input) {
    console.log(`✅ Step 0: Alias expansion "${input}" → "${preprocessed}"\n`);
  }

  // Step 1: 브랜드 매칭
  const brandCandidates = matchBrand(items, preprocessed, brandMinScore);
  if (brandCandidates.length === 0) {
    console.log(`❌ No brand matched for "${preprocessed}"`);
    return [];
  }

  console.log(`✅ Step 1: Found ${brandCandidates.length} brand(s)`);
  brandCandidates.slice(0, 5).forEach((brand, idx) => {
    console.log(`   ${idx + 1}. ${brand.supplier_kr} (${brand.supplier_en}) - Score: ${brand.score.toFixed(3)}`);
  });

  // Step 2: 브랜드별 그룹화
  const brandGroups = getItemsByBrand(items);

  // Step 3: 상위 N개 브랜드에서 와인 검색
  const results = [];
  console.log(`\n✅ Step 2: Search wines in top ${topBrands} brand(s)\n`);

  for (let i = 0; i < Math.min(topBrands, brandCandidates.length); i++) {
    const brand = brandCandidates[i];
    console.log(`   🏷️  Brand ${i + 1}: ${brand.supplier_kr}`);

    const wines = searchWineInBrand(brandGroups, brand, preprocessed, wineMinScore);

    if (wines.length > 0) {
      console.log(`      ✅ Found ${wines.length} wine(s):`);
      wines.slice(0, 3).forEach((wine) => {
        console.log(`         - ${wine.item_no} ${wine.wine_kr} (Score: ${wine.score.toFixed(3)})`);
      });
      results.push({ brand, wines });
    } else {
      console.log(`      ❌ No wines matched`);
    }
  }

  console.log(`\n📊 Final: ${results.length} brand(s) with matching wines\n`);
  return results;
}

// ========== 별칭 확장 로직 추가 ==========
const dbPath = path.join(__dirname, "data.sqlite3");
const aliasDb = new Database(dbPath);

function expandAliases(text, maxDepth = 3) {
  try {
    const aliases = aliasDb.prepare("SELECT alias, canonical FROM item_alias ORDER BY LENGTH(alias) DESC").all();

    const aliasMap = new Map();
    aliases.forEach((a) => {
      aliasMap.set(a.alias.toLowerCase(), a.canonical);
    });

    let expanded = text;
    let prevExpanded = "";
    let depth = 0;

    // 재귀적 확장 (최대 maxDepth번)
    while (expanded !== prevExpanded && depth < maxDepth) {
      prevExpanded = expanded;
      depth++;

      // 1. 단어별 확장 (공백으로 분리된 경우)
      const words = expanded.split(/(\s+|[,()\/\-])/);
      const expandedWords = words.map((word) => {
        const lowerWord = word.toLowerCase();
        if (aliasMap.has(lowerWord)) {
          return aliasMap.get(lowerWord);
        }
        return word;
      });

      expanded = expandedWords.join("");

      // 2. 부분 문자열 확장 (띄어쓰기 없는 경우)
      for (const [alias, canonical] of aliasMap) {
        if (alias.length >= 4) {
          const regex = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          expanded = expanded.replace(regex, canonical + ' ');
        }
      }

      expanded = expanded.trim();
    }

    return expanded;
  } catch (err) {
    console.error("별칭 확장 실패:", err.message);
    return text;
  }
}

// ========== 메인 테스트 ==========
console.log("=" .repeat(80));
console.log("🧪 브랜드 매칭 테스트".padStart(50));
console.log("=".repeat(80));

const items = loadEnglishSheet();

if (items.length === 0) {
  console.error("\n❌ No items loaded. Exiting...");
  process.exit(1);
}

// 테스트 케이스
const testCases = [
  { input: "클레멍라발레샤블리", brandMin: 0.5, wineMin: 0.5 },  // 낮춘 임계값
  { input: "클레멈라발리샤블리", brandMin: 0.5, wineMin: 0.5 },
  { input: "VG 샤블리", brandMin: 0.5, wineMin: 0.5 },
  { input: "라피니 클래식", brandMin: 0.5, wineMin: 0.5 },
  { input: "cl 샤블리", brandMin: 0.5, wineMin: 0.5 },
  { input: "뱅상지라르댕", brandMin: 0.5, wineMin: 0.5 },
];

testCases.forEach((tc, idx) => {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`테스트 ${idx + 1}/${testCases.length}`);
  console.log("=".repeat(80));
  hierarchicalSearch(items, tc.input, tc.brandMin, tc.wineMin);
});

console.log("\n" + "=".repeat(80));
console.log("✅ 테스트 완료".padStart(50));
console.log("=".repeat(80) + "\n");
