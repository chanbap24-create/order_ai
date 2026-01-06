const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const path = require('path');

const dbPath = path.join(__dirname, '../data.sqlite3');
const xlsxPath = path.join(__dirname, '../order-ai.xlsx');

console.log('📦 DL-Client 데이터 import 시작...\n');

const db = new Database(dbPath);

// 1. 테이블 생성
console.log('1️⃣ 테이블 생성...');
const initSql = require('fs').readFileSync(path.join(__dirname, 'init_glass_db.sql'), 'utf8');
db.exec(initSql);
console.log('✅ 테이블 생성 완료\n');

// 2. DL-Client 시트 읽기
console.log('2️⃣ Excel 파일 읽기...');
const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets['DL-Client'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log(`✅ ${data.length}행 읽기 완료\n`);

// 3. 데이터 파싱
console.log('3️⃣ 데이터 파싱...');
const clientsMap = new Map();
const itemsMap = new Map();
const clientItemsMap = new Map();

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  
  const clientName = String(row[4] || '').trim();
  const clientCode = String(row[5] || '').trim();
  const itemNo = String(row[12] || '').trim();
  const itemName = String(row[13] || '').trim();
  const price = parseFloat(row[16]) || 0;
  
  // 빈 행 스킵
  if (!clientCode || !itemNo || !clientName || !itemName) continue;
  
  // 거래처 수집
  if (!clientsMap.has(clientCode)) {
    clientsMap.set(clientCode, clientName);
  }
  
  // 품목 수집
  if (!itemsMap.has(itemNo)) {
    itemsMap.set(itemNo, itemName);
  }
  
  // 거래처별 품목 수집
  const key = `${clientCode}:${itemNo}`;
  if (!clientItemsMap.has(key)) {
    clientItemsMap.set(key, { clientCode, itemNo, itemName, price });
  }
}

console.log(`✅ 거래처: ${clientsMap.size}개`);
console.log(`✅ 품목: ${itemsMap.size}개`);
console.log(`✅ 거래처별 품목: ${clientItemsMap.size}개\n`);

// 4. DB에 insert
console.log('4️⃣ DB에 저장 중...');

// 기존 데이터 삭제
db.exec(`
  DELETE FROM glass_client_item_stats;
  DELETE FROM glass_client_alias;
  DELETE FROM glass_items;
  DELETE FROM glass_clients;
`);

// 거래처 insert
const insertClient = db.prepare(`
  INSERT OR REPLACE INTO glass_clients (client_code, client_name)
  VALUES (?, ?)
`);

const insertClientAlias = db.prepare(`
  INSERT OR REPLACE INTO glass_client_alias (client_code, alias, weight)
  VALUES (?, ?, 10)
`);

let clientCount = 0;
for (const [code, name] of clientsMap) {
  insertClient.run(code, name);
  insertClientAlias.run(code, name); // 별칭도 동일하게
  clientCount++;
}
console.log(`✅ 거래처 ${clientCount}개 저장 완료`);

// 품목 insert
const insertItem = db.prepare(`
  INSERT OR REPLACE INTO glass_items (item_no, item_name)
  VALUES (?, ?)
`);

let itemCount = 0;
for (const [no, name] of itemsMap) {
  insertItem.run(no, name);
  itemCount++;
}
console.log(`✅ 품목 ${itemCount}개 저장 완료`);

// 거래처별 품목 insert (glass_client_item_stats 테이블 사용)
const insertClientItem = db.prepare(`
  INSERT OR REPLACE INTO glass_client_item_stats (client_code, item_no, item_name, supply_price)
  VALUES (?, ?, ?, ?)
`);

let clientItemCount = 0;
for (const [key, item] of clientItemsMap) {
  insertClientItem.run(item.clientCode, item.itemNo, item.itemName, item.price);
  clientItemCount++;
}
console.log(`✅ 거래처별 품목 ${clientItemCount}개 저장 완료\n`);

// 5. 통계 출력
console.log('📊 최종 통계:');
const stats = {
  clients: db.prepare('SELECT COUNT(*) as cnt FROM glass_clients').get().cnt,
  aliases: db.prepare('SELECT COUNT(*) as cnt FROM glass_client_alias').get().cnt,
  items: db.prepare('SELECT COUNT(*) as cnt FROM glass_items').get().cnt,
  clientItems: db.prepare('SELECT COUNT(*) as cnt FROM glass_client_item_stats').get().cnt,
};

console.log(`- 거래처: ${stats.clients}개`);
console.log(`- 거래처 별칭: ${stats.aliases}개`);
console.log(`- 품목: ${stats.items}개`);
console.log(`- 거래처별 품목: ${stats.clientItems}개`);

// 샘플 데이터 출력
console.log('\n📝 샘플 데이터:');
const sampleClients = db.prepare('SELECT * FROM glass_clients LIMIT 3').all();
console.log('거래처:', sampleClients);

const sampleItems = db.prepare('SELECT * FROM glass_items LIMIT 3').all();
console.log('품목:', sampleItems);

db.close();
console.log('\n✨ Import 완료!');
