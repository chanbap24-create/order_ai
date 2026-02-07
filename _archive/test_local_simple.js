// 간단한 로컬 테스트 - 부분 매칭 함수만 테스트

function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, '').replace(/[^a-z가-힣0-9]/g, '');
}

function partialTokenMatch(query, targetName) {
  const qTokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const nameTokens = targetName.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  
  if (qTokens.length < 2 || nameTokens.length < 1) {
    return 0;
  }
  
  const qSet = new Set(qTokens);
  const nameSet = new Set(nameTokens);
  
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
    const qtNorm = normalize(qt);
    let combined = "";
    for (const nt of nameTokens) {
      combined += normalize(nt);
      if (combined === qtNorm) {
        matchedQTokens++;
        matchedNameTokens += combined.length / normalize(nt).length;
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
        const ntNorm = normalize(nt);
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
  
  return 0;
}

// 테스트 케이스
const query = "크루 와이너리 산타루치아 몬테레이";

const candidates = [
  { no: '2421505', name: '크루 와이너리 피노누아 산타 루치아 하이랜즈 몬테레이' },
  { no: '3420501', name: '크루 와이너리 샤르도네 산타 루치아 하이랜즈 몬테레이' },
  { no: '2418531', name: '크루 와이너리 피노누아 몬테레이' },
  { no: '3421503', name: '크루 와이너리 언오크드 샤르도네 아로요세코 몬테레이' },
];

console.log('========== 부분 매칭 테스트 ==========');
console.log('검색:', query);
console.log('');

const results = candidates.map(c => ({
  ...c,
  score: partialTokenMatch(query, c.name)
}));

results.sort((a, b) => b.score - a.score);

results.forEach((r, idx) => {
  const isCorrect = r.no === '2421505' || r.no === '3420501';
  const label = isCorrect ? ' ✅' : '';
  console.log(`${idx + 1}위. [${r.no}]${label}`);
  console.log(`     점수: ${r.score.toFixed(3)}`);
  console.log(`     품목: ${r.name}`);
  console.log('');
});

console.log('========== 판정 ==========');
const rank2421505 = results.findIndex(r => r.no === '2421505') + 1;
const rank3420501 = results.findIndex(r => r.no === '3420501') + 1;
const rank2418531 = results.findIndex(r => r.no === '2418531') + 1;

console.log(`2421505 (정답): ${rank2421505}위`);
console.log(`3420501 (정답): ${rank3420501}위`);
console.log(`2418531 (오답): ${rank2418531}위`);

if (rank2421505 === 1 && rank3420501 === 2) {
  console.log('\n✅✅✅ 테스트 완전 성공!');
  console.log('- 정답 품목들이 1, 2위 차지');
  console.log('- 부분 매칭 로직이 정상 작동');
} else if (rank2421505 <= 2 && rank3420501 <= 2 && rank2421505 < rank2418531) {
  console.log('\n✅✅ 테스트 성공!');
  console.log('- 정답 품목들이 상위권');
  console.log('- 산타 루치아 품목이 일반 몬테레이보다 높은 순위');
} else {
  console.log('\n❌ 테스트 실패');
  console.log('- 순위가 예상과 다름');
}
