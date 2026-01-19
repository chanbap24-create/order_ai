// 점수 계산 테스트
function normTight(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()-_/.,]/g, '');
}

const query = '크루 와이너리 산타루치아 몬테레이';
const item1 = '크루 와이너리 피노누아 몬테레이';  // 2418531
const item2 = '크루 와이너리 피노누아 산타 루치아 하이랜즈 몬테레이';  // 2421505

console.log('=== 토큰 비교 ===');
console.log('입력:', query.split(' '));
console.log('품목1 (2418531):', item1.split(' '));
console.log('품목2 (2421505):', item2.split(' '));

console.log('\n=== norm 비교 ===');
const qNorm = normTight(query);
const item1Norm = normTight(item1);
const item2Norm = normTight(item2);

console.log('입력 norm:', qNorm);
console.log('품목1 norm:', item1Norm);
console.log('품목2 norm:', item2Norm);

console.log('\n=== contains 비교 ===');
console.log('품목1 contains 입력?', item1Norm.includes(qNorm), '입력 contains 품목1?', qNorm.includes(item1Norm));
console.log('품목2 contains 입력?', item2Norm.includes(qNorm), '입력 contains 품목2?', qNorm.includes(item2Norm));

// 토큰 교집합
console.log('\n=== 토큰 교집합 ===');
const qTokens = query.toLowerCase().split(/\s+/);
const item1Tokens = item1.toLowerCase().split(/\s+/);
const item2Tokens = item2.toLowerCase().split(/\s+/);

const intersection1 = qTokens.filter(t => item1Tokens.includes(t));
const intersection2 = qTokens.filter(t => item2Tokens.includes(t));

console.log('입력 토큰:', qTokens);
console.log('품목1 교집합:', intersection1, '(', intersection1.length, '/', qTokens.length, ')');
console.log('품목2 교집합:', intersection2, '(', intersection2.length, '/', qTokens.length, ')');

console.log('\n=== 예상 점수 ===');
const score1 = intersection1.length / Math.max(qTokens.length, item1Tokens.length);
const score2 = intersection2.length / Math.max(qTokens.length, item2Tokens.length);
console.log('품목1 점수:', score1.toFixed(3));
console.log('품목2 점수:', score2.toFixed(3));
