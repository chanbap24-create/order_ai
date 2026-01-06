const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

// 경로 설정
const xlsxPath = path.join(__dirname, '..', 'order-ai.xlsx');
const dbPath = path.join(__dirname, '..', 'data.sqlite3');

console.log('[DL-Client 동기화 시작]');
console.log('XLSX:', xlsxPath);
console.log('DB:', dbPath);

// DB 연결
const db = new Database(dbPath);

// 스키마 초기화
console.log('\n[1] 테이블 생성...');
const schema = require('fs').readFileSync(path.join(__dirname, 'init_glass_db.sql'), 'utf8');
db.exec(schema);
console.log('✓ 테이블 생성 완료');

// 엑셀 읽기
console.log('\n[2] 엑셀 파일 읽기...');
const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets['DL-Client'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log(`✓ 총 ${rows.length}행 읽음`);

// 데이터 파싱 및 삽입
console.log('\n[3] 데이터 파싱 중...');

const clients = new Map(); // client_code -> client_name
const items = new Map(); // item_no -> { item_name, supply_price }
const clientItems = new Map(); // `${client_code}:${item_no}` -> data

// 헤더 건너뛰고 데이터 행부터 처리 (행 0: 헤더, 행 1: 합계)
for (let i = 2; i < rows.length; i++) {
  const row = rows[i];
  
  // E열(index 4): 판매처(거래처명)
  // F열(index 5): 판매처번호(거래처코드)
  // M열(index 12): 품번(품목코드)
  // N열(index 13): 품명(품목명)
  // Q열(index 16): 판매단가
  
  const clientName = row[4];
  const clientCode = String(row[5] || '').trim();
  const itemNo = String(row[12] || '').trim();
  const itemName = String(row[13] || '').trim();
  const supplyPrice = parseFloat(row[16]) || 0;
  
  if (!clientCode || !itemNo || !clientName || !itemName) {
    continue; // 필수 데이터 없으면 건너뛰기
  }
  
  // 거래처 수집
  if (!clients.has(clientCode)) {
    clients.set(clientCode, clientName);
  }
  
  // 품목 수집 (가장 최근 단가 유지)
  if (!items.has(itemNo)) {
    items.set(itemNo, { item_name: itemName, supply_price: supplyPrice });
  }
  
  // 거래처-품목 관계 수집
  const key = `${clientCode}:${itemNo}`;
  if (!clientItems.has(key)) {
    clientItems.set(key, {
      client_code: clientCode,
      item_no: itemNo,
      item_name: itemName,
      supply_price: supplyPrice,
    });
  }
}

console.log(`✓ 거래처: ${clients.size}개`);
console.log(`✓ 품목: ${items.size}개`);
console.log(`✓ 거래처-품목 관계: ${clientItems.size}개`);

// DB에 삽입
console.log('\n[4] DB에 저장 중...');

db.exec('BEGIN TRANSACTION');

try {
  // 거래처 삽입
  const insertClient = db.prepare(`
    INSERT OR REPLACE INTO glass_clients (client_code, client_name)
    VALUES (?, ?)
  `);
  
  for (const [code, name] of clients) {
    insertClient.run(code, name);
  }
  
  // 거래처 별칭 삽입 (거래처명 = 별칭)
  const insertAlias = db.prepare(`
    INSERT OR REPLACE INTO glass_client_alias (client_code, alias, weight)
    VALUES (?, ?, 10)
  `);
  
  for (const [code, name] of clients) {
    insertAlias.run(code, name);
  }
  
  // 품목 삽입
  const insertItem = db.prepare(`
    INSERT OR REPLACE INTO glass_items (item_no, item_name, supply_price)
    VALUES (?, ?, ?)
  `);
  
  for (const [itemNo, data] of items) {
    insertItem.run(itemNo, data.item_name, data.supply_price);
  }
  
  // 거래처-품목 통계 삽입
  const insertStat = db.prepare(`
    INSERT OR REPLACE INTO glass_client_item_stats 
    (client_code, item_no, item_name, supply_price, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  
  for (const data of clientItems.values()) {
    insertStat.run(
      data.client_code,
      data.item_no,
      data.item_name,
      data.supply_price
    );
  }
  
  db.exec('COMMIT');
  console.log('✓ 데이터 저장 완료');
  
} catch (error) {
  db.exec('ROLLBACK');
  console.error('✗ 오류 발생:', error);
  process.exit(1);
}

// 결과 확인
console.log('\n[5] 결과 확인:');
const clientCount = db.prepare('SELECT COUNT(*) as cnt FROM glass_clients').get();
const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM glass_items').get();
const aliasCount = db.prepare('SELECT COUNT(*) as cnt FROM glass_client_alias').get();
const statCount = db.prepare('SELECT COUNT(*) as cnt FROM glass_client_item_stats').get();

console.log(`거래처: ${clientCount.cnt}개`);
console.log(`품목: ${itemCount.cnt}개`);
console.log(`거래처 별칭: ${aliasCount.cnt}개`);
console.log(`거래처-품목 통계: ${statCount.cnt}개`);

db.close();
console.log('\n[완료] DL-Client 데이터 동기화 성공!');
