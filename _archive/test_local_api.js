// 로컬 API 테스트 - 신규 품목 검색 확인

const { resolveWineItems } = require('./app/lib/resolveItemsWeighted');

const testInput = {
  clientCode: '28389', // 스시인
  items: [
    {
      name: '크루 와이너리 산타루치아 몬테레이',
      qty: 3
    }
  ]
};

console.log('========== 로컬 API 테스트 ==========');
console.log('거래처:', testInput.clientCode, '(스시인)');
console.log('검색:', testInput.items[0].name);
console.log('수량:', testInput.items[0].qty, '병\n');

try {
  const result = resolveWineItems(testInput.items, testInput.clientCode);
  
  if (result && result.length > 0) {
    const item = result[0];
    
    console.log('입력:', item.name);
    console.log('확정 여부:', item.resolved ? '✅ 확정' : '❌ 확인필요');
    
    if (item.resolved) {
      console.log('확정 품목:', item.item_no, '-', item.item_name);
      console.log('점수:', item.score);
    }
    
    console.log('\n========== 후보 품목 (상위 10개) ==========');
    if (item.suggestions && item.suggestions.length > 0) {
      item.suggestions.slice(0, 10).forEach((sugg, idx) => {
        const newLabel = sugg.is_new_item ? ' 🆕' : '';
        const targetLabel = (sugg.item_no === '2421505' || sugg.item_no === '3420501') ? ' ✅' : '';
        console.log(`${idx + 1}위. [${sugg.item_no}]${newLabel}${targetLabel}`);
        console.log(`     점수: ${sugg.score.toFixed(3)}`);
        console.log(`     품목: ${sugg.item_name.split('/')[0].trim()}`);
        console.log('');
      });
    }
    
    // 정답 확인
    console.log('========== 정답 확인 ==========');
    const target2421505 = item.suggestions?.find(s => s.item_no === '2421505');
    const target3420501 = item.suggestions?.find(s => s.item_no === '3420501');
    const wrong2418531 = item.suggestions?.find(s => s.item_no === '2418531');
    
    if (target2421505) {
      const rank = item.suggestions.indexOf(target2421505) + 1;
      console.log(`✅ 2421505 발견! 순위: ${rank}위, 점수: ${target2421505.score.toFixed(3)}`);
      console.log(`   품목: ${target2421505.item_name.split('/')[0].trim()}`);
    } else {
      console.log('❌ 2421505 없음 - 신규 품목 검색 실패!');
    }
    
    if (target3420501) {
      const rank = item.suggestions.indexOf(target3420501) + 1;
      console.log(`✅ 3420501 발견! 순위: ${rank}위, 점수: ${target3420501.score.toFixed(3)}`);
    }
    
    if (wrong2418531) {
      const rank = item.suggestions.indexOf(wrong2418531) + 1;
      console.log(`⚠️  2418531 발견! 순위: ${rank}위, 점수: ${wrong2418531.score.toFixed(3)}`);
      console.log(`   (이 품목은 산타 루치아가 없는 버전)`);
    }
    
    // 최종 판정
    console.log('\n========== 최종 판정 ==========');
    if (target2421505 && target3420501) {
      const rank2421505 = item.suggestions.indexOf(target2421505) + 1;
      const rank3420501 = item.suggestions.indexOf(target3420501) + 1;
      const rank2418531 = wrong2418531 ? item.suggestions.indexOf(wrong2418531) + 1 : 999;
      
      if (rank2421505 <= 2 && rank3420501 <= 3 && rank2421505 < rank2418531) {
        console.log('✅✅✅ 테스트 성공!');
        console.log('- 정답 품목들이 상위에 위치');
        console.log('- 산타 루치아 품목이 일반 몬테레이보다 높은 순위');
      } else {
        console.log('⚠️ 부분 성공');
        console.log('- 정답 품목은 있지만 순위가 낮음');
      }
    } else {
      console.log('❌ 테스트 실패 - 정답 품목이 후보에 없음');
    }
  }
} catch (error) {
  console.error('❌ 오류 발생:', error.message);
  console.error(error.stack);
}
