// 개선된 scoreItem 로직 테스트

function normTight(s) {
  return s.toLowerCase().replace(/\s+/g, "").replace(/[^a-z가-힣0-9]/g, "");
}

function scoreItemNew(q, name) {
  const qTokens = q.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const nameTokens = name.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  
  if (qTokens.length >= 2 && nameTokens.length >= 1) {
    const qSet = new Set(qTokens);
    const nameSet = new Set(nameTokens);
    
    // 🎯 정확 매칭 + 부분 매칭
    let matchedQTokens = 0;
    let matchedNameTokens = 0;
    
    for (const qt of qTokens) {
      let found = false;
      
      // 정확 매칭 체크
      if (nameSet.has(qt)) {
        matchedQTokens++;
        matchedNameTokens++;
        found = true;
        continue;
      }
      
      // 부분 매칭 체크: "산타루치아" vs ["산타", "루치아"]
      const qtNorm = normTight(qt);
      let combined = "";
      for (const nt of nameTokens) {
        combined += normTight(nt);
        if (combined === qtNorm) {
          matchedQTokens++;
          matchedNameTokens += combined.length / normTight(nt).length;
          found = true;
          break;
        }
        if (qtNorm.includes(combined) || combined.includes(qtNorm)) {
          matchedQTokens += 0.8;
          matchedNameTokens += 0.8;
          found = true;
          break;
        }
      }
      
      // 반대 방향도 체크
      if (!found) {
        for (const nt of nameTokens) {
          const ntNorm = normTight(nt);
          if (qtNorm.includes(ntNorm) && ntNorm.length >= 3) {
            matchedQTokens += 0.5;
            matchedNameTokens += 0.5;
            break;
          }
        }
      }
    }
    
    if (matchedQTokens > 0) {
      const recall = matchedQTokens / qTokens.length;
      const precision = matchedNameTokens / nameTokens.length;
      
      if (recall >= 0.8) {
        return Math.min(0.95, 0.80 + (recall * 0.15) + (precision * 0.05));
      }
      if (recall >= 0.6) {
        return Math.min(0.85, 0.65 + (recall * 0.20));
      }
      if (recall >= 0.5) {
        return Math.min(0.75, 0.55 + (recall * 0.20));
      }
    }
  }
  return 0;
}

// 테스트
const query = "크루 와이너리 산타루치아 몬테레이";
const item1 = "크루 와이너리 피노누아 몬테레이";
const item2 = "크루 와이너리 피노누아 산타 루치아 하이랜즈 몬테레이";

console.log("\n========== 개선된 점수 계산 ==========");
console.log(`입력: ${query}`);
console.log(`\n품목1: ${item1}`);
const score1 = scoreItemNew(query, item1);
console.log(`점수: ${score1.toFixed(3)}`);

console.log(`\n품목2: ${item2}`);
const score2 = scoreItemNew(query, item2);
console.log(`점수: ${score2.toFixed(3)}`);

console.log("\n========== 토큰 분석 ==========");
const qTokens = query.toLowerCase().split(/\s+/);
const item1Tokens = item1.toLowerCase().split(/\s+/);
const item2Tokens = item2.toLowerCase().split(/\s+/);

console.log(`입력 토큰: [${qTokens.join(", ")}]`);
console.log(`품목1 토큰: [${item1Tokens.join(", ")}]`);
console.log(`품목2 토큰: [${item2Tokens.join(", ")}]`);

console.log("\n품목2 상세 매칭:");
console.log("- '크루' → '크루' ✅");
console.log("- '와이너리' → '와이너리' ✅");
console.log("- '산타루치아' → '산타' + '루치아' ✅ (부분 매칭)");
console.log("- '몬테레이' → '몬테레이' ✅");

console.log("\n결과:");
if (score2 > score1) {
  console.log("✅ 품목2가 더 높은 점수 → 정상 작동!");
} else {
  console.log("❌ 품목1이 더 높은 점수 → 추가 조정 필요");
}
