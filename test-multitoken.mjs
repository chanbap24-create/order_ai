/**
 * 멀티 토큰 검색 테스트 스크립트
 */

import Database from 'better-sqlite3';

const db = new Database('./data.sqlite3');

// 유틸리티 함수
function stripQtyAndUnit(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl)\b/gi, "").trim();
  s = s.replace(/\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function getAllTokens(rawName) {
  const base = stripQtyAndUnit(rawName);
  const tokens = base.split(" ").filter(Boolean);
  const clean = tokens
    .map((t) => t.replace(/["'`]/g, "").trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t));
  
  return clean;
}

// 테이블 확인
function pickMasterTable() {
  const candidates = [
    "items", "item_master", "item_mst", "sku_master", "product_master",
    "products", "inventory_items", "downloads_items", "Downloads_items",
  ];
  for (const t of candidates) {
    const exists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`).get(t);
    if (exists) return t;
  }
  return null;
}

function detectColumns(table) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const names = cols.map((c) => String(c.name));

    const itemNo = names.find((n) => ["item_no", "itemNo", "sku", "code", "품목번호", "품목코드"].includes(n));
    const itemName = names.find((n) => ["item_name", "itemName", "name", "품목명"].includes(n));

    if (!itemNo || !itemName) return null;
    return { itemNo, itemName };
  } catch {
    return null;
  }
}

// 멀티 토큰 검색
function fetchFromMasterMultiToken(rawName, limit = 80) {
  const table = pickMasterTable();
  if (!table) {
    console.log('❌ 마스터 테이블을 찾을 수 없습니다.');
    return [];
  }

  const cols = detectColumns(table);
  if (!cols) {
    console.log('❌ 컬럼을 감지할 수 없습니다.');
    return [];
  }

  const tokens = getAllTokens(rawName);
  if (tokens.length === 0) {
    console.log('❌ 유효한 토큰이 없습니다.');
    return [];
  }

  console.log(`\n📊 검색 입력: "${rawName}"`);
  console.log(`🔍 추출된 토큰: [${tokens.map(t => `"${t}"`).join(', ')}]`);
  console.log(`📋 테이블: ${table}, 컬럼: ${cols.itemNo}, ${cols.itemName}\n`);

  try {
    const results = new Map();
    
    // 전략 1: AND 검색
    if (tokens.length >= 2) {
      try {
        const andWhere = tokens.map(() => `${cols.itemName} LIKE ?`).join(" AND ");
        const andParams = tokens.map((t) => `%${t}%`);
        const andSql = `
          SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
          FROM ${table}
          WHERE ${andWhere}
          LIMIT 30
        `;
        const andResults = db.prepare(andSql).all(...andParams);
        
        for (const r of andResults) {
          if (!results.has(r.item_no)) {
            results.set(r.item_no, { ...r, priority: 3 });
          }
        }
        
        console.log(`✅ AND 검색: "${tokens.join('" AND "')}" → ${andResults.length}개`);
        if (andResults.length > 0) {
          console.log(`   상위 3개:`);
          andResults.slice(0, 3).forEach((r, idx) => {
            console.log(`   ${idx + 1}. [${r.item_no}] ${r.item_name}`);
          });
        }
      } catch (e) {
        console.error('❌ AND 검색 실패:', e.message);
      }
    }
    
    // 전략 2: Half 검색
    if (tokens.length >= 3) {
      try {
        const halfCount = Math.ceil(tokens.length / 2);
        const halfTokens = tokens.slice(0, halfCount);
        const halfWhere = halfTokens.map(() => `${cols.itemName} LIKE ?`).join(" AND ");
        const halfParams = halfTokens.map((t) => `%${t}%`);
        const halfSql = `
          SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
          FROM ${table}
          WHERE ${halfWhere}
          LIMIT 40
        `;
        const halfResults = db.prepare(halfSql).all(...halfParams);
        
        for (const r of halfResults) {
          if (!results.has(r.item_no)) {
            results.set(r.item_no, { ...r, priority: 2 });
          }
        }
        
        console.log(`\n✅ Half 검색: "${halfTokens.join('" AND "')}" → ${halfResults.length}개`);
      } catch (e) {
        console.error('❌ Half 검색 실패:', e.message);
      }
    }
    
    // 전략 3: OR 검색
    try {
      const orWhere = tokens.map(() => `${cols.itemName} LIKE ?`).join(" OR ");
      const orParams = tokens.map((t) => `%${t}%`);
      const orSql = `
        SELECT ${cols.itemNo} AS item_no, ${cols.itemName} AS item_name
        FROM ${table}
        WHERE ${orWhere}
        LIMIT 30
      `;
      const orResults = db.prepare(orSql).all(...orParams);
      
      for (const r of orResults) {
        if (!results.has(r.item_no)) {
          results.set(r.item_no, { ...r, priority: 1 });
        }
      }
      
      console.log(`\n✅ OR 검색: "${tokens.join('" OR "')}" → ${orResults.length}개`);
    } catch (e) {
      console.error('❌ OR 검색 실패:', e.message);
    }
    
    // 우선순위 순으로 정렬
    const sorted = Array.from(results.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
    
    console.log(`\n🎯 총 후보: ${sorted.length}개 (중복 제거 후)`);
    console.log(`\n📦 최종 결과 (상위 10개):`);
    sorted.slice(0, 10).forEach((r, idx) => {
      const priorityLabel = r.priority === 3 ? 'AND' : r.priority === 2 ? 'Half' : 'OR';
      console.log(`   ${idx + 1}. [${priorityLabel}] [${r.item_no}] ${r.item_name}`);
    });
    
    return sorted.map(({ item_no, item_name }) => ({ item_no, item_name }));
  } catch (e) {
    console.error('❌ 전체 검색 실패:', e);
    return [];
  }
}

// 테스트 케이스
console.log('=' . repeat(80));
console.log('🧪 멀티 토큰 검색 시스템 테스트');
console.log('=' . repeat(80));

const testCases = [
  "레이크 찰리스 말보로 24병",
  "로쉬벨렌 말보로 24병",
  "ch 샤르도네 24병",
  "샤또 마고",
];

for (const testCase of testCases) {
  fetchFromMasterMultiToken(testCase, 50);
  console.log('\n' + '─' . repeat(80) + '\n');
}

db.close();
console.log('✅ 테스트 완료!');
