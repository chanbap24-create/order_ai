// baseScore vs finalScore 비교 테스트

// 시뮬레이션
const SIGNAL_WEIGHTS = {
  BASE_SCORE: 5.0,
  RECENT_PURCHASE: 1.5,
  PURCHASE_FREQUENCY: 1.0,
};

const item2418531 = {
  no: '2418531',
  name: '크루 와이너리 피노누아 몬테레이',
  baseScore: 0.800,  // 원본 점수
  recentPurchase: 0.15,
  purchaseFrequency: 0.10,
};

const finalScore = 
  item2418531.baseScore * SIGNAL_WEIGHTS.BASE_SCORE +
  item2418531.recentPurchase * SIGNAL_WEIGHTS.RECENT_PURCHASE +
  item2418531.purchaseFrequency * SIGNAL_WEIGHTS.PURCHASE_FREQUENCY;

console.log('========== baseScore vs finalScore ==========\n');
console.log(`품목: ${item2418531.name}`);
console.log(`품목 코드: ${item2418531.no}\n`);

console.log(`baseScore (원본): ${item2418531.baseScore.toFixed(3)}`);
console.log(`finalScore (가중치 적용): ${finalScore.toFixed(3)}\n`);

console.log('========== 신규 품목 검색 조건 ==========\n');

console.log('❌ 잘못된 방법 (finalScore 사용):');
console.log(`  shouldSearchNew = finalScore < 0.70`);
console.log(`  shouldSearchNew = ${finalScore.toFixed(3)} < 0.70`);
console.log(`  shouldSearchNew = ${finalScore < 0.70} ← 신규 품목 검색 안됨!\n`);

console.log('✅ 올바른 방법 (baseScore 사용):');
console.log(`  shouldSearchNew = baseScore < 0.70`);
console.log(`  shouldSearchNew = ${item2418531.baseScore.toFixed(3)} < 0.70`);
console.log(`  shouldSearchNew = ${item2418531.baseScore < 0.70} ← 신규 품목 검색 안됨 (정상)\n`);

console.log('📌 참고:');
console.log('  - 0.800은 괜찮은 점수이므로 신규 품목 검색을 할 필요 없음');
console.log('  - 하지만 부분 매칭으로 더 정확한 품목(0.950)을 찾을 수 있음');
console.log('  - 따라서 항상 신규 품목을 함께 표시하는 것이 좋음\n');

console.log('========== 제안 ==========\n');
console.log('옵션 1: baseScore < 0.80 으로 변경');
console.log('  → 0.800도 신규 품목 검색에 포함\n');

console.log('옵션 2: 항상 신규 품목 검색 (shouldSearchNew = true)');
console.log('  → 모든 경우에 신규 품목도 함께 표시');
