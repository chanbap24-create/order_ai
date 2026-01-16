const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.sqlite3');
const ALIASES_FILE = path.join(__dirname, 'learned_aliases.csv');

function importAliases() {
  const db = new Database(DB_PATH);
  
  // item_alias 테이블 생성
  db.prepare(`
    CREATE TABLE IF NOT EXISTS item_alias (
      alias TEXT PRIMARY KEY,
      canonical TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      count INTEGER DEFAULT 1,
      last_used_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  // CSV 파일 읽기
  const csv = fs.readFileSync(ALIASES_FILE, 'utf8');
  const lines = csv.split('\n').slice(1); // 헤더 제외
  
  const upsert = db.prepare(`
    INSERT INTO item_alias (alias, canonical, count, last_used_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(alias) DO UPDATE SET
      canonical = excluded.canonical,
      count = excluded.count,
      last_used_at = excluded.last_used_at
  `);
  
  let imported = 0;
  db.transaction(() => {
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split(',');
      if (parts.length < 3) continue;
      
      const alias = parts[0].trim();
      const canonical = parts[1].trim();
      const count = parseInt(parts[2]) || 1;
      const last_used = parts[3]?.trim() || new Date().toISOString();
      
      upsert.run(alias, canonical, count, last_used);
      imported++;
    }
  })();
  
  db.close();
  
  console.log(`✅ ${imported}개 별칭 import 완료!`);
}

importAliases();
