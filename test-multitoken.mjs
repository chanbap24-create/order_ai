import Database from 'better-sqlite3';

const db = new Database('./data.sqlite3');

// 멀티 토큰 검색 테스트
function testMultiTokenSearch(input) {
  console.log(`\n=== 테스트: "${input}" ===`);
  
  // 토큰 추출
  const stripQtyAndUnit = (raw) => {
    let s = String(raw || "").trim();
    s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl)\b/gi, "").trim();
    s = s.replace(/\b\d+\b\s*$/g, "").trim();
    s = s.replace(/\s+/g, " ").trim();
    return s;
  };
  
  const getAllTokens = (rawName) => {
    const base = stripQtyAndUnit(rawName);
    const tokens = base.split(" ").filter(Boolean);
    const clean = tokens
      .map((t) => t.replace(/["'`]/g, "").trim())
      .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));
    return clean;
  };
  
  const tokens = getAllTokens(input);
  console.log(`토큰: [${tokens.join(', ')}]`);
  
  // 마스터 테이블 찾기
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const masterTable = tables.find(t => 
    ['items', 'item_master', 'Downloads_items'].includes(t.name)
  )?.name;
  
  if (!masterTable) {
    console.log('마스터 테이블을 찾을 수 없습니다.');
    return;
  }
  
  console.log(`마스터 테이블: ${masterTable}`);
  
  // 컬럼 확인
  const cols = db.prepare(`PRAGMA table_info(${masterTable})`).all();
  const itemNoCol = cols.find(c => ['item_no', 'itemNo', 'code'].includes(c.name))?.name;
  const itemNameCol = cols.find(c => ['item_name', 'itemName', 'name'].includes(c.name))?.name;
  
  if (!itemNoCol || !itemNameCol) {
    console.log('컬럼을 찾을 수 없습니다.');
    return;
  }
  
  // AND 검색
  if (tokens.length >= 2) {
    const andWhere = tokens.map(() => `${itemNameCol} LIKE ?`).join(" AND ");
    const andParams = tokens.map(t => `%${t}%`);
    const andSql = `SELECT ${itemNoCol}, ${itemNameCol} FROM ${masterTable} WHERE ${andWhere} LIMIT 10`;
    
    try {
      const andResults = db.prepare(andSql).all(...andParams);
      console.log(`\n[AND 검색] 모든 토큰 포함:`);
      console.log(`  SQL: ${tokens.map(t => `"${t}"`).join(' AND ')}`);
      console.log(`  결과: ${andResults.length}개`);
      andResults.slice(0, 3).forEach((r, i) => {
        console.log(`    ${i+1}. ${r[itemNoCol]} - ${r[itemNameCol]}`);
      });
    } catch (e) {
      console.log(`  오류: ${e.message}`);
    }
  }
  
  // Half 검색
  if (tokens.length >= 3) {
    const halfCount = Math.ceil(tokens.length / 2);
    const halfTokens = tokens.slice(0, halfCount);
    const halfWhere = halfTokens.map(() => `${itemNameCol} LIKE ?`).join(" AND ");
    const halfParams = halfTokens.map(t => `%${t}%`);
    const halfSql = `SELECT ${itemNoCol}, ${itemNameCol} FROM ${masterTable} WHERE ${halfWhere} LIMIT 10`;
    
    try {
      const halfResults = db.prepare(halfSql).all(...halfParams);
      console.log(`\n[Half 검색] 절반 이상 토큰 포함:`);
      console.log(`  SQL: ${halfTokens.map(t => `"${t}"`).join(' AND ')}`);
      console.log(`  결과: ${halfResults.length}개`);
      halfResults.slice(0, 3).forEach((r, i) => {
        console.log(`    ${i+1}. ${r[itemNoCol]} - ${r[itemNameCol]}`);
      });
    } catch (e) {
      console.log(`  오류: ${e.message}`);
    }
  }
  
  // OR 검색
  const orWhere = tokens.map(() => `${itemNameCol} LIKE ?`).join(" OR ");
  const orParams = tokens.map(t => `%${t}%`);
  const orSql = `SELECT ${itemNoCol}, ${itemNameCol} FROM ${masterTable} WHERE ${orWhere} LIMIT 10`;
  
  try {
    const orResults = db.prepare(orSql).all(...orParams);
    console.log(`\n[OR 검색] 하나라도 포함:`);
    console.log(`  SQL: ${tokens.map(t => `"${t}"`).join(' OR ')}`);
    console.log(`  결과: ${orResults.length}개`);
    orResults.slice(0, 3).forEach((r, i) => {
      console.log(`    ${i+1}. ${r[itemNoCol]} - ${r[itemNameCol]}`);
    });
  } catch (e) {
    console.log(`  오류: ${e.message}`);
  }
}

// 테스트 실행
testMultiTokenSearch('레이크 찰리스 말보로 24병');
testMultiTokenSearch('로쉬벨렌 말보로 24병');
testMultiTokenSearch('ch 샤르도네 24병');

db.close();
