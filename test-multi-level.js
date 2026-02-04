/**
 * 다단계 토큰 매칭 테스트 (JavaScript)
 */

// N-gram 생성 함수
function normTight(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

function generateNGrams(text, n) {
  if (!text || text.length < n) return [];
  
  const normalized = normTight(text);
  const ngrams = [];
  
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.push(normalized.substring(i, i + n));
  }
  
  return ngrams;
}

function generateWordTokens(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .map(t => normTight(t));
}

// 매칭 함수들
function charLevelMatch(query, target) {
  const queryChars = generateNGrams(query, 1);
  const targetChars = generateNGrams(target, 1);
  
  if (queryChars.length === 0 || targetChars.length === 0) return 0;
  
  const querySet = new Set(queryChars);
  const targetSet = new Set(targetChars);
  
  const intersection = new Set(
    [...querySet].filter(ch => targetSet.has(ch))
  );
  
  const recall = intersection.size / querySet.size;
  const precision = intersection.size / targetSet.size;
  
  if (recall + precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

function bigramMatch(query, target) {
  const queryBigrams = generateNGrams(query, 2);
  const targetBigrams = generateNGrams(target, 2);
  
  if (queryBigrams.length === 0 || targetBigrams.length === 0) return 0;
  
  const querySet = new Set(queryBigrams);
  const targetSet = new Set(targetBigrams);
  
  const intersection = new Set(
    [...querySet].filter(bg => targetSet.has(bg))
  );
  
  const recall = intersection.size / querySet.size;
  const precision = intersection.size / targetSet.size;
  
  if (recall + precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

function trigramMatch(query, target) {
  const queryTrigrams = generateNGrams(query, 3);
  const targetTrigrams = generateNGrams(target, 3);
  
  if (queryTrigrams.length === 0 || targetTrigrams.length === 0) return 0;
  
  const querySet = new Set(queryTrigrams);
  const targetSet = new Set(targetTrigrams);
  
  const intersection = new Set(
    [...querySet].filter(tg => targetSet.has(tg))
  );
  
  const recall = intersection.size / querySet.size;
  const precision = intersection.size / targetSet.size;
  
  if (recall + precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

function wordLevelMatch(query, target) {
  const queryWords = generateWordTokens(query);
  const targetWords = generateWordTokens(target);
  
  if (queryWords.length === 0 || targetWords.length === 0) return 0;
  
  const querySet = new Set(queryWords);
  const targetSet = new Set(targetWords);
  
  let matchedQuery = 0;
  
  // 완전 일치 체크
  for (const qw of queryWords) {
    if (targetSet.has(qw)) {
      matchedQuery++;
    }
  }
  
  // 부분 일치 체크
  for (const qw of queryWords) {
    if (matchedQuery >= queryWords.length) break;
    
    let found = false;
    for (const tw of targetWords) {
      if (!found && tw.includes(qw) && qw.length >= 2) {
        matchedQuery += 0.8;
        found = true;
        break;
      }
      if (!found && qw.includes(tw) && tw.length >= 2) {
        matchedQuery += 0.8;
        found = true;
        break;
      }
    }
  }
  
  // Recall 중심 점수
  const recall = matchedQuery / queryWords.length;
  
  // 쿼리 토큰이 모두 매칭되면 높은 점수
  if (recall >= 0.95) {
    return 1.0;
  } else if (recall >= 0.85) {
    return 0.95;
  } else if (recall >= 0.75) {
    return 0.85;
  } else if (recall >= 0.65) {
    return 0.75;
  } else {
    return recall;
  }
}

function multiLevelTokenMatch(query, target, weights) {
  if (!query || !target) return { score: 0, details: { level1: 0, level2: 0, level3: 0, level4: 0 } };
  
  const level1 = charLevelMatch(query, target);
  const level2 = bigramMatch(query, target);
  const level3 = trigramMatch(query, target);
  const level4 = wordLevelMatch(query, target);
  
  // 🎯 가중치 자동 결정 (짧은 쿼리 vs 긴 쿼리)
  let finalWeights;
  
  if (weights) {
    finalWeights = weights;
  } else {
    const queryLength = normTight(query).length;
    
    if (queryLength <= 4) {
      // 짧은 쿼리 (예: "샤블리", "팔콘")
      // → Word-level 중요도 증가
      finalWeights = [0.05, 0.10, 0.20, 0.65];
    } else if (queryLength <= 8) {
      // 중간 쿼리 (예: "루이미셸", "샤블리비에유")
      // → Bigram/Trigram 중요도 증가
      finalWeights = [0.05, 0.15, 0.30, 0.50];
    } else {
      // 긴 쿼리 (예: "루이 미셸 샤블리 그랑크뤼")
      // → 모든 레벨 균형
      finalWeights = [0.05, 0.15, 0.25, 0.55];
    }
  }
  
  const score = Math.min(1.0,
    level1 * finalWeights[0] +
    level2 * finalWeights[1] +
    level3 * finalWeights[2] +
    level4 * finalWeights[3]
  );
  
  return {
    score,
    details: {
      level1: Math.round(level1 * 1000) / 1000,
      level2: Math.round(level2 * 1000) / 1000,
      level3: Math.round(level3 * 1000) / 1000,
      level4: Math.round(level4 * 1000) / 1000,
    }
  };
}

// 테스트 실행
console.log("🧪 다단계 토큰 매칭 테스트 시작\n");

const testCases = [
  {
    name: "완벽 매칭",
    query: "루이미셸 샤블리",
    target: "루이미셸 샤블리",
    expected: "> 0.95"
  },
  {
    name: "공백 차이",
    query: "루이미셸 샤블리",
    target: "루이 미셸, 샤블리",
    expected: "> 0.85"
  },
  {
    name: "추가 정보 포함",
    query: "루이미셸 샤블리",
    target: "루이 미셸 에피, 샤블리 그랑크뤼 '그르누이'",
    expected: "> 0.70"
  },
  {
    name: "생산자 + 품목",
    query: "샤블리",
    target: "메종 로쉬 벨렌, 샤블리 비에유비뉴",
    expected: "> 0.50"
  },
  {
    name: "짧은 검색어",
    query: "샤블리",
    target: "클레멍 라발리, 샤블리",
    expected: "> 0.50"
  },
  {
    name: "다양한 브랜드",
    query: "샤블리",
    target: "루이 미셸 에피, 샤블리 1er Cru '몬테 드 토네흐'",
    expected: "> 0.50"
  },
  {
    name: "팔콘 검색",
    query: "팔콘",
    target: "레이크 찰리스, 팔콘 소비뇽 블랑",
    expected: "> 0.50"
  },
  {
    name: "LC 팔콘",
    query: "팔콘",
    target: "LC 레이크 찰리스 팔콘 소비뇽 블랑",
    expected: "> 0.50"
  },
  {
    name: "미스매칭",
    query: "샤블리",
    target: "샤또 마고",
    expected: "< 0.50"
  },
  {
    name: "완전 미스매칭",
    query: "루이미셸",
    target: "돔 페리뇽",
    expected: "< 0.30"
  }
];

console.log("=".repeat(100));
console.log("Test | Name            | Query → Target                           | Score | L1   | L2   | L3   | L4   | Result");
console.log("=".repeat(100));

let passCount = 0;
let failCount = 0;

testCases.forEach((tc, idx) => {
  const result = multiLevelTokenMatch(tc.query, tc.target);
  
  let pass = false;
  if (tc.expected.startsWith(">")) {
    const threshold = parseFloat(tc.expected.substring(1).trim());
    pass = result.score >= threshold;
  } else if (tc.expected.startsWith("<")) {
    const threshold = parseFloat(tc.expected.substring(1).trim());
    pass = result.score < threshold;
  }
  
  if (pass) passCount++;
  else failCount++;
  
  const status = pass ? "✅ PASS" : "❌ FAIL";
  
  console.log(
    `${(idx + 1).toString().padStart(2)}   |`,
    `${tc.name.padEnd(15)} |`,
    `${tc.query.substring(0, 10).padEnd(10)} →`,
    `${tc.target.substring(0, 25).padEnd(25)} |`,
    `${result.score.toFixed(3)} |`,
    `${result.details.level1.toFixed(2)} |`,
    `${result.details.level2.toFixed(2)} |`,
    `${result.details.level3.toFixed(2)} |`,
    `${result.details.level4.toFixed(2)} |`,
    status
  );
});

console.log("=".repeat(100));
console.log(`\n📊 결과: ${passCount}/${testCases.length} 통과 (${failCount} 실패)\n`);

// Quick Word Match 테스트
console.log("\n🚀 샤블리 검색 테스트\n");

const items = [
  "메종 로쉬 벨렌, 샤블리 비에유비뉴",
  "클레멍 라발리, 샤블리",
  "루이 미셸 에피, 샤블리 그랑크뤼 '그르누이'",
  "루이 미셸 에피, 샤블리 1er Cru '몬테 드 토네흐'",
  "CL 샤블리",
  "샤또 마고",
  "돔 페리뇽",
  "레이크 찰리스, 팔콘 소비뇽 블랑",
  "LC 레이크 찰리스 팔콘 소비뇽 블랑",
];

const query = "샤블리";
console.log(`검색어: "${query}"\n`);

const scored = items
  .map(item => {
    const result = multiLevelTokenMatch(query, item);
    return { item, score: result.score };
  })
  .filter(x => x.score > 0.3)
  .sort((a, b) => b.score - a.score);

console.log("순위 | 점수  | 품목명");
console.log("-".repeat(80));
scored.forEach((s, idx) => {
  console.log(
    `${(idx + 1).toString().padStart(2)}.  |`,
    `${s.score.toFixed(3)} |`,
    s.item
  );
});

console.log("\n✅ 테스트 완료!");
