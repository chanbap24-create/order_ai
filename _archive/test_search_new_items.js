const { loadMasterSheet } = require('./app/lib/masterSheet.ts');
const { searchMasterSheet } = require('./app/lib/masterMatcher.ts');

// scoreItem 함수 (부분 매칭 적용)
function normTight(s) {
  return s.toLowerCase().replace(/\s+/g, "").replace(/[^a-z가-힣0-9]/g, "");
}

function scoreItem(q, name) {
  const qTokens = q.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const nameTokens = name.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  
  if (qTokens.length >= 2 && nameTokens.length >= 1) {
    const qSet = new Set(qTokens);
    const nameSet = new Set(nameTokens);
    
    let matchedQTokens = 0;
    let matchedNameTokens = 0;
    
    for (const qt of qTokens) {
      let found = false;
      
      if (nameSet.has(qt)) {
        matchedQTokens++;
        matchedNameTokens++;
        found = true;
        continue;
      }
      
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
console.log(`검색: "${query}"\n`);

// searchMasterSheet로 후보 가져오기
console.log("📋 Step 1: searchMasterSheet로 후보 가져오기...");
const masterCandidates = searchMasterSheet(query, 20);
console.log(`   → ${masterCandidates.length}개 후보 발견\n`);

// scoreItem으로 재점수 계산
console.log("🔄 Step 2: scoreItem으로 재점수 계산...\n");
const rescored = masterCandidates.map(item => {
  const koreanScore = scoreItem(query, item.koreanName);
  const englishScore = scoreItem(query, item.englishName);
  const maxScore = Math.max(koreanScore, englishScore);
  
  return {
    item_no: item.itemNo,
    korean_name: item.koreanName,
    english_name: item.englishName,
    original_score: item.score,
    new_score: maxScore,
  };
});

// 정렬
rescored.sort((a, b) => b.new_score - a.new_score);

console.log("========== 상위 5개 후보 (재점수 후) ==========");
rescored.slice(0, 5).forEach((c, idx) => {
  const isTarget = c.item_no === '2421505' ? ' ✅ 정답' : '';
  console.log(`${idx + 1}. ${c.item_no}${isTarget}`);
  console.log(`   한글: ${c.korean_name}`);
  console.log(`   기존 점수: ${c.original_score.toFixed(3)}`);
  console.log(`   새 점수: ${c.new_score.toFixed(3)}`);
  console.log(`   변화: ${((c.new_score - c.original_score) * 100).toFixed(1)}%\n`);
});

// 2421505 확인
const target = rescored.find(c => c.item_no === '2421505');
if (target) {
  console.log("✅ 2421505 발견!");
  console.log(`   순위: ${rescored.indexOf(target) + 1}위`);
  console.log(`   기존: ${target.original_score.toFixed(3)} → 새: ${target.new_score.toFixed(3)}`);
}
