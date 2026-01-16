const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('data.sqlite3', { readonly: true });

// 모든 별칭 가져오기
const aliases = db.prepare(`
  SELECT alias, canonical, count, last_used_at, created_at 
  FROM item_alias 
  ORDER BY count DESC, created_at DESC
`).all();

console.log(`✅ 총 ${aliases.length}개 별칭 발견\n`);

// CSV 파일로 저장
const csvLines = ['alias,canonical,count,last_used_at,created_at'];
aliases.forEach(row => {
  csvLines.push(`"${row.alias}","${row.canonical}",${row.count || 1},"${row.last_used_at || ''}","${row.created_at || ''}"`);
});

fs.writeFileSync('learned_aliases.csv', csvLines.join('\n'), 'utf8');
console.log('📄 CSV 파일 저장: learned_aliases.csv');

// Markdown 파일로 저장
const mdLines = [
  '# 🍷 학습된 별칭 목록',
  '',
  `**총 개수**: ${aliases.length}개`,
  `**마지막 업데이트**: ${new Date().toISOString()}`,
  '',
  '## 📊 사용 횟수별 TOP 20',
  '',
  '| 순위 | 별칭 | 정식명칭 | 사용횟수 | 최근사용 |',
  '|------|------|----------|----------|----------|'
];

aliases.slice(0, 20).forEach((row, idx) => {
  mdLines.push(`| ${idx + 1} | \`${row.alias}\` | ${row.canonical} | ${row.count || 1}회 | ${row.last_used_at || '-'} |`);
});

mdLines.push('');
mdLines.push('## 📋 전체 목록');
mdLines.push('');
mdLines.push('| 별칭 | 정식명칭 | 사용횟수 |');
mdLines.push('|------|----------|----------|');

aliases.forEach(row => {
  mdLines.push(`| \`${row.alias}\` | ${row.canonical} | ${row.count || 1}회 |`);
});

fs.writeFileSync('LEARNED_ALIASES.md', mdLines.join('\n'), 'utf8');
console.log('📄 Markdown 파일 저장: LEARNED_ALIASES.md');

// 통계 출력
const stats = {
  total: aliases.length,
  highUsage: aliases.filter(a => a.count >= 20).length,
  mediumUsage: aliases.filter(a => a.count >= 10 && a.count < 20).length,
  lowUsage: aliases.filter(a => a.count < 10).length,
  totalUsageCount: aliases.reduce((sum, a) => sum + (a.count || 1), 0)
};

console.log('\n📈 통계:');
console.log(`  - 총 별칭 수: ${stats.total}개`);
console.log(`  - 고사용 (20회+): ${stats.highUsage}개`);
console.log(`  - 중간사용 (10-19회): ${stats.mediumUsage}개`);
console.log(`  - 저사용 (10회 미만): ${stats.lowUsage}개`);
console.log(`  - 총 사용 횟수: ${stats.totalUsageCount}회`);

db.close();
