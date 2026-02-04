// 정렬 로직 테스트
const items = [
  { item_no: '3022049', name: 'CL 샤블리', score: 0.652, is_new_item: true },
  { item_no: '3021065', name: 'CL 샤블리 샹트메흘르', score: 0.652, is_new_item: false },
  { item_no: '3021049', name: '클레멍 라발리 샤블리', score: 0.535, is_new_item: false },
  { item_no: '3020701', name: 'CL 샤블리 레자딜레', score: 0.652, is_new_item: true },
];

console.log('정렬 전:');
items.forEach((item, i) => {
  const tag = item.is_new_item ? '🆕' : '✅';
  console.log(`${i+1}. ${tag} ${item.item_no} (${item.score})`);
});

// 정렬 로직 적용
items.sort((a, b) => {
  // 1순위: 기존 품목 우선
  const aIsExisting = a.is_new_item === false;
  const bIsExisting = b.is_new_item === false;
  if (aIsExisting && !bIsExisting) return -1;
  if (!aIsExisting && bIsExisting) return 1;
  
  // 2순위: 점수 내림차순
  return (b.score ?? 0) - (a.score ?? 0);
});

console.log('\n정렬 후 (기존 품목 우선):');
items.forEach((item, i) => {
  const tag = item.is_new_item ? '🆕' : '✅';
  console.log(`${i+1}. ${tag} ${item.item_no} (${item.score})`);
});
