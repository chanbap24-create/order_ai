const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// normalize 함수
function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, '').replace(/[^a-z가-힣0-9]/g, '');
}

// 부분 매칭 점수 계산
function partialTokenMatch(query, targetName) {
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
    let foundPartial = false;
    
    for (const nt of nameTokens) {
      combined += normalize(nt);
      if (combined === qtNorm) {
        matchedQTokens++;
        foundPartial = true;
        break;
      }
      if (qtNorm.includes(combined) || combined.includes(qtNorm)) {
        matchedQTokens += 0.8;
        foundPartial = true;
        break;
      }
    }
    
    // 반대 방향
    if (!foundPartial) {
      for (const nt of nameTokens) {
        const ntNorm = normalize(nt);
        if (qtNorm.includes(ntNorm) && ntNorm.length >= 3) {
          matchedQTokens += 0.5;
          break;
        }
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

// 거래처 코드 찾기
const db = new Database('data.sqlite3', { readonly: true });

console.log('========== 거래처 검색: 몽도 ==========');
const clientRows = db.prepare(`
  SELECT client_code, client_name 
  FROM clients 
  WHERE client_name LIKE '%몽도%'
  LIMIT 5
`).all();

if (clientRows.length === 0) {
  console.log('❌ 몽도 거래처를 찾을 수 없습니다.');
  process.exit(1);
}

console.log('검색 결과:');
clientRows.forEach((row, idx) => {
  console.log(`${idx + 1}. [${row.client_code}] ${row.client_name}`);
});

const clientCode = clientRows[0].client_code;
console.log(`\n선택: [${clientCode}] ${clientRows[0].client_name}\n`);

// 테스트 케이스
const testItems = [
  { name: '바롤로', qty: 3 },
  { name: '루이미셸 샤블리', qty: 5 },
  { name: '리아타 소노마 코스트 샤르도네', qty: 3 },
  { name: '크루 와이너리 산타루치아 몬테레이', qty: 3 },
];

console.log('========== 테스트 품목 ==========');
testItems.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.name} ${item.qty}병`);
});
console.log('');

// 마스터 시트 로드
const xlsxPath = path.join(process.cwd(), 'order-ai.xlsx');
const buffer = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buffer, { type: 'buffer' });
const sheet = wb.Sheets['English'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const masterItems = [];
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const itemNo = row[1]?.toString().trim();
  const englishName = row[7]?.toString().trim();
  const koreanName = row[8]?.toString().trim();
  
  if (!itemNo || !koreanName) continue;
  
  masterItems.push({
    itemNo,
    koreanName,
    englishName: englishName || ''
  });
}

console.log(`마스터 시트: ${masterItems.length}개 품목 로드\n`);

// 각 품목별 검색
testItems.forEach((testItem, idx) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`품목 ${idx + 1}: ${testItem.name} ${testItem.qty}병`);
  console.log('='.repeat(60));
  
  const candidates = [];
  
  for (const item of masterItems) {
    const scoreKo = partialTokenMatch(testItem.name, item.koreanName);
    const scoreEn = partialTokenMatch(testItem.name, item.englishName);
    const score = Math.max(scoreKo, scoreEn);
    
    if (score > 0.3) {
      candidates.push({
        itemNo: item.itemNo,
        koreanName: item.koreanName,
        score
      });
    }
  }
  
  // 거래처 이력 확인
  const historyItems = db.prepare(`
    SELECT item_no, item_name
    FROM client_item_stats
    WHERE client_code = ?
  `).all(clientCode);
  
  const historySet = new Set(historyItems.map(h => h.item_no));
  
  candidates.sort((a, b) => b.score - a.score);
  
  console.log('\n상위 5개 후보:');
  candidates.slice(0, 5).forEach((c, i) => {
    const isHistory = historySet.has(c.itemNo);
    const historyLabel = isHistory ? ' 📦' : ' 🆕';
    console.log(`${i + 1}위. [${c.itemNo}]${historyLabel}`);
    console.log(`     점수: ${c.score.toFixed(3)}`);
    console.log(`     품목: ${c.koreanName}`);
    console.log('');
  });
  
  // 특정 품목 찾기
  if (testItem.name.includes('크루')) {
    const target2421505 = candidates.find(c => c.itemNo === '2421505');
    const target2418531 = candidates.find(c => c.itemNo === '2418531');
    
    console.log('=== 크루 와이너리 분석 ===');
    if (target2421505) {
      const rank = candidates.indexOf(target2421505) + 1;
      const isHistory = historySet.has('2421505');
      console.log(`✅ 2421505 (산타 루치아): ${rank}위, 점수 ${target2421505.score.toFixed(3)}${isHistory ? ' 📦 거래처 이력' : ' 🆕 신규'}`);
    }
    if (target2418531) {
      const rank = candidates.indexOf(target2418531) + 1;
      const isHistory = historySet.has('2418531');
      console.log(`⚠️  2418531 (일반 몬테레이): ${rank}위, 점수 ${target2418531.score.toFixed(3)}${isHistory ? ' 📦 거래처 이력' : ' 🆕 신규'}`);
    }
    
    if (target2421505 && target2418531) {
      const rank2421505 = candidates.indexOf(target2421505) + 1;
      const rank2418531 = candidates.indexOf(target2418531) + 1;
      
      if (rank2421505 < rank2418531) {
        console.log('\n✅ 정답 품목(2421505)이 더 높은 순위!');
      } else {
        console.log('\n❌ 오답 품목(2418531)이 더 높은 순위!');
        console.log('   → 가중치 시스템 때문일 가능성');
      }
    }
  }
});

db.close();
console.log('\n\n========== 테스트 완료 ==========');
