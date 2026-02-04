#!/usr/bin/env ts-node
/**
 * 다단계 토큰 매칭 테스트
 */

import { multiLevelTokenMatchWithDetails, quickWordMatch } from './app/lib/multiLevelTokenMatcher';

console.log("🧪 다단계 토큰 매칭 테스트 시작\n");

// 테스트 케이스 정의
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
    expected: "> 0.75"
  },
  {
    name: "생산자 + 품목",
    query: "샤블리",
    target: "메종 로쉬 벨렌, 샤블리 비에유비뉴",
    expected: "> 0.60"
  },
  {
    name: "짧은 검색어",
    query: "샤블리",
    target: "클레멍 라발리, 샤블리",
    expected: "> 0.60"
  },
  {
    name: "다양한 브랜드",
    query: "샤블리",
    target: "루이 미셸 에피, 샤블리 1er Cru '몬테 드 토네흐'",
    expected: "> 0.60"
  },
  {
    name: "팔콘 검색",
    query: "팔콘",
    target: "레이크 찰리스, 팔콘 소비뇽 블랑",
    expected: "> 0.60"
  },
  {
    name: "LC 팔콘",
    query: "팔콘",
    target: "LC 레이크 찰리스 팔콘 소비뇽 블랑",
    expected: "> 0.60"
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

console.log("=" .repeat(80));
console.log("Test Case | Query → Target | Score | L1 | L2 | L3 | L4 | Result");
console.log("=".repeat(80));

let passCount = 0;
let failCount = 0;

testCases.forEach((tc, idx) => {
  const result = multiLevelTokenMatchWithDetails(tc.query, tc.target);
  
  // 예상 결과 체크
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
    `${(idx + 1).toString().padStart(2)}.`,
    `${tc.name.padEnd(15)} |`,
    `${tc.query.substring(0, 10).padEnd(10)} →`,
    `${tc.target.substring(0, 20).padEnd(20)} |`,
    `${result.score.toFixed(3)} |`,
    `${result.details.level1.toFixed(2)} |`,
    `${result.details.level2.toFixed(2)} |`,
    `${result.details.level3.toFixed(2)} |`,
    `${result.details.level4.toFixed(2)} |`,
    status
  );
});

console.log("=".repeat(80));
console.log(`\n📊 결과: ${passCount}/${testCases.length} 통과 (${failCount} 실패)\n`);

// Quick Word Match 테스트
console.log("\n🚀 Pre-filtering 성능 테스트 (quickWordMatch)\n");

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
  .map(item => ({
    item,
    score: quickWordMatch(query, item)
  }))
  .filter(x => x.score > 0.3)
  .sort((a, b) => b.score - a.score);

console.log("순위 | 점수 | 품목명");
console.log("-".repeat(80));
scored.forEach((s, idx) => {
  console.log(
    `${(idx + 1).toString().padStart(2)}. |`,
    `${s.score.toFixed(3)} |`,
    s.item
  );
});

console.log("\n✅ 테스트 완료!");
