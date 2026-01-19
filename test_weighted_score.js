// 가중치 시스템 테스트

const SIGNAL_WEIGHTS = {
  BASE_SCORE: 5.0,         // 🎯 기본 문자열 유사도 (최우선!)
  USER_LEARNING: 3.0,      // 사용자 학습
  TOKEN_MATCH: 2.5,        // 토큰 매칭
  ALIAS_MATCH: 2.0,        // 별칭 매칭
  RECENT_PURCHASE: 1.5,    // 최근 구매 이력 (낮춤)
  PURCHASE_FREQUENCY: 1.0, // 구매 빈도 (낮춤)
  VINTAGE: 0.5,            // 빈티지 (낮춤)
};

console.log('========== 가중치 시스템 테스트 ==========\n');

// 시나리오 1: 정답 품목 (2421505) - 높은 base score, 거래처 이력 없음
const item2421505 = {
  no: '2421505',
  name: '크루 와이너리 피노누아 산타 루치아 하이랜즈 몬테레이',
  baseScore: 0.950,
  recentPurchase: 0,    // 거래처 이력 없음
  purchaseFrequency: 0, // 구매 빈도 없음
  userLearning: 0,
  tokenMatch: 0,
  aliasMatch: 0,
  vintage: 0,
};

// 시나리오 2: 오답 품목 (2418531) - 낮은 base score, 거래처 이력 있음
const item2418531 = {
  no: '2418531',
  name: '크루 와이너리 피노누아 몬테레이',
  baseScore: 0.800,
  recentPurchase: 0.15, // 최근 30일 구매
  purchaseFrequency: 0.10, // 5~9회 구매
  userLearning: 0,
  tokenMatch: 0,
  aliasMatch: 0,
  vintage: 0,
};

function calculateFinalScore(item) {
  const weights = {
    baseScore: item.baseScore * SIGNAL_WEIGHTS.BASE_SCORE,
    userLearning: item.userLearning * SIGNAL_WEIGHTS.USER_LEARNING,
    tokenMatch: item.tokenMatch * SIGNAL_WEIGHTS.TOKEN_MATCH,
    aliasMatch: item.aliasMatch * SIGNAL_WEIGHTS.ALIAS_MATCH,
    recentPurchase: item.recentPurchase * SIGNAL_WEIGHTS.RECENT_PURCHASE,
    purchaseFrequency: item.purchaseFrequency * SIGNAL_WEIGHTS.PURCHASE_FREQUENCY,
    vintage: item.vintage * SIGNAL_WEIGHTS.VINTAGE,
  };
  
  const total = 
    weights.baseScore +
    weights.userLearning +
    weights.tokenMatch +
    weights.aliasMatch +
    weights.recentPurchase +
    weights.purchaseFrequency +
    weights.vintage;
  
  return { weights, total };
}

console.log('품목 1: 2421505 (정답 - 산타 루치아)');
console.log('─'.repeat(50));
const result1 = calculateFinalScore(item2421505);
console.log('입력 신호:');
console.log(`  Base Score: ${item2421505.baseScore.toFixed(3)}`);
console.log(`  Recent Purchase: ${item2421505.recentPurchase.toFixed(3)}`);
console.log(`  Purchase Frequency: ${item2421505.purchaseFrequency.toFixed(3)}`);
console.log('\n가중치 적용:');
console.log(`  Base Score: ${item2421505.baseScore.toFixed(3)} × ${SIGNAL_WEIGHTS.BASE_SCORE} = ${result1.weights.baseScore.toFixed(3)}`);
console.log(`  Recent Purchase: ${item2421505.recentPurchase.toFixed(3)} × ${SIGNAL_WEIGHTS.RECENT_PURCHASE} = ${result1.weights.recentPurchase.toFixed(3)}`);
console.log(`  Purchase Freq: ${item2421505.purchaseFrequency.toFixed(3)} × ${SIGNAL_WEIGHTS.PURCHASE_FREQUENCY} = ${result1.weights.purchaseFrequency.toFixed(3)}`);
console.log(`\n최종 점수: ${result1.total.toFixed(3)}`);

console.log('\n\n품목 2: 2418531 (오답 - 일반 몬테레이, 거래처 이력 있음)');
console.log('─'.repeat(50));
const result2 = calculateFinalScore(item2418531);
console.log('입력 신호:');
console.log(`  Base Score: ${item2418531.baseScore.toFixed(3)}`);
console.log(`  Recent Purchase: ${item2418531.recentPurchase.toFixed(3)} (최근 30일)`);
console.log(`  Purchase Frequency: ${item2418531.purchaseFrequency.toFixed(3)} (5~9회)`);
console.log('\n가중치 적용:');
console.log(`  Base Score: ${item2418531.baseScore.toFixed(3)} × ${SIGNAL_WEIGHTS.BASE_SCORE} = ${result2.weights.baseScore.toFixed(3)}`);
console.log(`  Recent Purchase: ${item2418531.recentPurchase.toFixed(3)} × ${SIGNAL_WEIGHTS.RECENT_PURCHASE} = ${result2.weights.recentPurchase.toFixed(3)}`);
console.log(`  Purchase Freq: ${item2418531.purchaseFrequency.toFixed(3)} × ${SIGNAL_WEIGHTS.PURCHASE_FREQUENCY} = ${result2.weights.purchaseFrequency.toFixed(3)}`);
console.log(`\n최종 점수: ${result2.total.toFixed(3)}`);

console.log('\n\n========== 결과 비교 ==========');
console.log(`2421505 (정답): ${result1.total.toFixed(3)}`);
console.log(`2418531 (오답): ${result2.total.toFixed(3)}`);
console.log(`차이: ${(result1.total - result2.total).toFixed(3)}`);

if (result1.total > result2.total) {
  console.log('\n✅✅✅ 성공! 정답 품목이 더 높은 점수!');
  console.log(`정답이 ${(result1.total - result2.total).toFixed(3)}점 더 높음`);
} else {
  console.log('\n❌ 실패! 오답 품목이 더 높은 점수');
  console.log(`오답이 ${(result2.total - result1.total).toFixed(3)}점 더 높음`);
}

console.log('\n========== 가중치 효과 분석 ==========');
console.log('BASE_SCORE를 5.0으로 높인 효과:');
console.log(`- 0.950 base score = ${(0.950 * 5.0).toFixed(3)}점 기여`);
console.log(`- 0.800 base score = ${(0.800 * 5.0).toFixed(3)}점 기여`);
console.log(`- 차이: ${((0.950 - 0.800) * 5.0).toFixed(3)}점`);
console.log('\n거래처 이력 보너스:');
console.log(`- Recent Purchase: ${(0.15 * 1.5).toFixed(3)}점`);
console.log(`- Purchase Freq: ${(0.10 * 1.0).toFixed(3)}점`);
console.log(`- 합계: ${(0.15 * 1.5 + 0.10 * 1.0).toFixed(3)}점`);
console.log('\n결론: BASE_SCORE 차이가 거래처 이력 보너스를 충분히 압도!');
