/**
 * ========================================
 * 회사 와인 품목 자동 학습 시스템
 * ========================================
 * 
 * 목적: English 시트의 373개 품목을 분석하여
 * 1. 토큰 매핑 생성 (약어 → 정식 명칭)
 * 2. 생산자명, 품종, 와인명 추출
 * 3. 자연어 입력 대응 강화
 */

const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

// DB 연결
const db = new Database('data.sqlite3');

// 한글 초성 추출
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㄹ', 'ㅁ', 'ㅂ', 
  'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

function extractConsonants(str) {
  const result = [];
  for (const ch of str) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      const chosungIndex = Math.floor(code / 588);
      result.push(CHOSUNG[chosungIndex]);
    }
  }
  return result.join('');
}

// 토큰 추출 함수
function extractTokens(text) {
  const tokens = new Set();
  
  // 1. 공백 기준 분리
  const words = text.toLowerCase().split(/[\s,]+/);
  words.forEach(w => {
    if (w.length >= 2) tokens.add(w);
  });
  
  // 2. 한글 초성 (3글자 이상)
  if (/[가-힣]{3,}/.test(text)) {
    const korean = text.match(/[가-힣]+/g);
    if (korean) {
      korean.forEach(k => {
        if (k.length >= 3) {
          const chosung = extractConsonants(k);
          if (chosung.length >= 2) {
            tokens.add(chosung);
          }
        }
      });
    }
  }
  
  // 3. 약어 추출 (대문자 2-4글자)
  const abbrs = text.match(/\b[A-Z]{2,4}\b/g);
  if (abbrs) {
    abbrs.forEach(a => tokens.add(a.toLowerCase()));
  }
  
  return Array.from(tokens);
}

// 생산자명 추출
function extractProducer(nameEn, nameKr) {
  const producers = [];
  
  // 영문 생산자명 (첫 단어 또는 쉼표 앞)
  const enMatch = nameEn.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (enMatch) {
    producers.push(enMatch[1].toLowerCase());
  }
  
  // 한글 생산자명 (첫 2-4글자)
  const krMatch = nameKr.match(/^([가-힣]{2,4})/);
  if (krMatch) {
    producers.push(krMatch[1]);
  }
  
  return producers;
}

// 품종 감지
const KNOWN_VARIETALS = {
  'chardonnay': '샤르도네',
  'sauvignon blanc': '소비뇽블랑',
  'cabernet sauvignon': '카베르네소비뇽',
  'pinot noir': '피노누아',
  'merlot': '메를로',
  'riesling': '리슬링',
  'syrah': '시라',
  'shiraz': '쉬라즈',
  'grenache': '그르나슈',
  'tempranillo': '템프라니요',
};

function extractVarietal(nameEn, nameKr) {
  const varietals = [];
  const lowerEn = nameEn.toLowerCase();
  
  for (const [en, kr] of Object.entries(KNOWN_VARIETALS)) {
    if (lowerEn.includes(en)) {
      varietals.push({ en, kr });
    }
  }
  
  return varietals;
}

// 토큰 매핑 저장
function saveTokenMapping(token, mappedText, tokenType) {
  try {
    db.prepare(`
      INSERT INTO token_mapping (token, mapped_text, token_type, confidence, learned_count, created_at)
      VALUES (?, ?, ?, 1.0, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(token) 
      DO UPDATE SET learned_count = learned_count + 1, last_used_at = CURRENT_TIMESTAMP
    `).run(token, mappedText, tokenType);
    return true;
  } catch (e) {
    console.error(`토큰 매핑 저장 실패: ${token} -> ${mappedText}`, e.message);
    return false;
  }
}

// 품목 별칭 저장
function saveItemAlias(alias, itemNo, itemName) {
  try {
    db.prepare(`
      INSERT INTO item_alias (alias, canonical, count, last_used_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(alias) 
      DO UPDATE SET count = count + 1, last_used_at = CURRENT_TIMESTAMP
    `).run(alias.toLowerCase(), itemNo);
    return true;
  } catch (e) {
    console.error(`품목 별칭 저장 실패: ${alias}`, e.message);
    return false;
  }
}

