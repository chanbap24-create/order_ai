import { searchMasterSheet } from './app/lib/masterMatcher.ts';

console.log('=== Direct Test: searchMasterSheet ===\n');

// Test 1: English only
console.log('TEST 1: Montee de tonnerre (영문만)');
const result1 = searchMasterSheet('Montee de tonnerre', 10);
console.log(`Found ${result1.length} results:`);
result1.forEach((r, i) => {
  console.log(`${i+1}. ${r.itemNo}: score=${r.score.toFixed(3)}`);
  console.log(`   Korean: ${r.koreanName}`);
  console.log(`   English: ${r.englishName}`);
  console.log(`   Supply: ${r.supplyPrice}`);
});

console.log('\n' + '='.repeat(60) + '\n');

// Test 2: Mixed Korean-English
console.log('TEST 2: 루이미셸 Chablis Montee de tonnerre (혼합)');
const result2 = searchMasterSheet('루이미셸 Chablis Montee de tonnerre', 10);
console.log(`Found ${result2.length} results:`);
result2.forEach((r, i) => {
  console.log(`${i+1}. ${r.itemNo}: score=${r.score.toFixed(3)}`);
  console.log(`   Korean: ${r.koreanName}`);
  console.log(`   English: ${r.englishName}`);
});
