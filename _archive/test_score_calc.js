// 점수 계산 테스트
console.log('\n===== 점수 계산 디버깅 =====\n');

// 가중치
const SIGNAL_WEIGHTS = {
  BASE_SCORE: 5.0,
  USER_LEARNING: 3.0,
  TOKEN_MATCH: 2.5,
  ALIAS_MATCH: 2.0,
  RECENT_PURCHASE: 1.5,
  PURCHASE_FREQUENCY: 1.0,
  VINTAGE: 0.5,
};

// 시뮬레이션
const baseScore = 0.800; // 크루 와이너리 피노누아 몬테레이
const signals = {
  userLearning: 0,
  tokenMatch: 0,
  aliasMatch: 0,
  recentPurchase: 0.05, // 예상
  purchaseFrequency: 0.05, // 예상
  vintage: 0,
};

console.log('입력: 크루 와이너리 산타루치아 몬테레이');
console.log('품목: 크루 와이너리 피노누아 몬테레이 (2418531)');
console.log(`\nbaseScore: ${baseScore}`);
console.log('\n신호:');
Object.entries(signals).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

const rawTotal = 
  baseScore * SIGNAL_WEIGHTS.BASE_SCORE +
  signals.userLearning * SIGNAL_WEIGHTS.USER_LEARNING +
  signals.tokenMatch * SIGNAL_WEIGHTS.TOKEN_MATCH +
  signals.aliasMatch * SIGNAL_WEIGHTS.ALIAS_MATCH +
  signals.recentPurchase * SIGNAL_WEIGHTS.RECENT_PURCHASE +
  signals.purchaseFrequency * SIGNAL_WEIGHTS.PURCHASE_FREQUENCY +
  signals.vintage * SIGNAL_WEIGHTS.VINTAGE;

console.log(`\n가중치 적용:`);
console.log(`  baseScore × 5.0 = ${baseScore * 5.0}`);
console.log(`  recentPurchase × 1.5 = ${signals.recentPurchase * 1.5}`);
console.log(`  purchaseFrequency × 1.0 = ${signals.purchaseFrequency * 1.0}`);
console.log(`\n최종 점수: ${rawTotal.toFixed(3)}`);

if (rawTotal > 4.0) {
  console.log('\n⚠️  점수가 4.0을 초과했습니다!');
  console.log('문제: BASE_SCORE 가중치가 너무 높습니다.');
  console.log('해결: BASE_SCORE를 1.0으로 낮추고, 다른 신호들 조정');
}

console.log('\n\n제안된 가중치:');
const NEW_WEIGHTS = {
  BASE_SCORE: 1.0,
  USER_LEARNING: 0.3,
  TOKEN_MATCH: 0.25,
  ALIAS_MATCH: 0.2,
  RECENT_PURCHASE: 0.15,
  PURCHASE_FREQUENCY: 0.10,
  VINTAGE: 0.05,
};

console.log(NEW_WEIGHTS);

const newTotal = 
  baseScore * NEW_WEIGHTS.BASE_SCORE +
  signals.userLearning * NEW_WEIGHTS.USER_LEARNING +
  signals.tokenMatch * NEW_WEIGHTS.TOKEN_MATCH +
  signals.aliasMatch * NEW_WEIGHTS.ALIAS_MATCH +
  signals.recentPurchase * NEW_WEIGHTS.RECENT_PURCHASE +
  signals.purchaseFrequency * NEW_WEIGHTS.PURCHASE_FREQUENCY +
  signals.vintage * NEW_WEIGHTS.VINTAGE;

console.log(`\n새 점수: ${newTotal.toFixed(3)}`);
console.log('✅ 이제 0~1.5 범위의 합리적인 점수!\n');