// 메인 학습 함수
async function learnFromEnglishSheet() {
  console.log('=== 회사 와인 품목 학습 시작 ===\n');
  
  // 1. Excel 파일 읽기
  const wb = XLSX.readFile('order-ai.xlsx');
  const ws = wb.Sheets['English'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  console.log(`총 ${data.length}행 로드\n`);
  
  // 2. 데이터 파싱 (행 4부터 실제 데이터)
  const items = [];
  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[1]) continue; // item_no가 없으면 스킵
    
    items.push({
      index: row[0],
      item_no: String(row[1]),
      country: row[3] || '',
      supplier: row[4] || '',
      region: row[5] || '',
      name_en: row[7] || '',
      name_kr: row[8] || '',
      vintage: row[9] || '',
      volume: row[10] || '',
      price: row[11] || '',
    });
  }
  
  console.log(`총 ${items.length}개 품목 파싱 완료\n`);
  
  // 3. 통계 카운터
  const stats = {
    tokens: 0,
    producers: 0,
    varietals: 0,
    aliases: 0,
  };
  
  // 4. 각 품목 학습
  console.log('=== 학습 진행 중... ===\n');
  
  for (const item of items) {
    const { item_no, name_en, name_kr, supplier } = item;
    
    // 4-1. 토큰 추출 및 저장
    const enTokens = extractTokens(name_en);
    const krTokens = extractTokens(name_kr);
    
    enTokens.forEach(token => {
      if (saveTokenMapping(token, item_no, 'wine_name_en')) {
        stats.tokens++;
      }
    });
    
    krTokens.forEach(token => {
      if (saveTokenMapping(token, item_no, 'wine_name_kr')) {
        stats.tokens++;
      }
    });
    
    // 4-2. 생산자명 추출
    const producers = extractProducer(name_en, name_kr);
    producers.forEach(producer => {
      if (saveTokenMapping(producer, supplier, 'producer')) {
        stats.producers++;
      }
    });
    
    // 4-3. 품종 추출
    const varietals = extractVarietal(name_en, name_kr);
    varietals.forEach(({ en, kr }) => {
      saveTokenMapping(en, kr, 'varietal');
      stats.varietals++;
    });
    
    // 4-4. 품목 별칭 저장
    // 영문명의 약어
    const enWords = name_en.split(/[\s,]+/).filter(w => w.length >= 3);
    if (enWords.length >= 2) {
      const abbr = enWords.slice(0, 2).map(w => w[0]).join('').toLowerCase();
      if (saveItemAlias(abbr, item_no, name_kr)) {
        stats.aliases++;
      }
    }
    
    // 한글명의 초성
    if (name_kr.length >= 4) {
      const chosung = extractConsonants(name_kr);
      if (chosung.length >= 3) {
        if (saveItemAlias(chosung, item_no, name_kr)) {
          stats.aliases++;
        }
      }
    }
    
    // 공급자명 약어
    if (supplier.length >= 3) {
      const supplierAbbr = supplier.split(/\s+/).map(w => w[0]).join('').toLowerCase();
      if (saveItemAlias(supplierAbbr, item_no, name_kr)) {
        stats.aliases++;
      }
    }
  }
  
  console.log('\n=== 학습 완료 ===');
  console.log(`- 토큰 매핑: ${stats.tokens}개`);
  console.log(`- 생산자명: ${stats.producers}개`);
  console.log(`- 품종: ${stats.varietals}개`);
  console.log(`- 품목 별칭: ${stats.aliases}개`);
  
  // 5. 검증
  console.log('\n=== 학습 결과 검증 ===');
  
  const tokenCount = db.prepare('SELECT COUNT(*) as cnt FROM token_mapping').get();
  console.log(`token_mapping 테이블: ${tokenCount.cnt}개`);
  
  const aliasCount = db.prepare('SELECT COUNT(*) as cnt FROM item_alias').get();
  console.log(`item_alias 테이블: ${aliasCount.cnt}개`);
  
  // 샘플 출력
  console.log('\n=== 토큰 매핑 샘플 (10개) ===');
  const tokenSamples = db.prepare('SELECT * FROM token_mapping LIMIT 10').all();
  tokenSamples.forEach(t => {
    console.log(`${t.token} -> ${t.canonical} (${t.source}, freq: ${t.frequency})`);
  });
  
  console.log('\n=== 품목 별칭 샘플 (10개) ===');
  const aliasSamples = db.prepare('SELECT * FROM item_alias LIMIT 10').all();
  aliasSamples.forEach(a => {
    console.log(`${a.alias} -> ${a.canonical} (count: ${a.count})`);
  });
}

// 실행
learnFromEnglishSheet()
  .then(() => {
    console.log('\n✅ 학습 완료!');
    db.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 에러 발생:', err);
    db.close();
    process.exit(1);
  });
