const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 정규화 함수 (부분 매칭 적용 전)
function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, '').replace(/[^a-z가-힣0-9]/g, '');
}

// 부분 매칭 점수 계산
function scoreWithPartialMatch(query, targetName) {
  const qTokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const nameTokens = targetName.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  
  if (qTokens.length < 2 || nameTokens.length < 1) {
    return 0;
  }
  
  let matchedQTokens = 0;
  
  for (const qt of qTokens) {
    // 정확 매칭
    if (nameTokens.includes(qt)) {
      matchedQTokens++;
      continue;
    }
    
    // 부분 매칭: "산타루치아" vs ["산타", "루치아"]
    const qtNorm = normalize(qt);
    let combined = "";
    for (const nt of nameTokens) {
      combined += normalize(nt);
      if (combined === qtNorm) {
        matchedQTokens++;
        break;
      }
      if (qtNorm.includes(combined) || combined.includes(qtNorm)) {
        matchedQTokens += 0.8;
        break;
      }
    }
  }
  
  const recall = matchedQTokens / qTokens.length;
  
  if (recall >= 0.8) {
    return Math.min(0.95, 0.80 + (recall * 0.15));
  }
  if (recall >= 0.6) {
    return Math.min(0.85, 0.65 + (recall * 0.20));
  }
  if (recall >= 0.5) {
    return Math.min(0.75, 0.55 + (recall * 0.20));
  }
  
  return 0;
}

// 마스터 시트 로드
const xlsxPath = path.join(process.cwd(), 'order-ai.xlsx');
const buffer = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buffer, { type: 'buffer' });
const sheet = wb.Sheets['English'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log("========== 마스터 시트 로드 ==========");
console.log(`총 ${data.length - 1}개 품목\n`);

// 검색 쿼리
const query = "크루 와이너리 산타루치아 몬테레이";
console.log(`검색: "${query}"\n`);

// 후보 찾기
const candidates = [];

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const itemNo = row[1]?.toString().trim();
  const englishName = row[7]?.toString().trim();
  const koreanName = row[8]?.toString().trim();
  
  if (!itemNo || !englishName || !koreanName) continue;
  
  // 부분 매칭 점수 계산
  const scoreKo = scoreWithPartialMatch(query, koreanName);
  const scoreEn = scoreWithPartialMatch(query, englishName);
  const score = Math.max(scoreKo, scoreEn);
  
  if (score > 0.3) {
    candidates.push({
      itemNo,
      koreanName,
      englishName,
      score
    });
  }
}

// 정렬
candidates.sort((a, b) => b.score - a.score);

console.log("========== 상위 5개 후보 ==========");
candidates.slice(0, 5).forEach((c, idx) => {
  const isTarget = c.itemNo === '2421505' ? ' ✅ 정답' : '';
  console.log(`${idx + 1}. ${c.itemNo}${isTarget}`);
  console.log(`   한글: ${c.koreanName}`);
  console.log(`   점수: ${c.score.toFixed(3)}\n`);
});

// 2421505 확인
const target = candidates.find(c => c.itemNo === '2421505');
if (target) {
  console.log("✅ 2421505 발견!");
  console.log(`   순위: ${candidates.indexOf(target) + 1}위`);
  console.log(`   점수: ${target.score.toFixed(3)}`);
} else {
  console.log("❌ 2421505를 찾지 못했습니다.");
}
