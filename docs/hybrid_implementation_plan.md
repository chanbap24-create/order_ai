# 🎯 실전 구현 계획: PyTorch 기반 학습 시스템

## 📋 **현실적인 2단계 접근법**

### **Stage 1: 하이브리드 시스템 (빠른 효과 + ML 준비)**
```
현재 시스템 (규칙 기반)
    +
토큰 매핑 학습 (간단)
    +
ML 데이터 수집 (백그라운드)
```
**목표**: 2주 내 배포, 즉시 효과

### **Stage 2: 완전 ML 시스템 (장기 강화)**
```
PyTorch 모델
    +
실시간 학습
    +
자동 패턴 인식
```
**목표**: 1개월 후 전환, 지속적 개선

---

## 🚀 **Stage 1: 하이브리드 시스템 (즉시 구현)**

### **핵심 아이디어**
```
1. 사용자 선택 → 토큰 자동 추출 → 매핑 저장
2. 검색 시 토큰 변환 → 확장 검색
3. ML 학습용 데이터 동시 수집
```

### **데이터베이스 스키마**
```sql
-- 토큰 매핑 (즉시 활용)
CREATE TABLE token_mapping (
  token TEXT PRIMARY KEY,              -- "ch", "bl", "샤도"
  mapped_text TEXT NOT NULL,           -- "찰스하이직", "로쉬벨렌", "샤르도네"
  token_type TEXT DEFAULT 'producer',  -- producer, varietal, region
  confidence REAL DEFAULT 1.0,         -- 학습 횟수 기반 신뢰도
  learned_count INTEGER DEFAULT 1,
  last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ML 학습용 데이터 (백그라운드 수집)
CREATE TABLE ml_training_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,                 -- "ch 샤르도네 24병"
  query_normalized TEXT NOT NULL,      -- "ch 샤르도네"
  selected_item_no TEXT NOT NULL,      -- "3A24401"
  selected_item_name TEXT NOT NULL,    -- "찰스하이직 샤르도네 2022"
  rejected_items TEXT,                 -- JSON: ["3B12345", "3C67890"]
  client_code TEXT,
  features TEXT,                       -- JSON: {recent: 0.8, freq: 0.9, ...}
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 토큰 출현 빈도 (자동 생성)
CREATE TABLE token_frequency (
  token TEXT PRIMARY KEY,
  item_no TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  last_seen TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### **자동 학습 로직**
```typescript
// app/lib/autoLearn.ts

/**
 * 사용자가 후보를 선택했을 때 자동 학습
 */
export function learnFromSelection(
  query: string,
  selectedItem: { item_no: string; item_name: string },
  rejectedItems: Array<{ item_no: string; item_name: string }>,
  clientCode: string
) {
  // 1. 입력 토큰 추출
  const queryTokens = extractTokens(query);
  // ["ch", "샤르도네"]
  
  // 2. 선택된 품목에서 핵심 키워드 추출
  const itemKeywords = extractKeywords(selectedItem.item_name);
  // {
  //   producer: "찰스하이직",
  //   varietal: "샤르도네",
  //   vintage: "2022"
  // }
  
  // 3. 토큰 → 키워드 매핑 자동 생성
  for (const token of queryTokens) {
    // 생산자 약어 감지
    if (isProducerAbbreviation(token, itemKeywords.producer)) {
      upsertTokenMapping(token, itemKeywords.producer, 'producer');
    }
    
    // 품종 약어 감지
    if (isVarietalAbbreviation(token, itemKeywords.varietal)) {
      upsertTokenMapping(token, itemKeywords.varietal, 'varietal');
    }
  }
  
  // 4. ML 학습 데이터 저장 (나중에 활용)
  saveMLTrainingData({
    query,
    query_normalized: stripQtyAndUnit(query),
    selected_item_no: selectedItem.item_no,
    selected_item_name: selectedItem.item_name,
    rejected_items: rejectedItems.map(r => r.item_no),
    client_code: clientCode,
    features: extractFeatures(clientCode, selectedItem.item_no)
  });
}

/**
 * 토큰 → 키워드 매핑 감지
 */
function isProducerAbbreviation(token: string, producer: string): boolean {
  const t = token.toLowerCase();
  const p = producer.toLowerCase();
  
  // 1. 첫 글자들로 이루어진 약어?
  const words = p.split(' ').filter(Boolean);
  const initials = words.map(w => w[0]).join('');
  if (t === initials) return true;
  
  // 2. 자음만 추출한 약어? (한글)
  const consonants = extractConsonants(p);
  if (t === consonants) return true;
  
  // 3. 영문 약어?
  if (words.length >= 2) {
    const englishInitials = words
      .filter(w => /[a-z]/i.test(w))
      .map(w => w[0])
      .join('');
    if (t === englishInitials.toLowerCase()) return true;
  }
  
  return false;
}

/**
 * 한글 자음 추출
 */
function extractConsonants(text: string): string {
  const CHOSUNG = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
    'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];
  
  let consonants = '';
  for (const char of text) {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      const chosungIndex = Math.floor(code / 588);
      consonants += CHOSUNG[chosungIndex];
    }
  }
  return consonants;
}

/**
 * 토큰 매핑 저장
 */
function upsertTokenMapping(
  token: string,
  mappedText: string,
  tokenType: string
) {
  db.prepare(`
    INSERT INTO token_mapping (token, mapped_text, token_type, learned_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(token) DO UPDATE SET
      mapped_text = excluded.mapped_text,
      token_type = excluded.token_type,
      learned_count = learned_count + 1,
      confidence = MIN(1.0, confidence + 0.1),
      last_used_at = CURRENT_TIMESTAMP
  `).run(token, mappedText, tokenType);
  
  console.log(`[AutoLearn] 토큰 매핑: "${token}" → "${mappedText}" (${tokenType})`);
}
```

### **검색 시 토큰 확장**
```typescript
// app/lib/queryExpander.ts

/**
 * 학습된 토큰 매핑으로 검색어 확장
 */
export function expandQuery(rawQuery: string): {
  original: string;
  expanded: string;
  tokens: Array<{ original: string; expanded: string; type: string }>;
} {
  const normalized = stripQtyAndUnit(rawQuery);
  const tokens = extractTokens(normalized);
  
  const expandedTokens = tokens.map(token => {
    // 학습된 매핑 조회
    const mapping = db.prepare(`
      SELECT mapped_text, token_type, confidence
      FROM token_mapping
      WHERE token = ?
      ORDER BY confidence DESC, learned_count DESC
      LIMIT 1
    `).get(token) as any;
    
    if (mapping && mapping.confidence >= 0.5) {
      return {
        original: token,
        expanded: mapping.mapped_text,
        type: mapping.token_type
      };
    }
    
    return {
      original: token,
      expanded: token,
      type: 'unknown'
    };
  });
  
  const expandedQuery = expandedTokens.map(t => t.expanded).join(' ');
  
  console.log(`[QueryExpand] "${normalized}" → "${expandedQuery}"`);
  
  return {
    original: normalized,
    expanded: expandedQuery,
    tokens: expandedTokens
  };
}
```

### **검색에 적용**
```typescript
// app/lib/resolveItemsWeighted.ts

export function resolveItemsByClientWeighted(...) {
  return items.map((it) => {
    // ✨ 검색어 확장
    const { original, expanded, tokens } = expandQuery(it.name);
    
    console.log(`[Search] Original: "${original}"`);
    console.log(`[Search] Expanded: "${expanded}"`);
    tokens.forEach(t => {
      if (t.original !== t.expanded) {
        console.log(`  - "${t.original}" → "${t.expanded}" (${t.type})`);
      }
    });
    
    // 기존 검색 (원본)
    const masterRows1 = fetchFromMasterByTail(original, 40);
    
    // ✨ 확장된 검색어로 추가 검색
    const masterRows2 = fetchFromMasterByTail(expanded, 40);
    
    // 후보 풀 합치기
    const poolMap = new Map();
    for (const r of [...clientRows, ...masterRows1, ...masterRows2]) {
      poolMap.set(r.item_no, r);
    }
    
    const pool = Array.from(poolMap.values());
    
    // 점수 계산 시 확장된 쿼리도 고려
    const scored = pool.map(r => {
      const score1 = scoreItem(normalizeItemName(original), r.item_name);
      const score2 = scoreItem(normalizeItemName(expanded), r.item_name);
      
      // 확장된 검색어가 더 높은 점수면 우선 (학습 효과)
      const baseScore = Math.max(score1, score2 * 1.2); // 확장 검색 20% 부스트
      
      return {
        ...r,
        score: baseScore
        // ... 추가 가중치 계산
      };
    });
    
    // ...
  });
}
```

---

## 📊 **Stage 1 효과 예측**

### **시나리오: "ch 샤르도네" 3번 선택**

#### **1회차**
```
입력: "ch 샤르도네"
확장: "ch 샤르도네" (매핑 없음)
후보: 샤르도네 들어간 100개
선택: "찰스하이직 샤르도네"

학습:
  - "ch" → "찰스하이직" (producer) 저장
  - confidence: 0.5
```

#### **2회차**
```
입력: "ch 샤르도네"
확장: "찰스하이직 샤르도네" ← ✨ 토큰 변환!
후보: 찰스하이직 샤르도네 관련 10개 (정확도 향상!)
선택: "찰스하이직 샤르도네"

학습:
  - "ch" → "찰스하이직" (confidence: 0.6)
```

#### **3회차**
```
입력: "ch 샤르도네"
확장: "찰스하이직 샤르도네"
후보: 찰스하이직 샤르도네 관련 10개
1위: "찰스하이직 샤르도네 2022" (score 0.95) ← 자동 확정!

학습:
  - "ch" → "찰스하이직" (confidence: 0.7)
```

---

## 🧠 **Stage 2: PyTorch 전환 (1개월 후)**

### **Stage 1에서 수집된 데이터 활용**
```sql
-- ml_training_data 테이블에 1000건+ 데이터 축적
SELECT COUNT(*) FROM ml_training_data;
-- → 1247건

-- 이 데이터로 PyTorch 모델 초기 학습
```

### **전환 과정**
```
1. Python 환경 구축 (1주)
2. Stage 1 데이터 → PyTorch 학습 (1주)
3. FastAPI 서버 배포 (3일)
4. 점진적 전환 (A/B 테스트) (1주)
```

### **하이브리드 운영**
```typescript
// Stage 1 (토큰 매핑) + Stage 2 (PyTorch) 동시 사용

const score1 = getTokenMappingScore(query, item); // 빠름
const score2 = await getPyTorchScore(query, item); // 정확함

// 앙상블
const finalScore = score1 * 0.3 + score2 * 0.7;
```

---

## ✅ **추천 실행 계획**

### **Week 1-2: Stage 1 구현**
- [ ] token_mapping 테이블 생성
- [ ] ml_training_data 테이블 생성
- [ ] autoLearn.ts 구현
- [ ] queryExpander.ts 구현
- [ ] resolveItemsWeighted.ts 통합
- [ ] 테스트 및 배포

### **Week 3-4: 데이터 수집 & 모니터링**
- [ ] 학습 데이터 축적 (목표: 500건+)
- [ ] 토큰 매핑 정확도 모니터링
- [ ] 사용자 피드백 수집

### **Month 2: PyTorch 개발**
- [ ] Python 환경 구축
- [ ] PyTorch 모델 개발
- [ ] 수집된 데이터로 초기 학습
- [ ] FastAPI 서버 구축

### **Month 3: 통합 & 최적화**
- [ ] TypeScript ↔ Python 통합
- [ ] A/B 테스트
- [ ] 성능 비교 및 전환
- [ ] 지속적 개선

---

## 🎯 **이 계획의 장점**

1. **즉시 효과**: Stage 1은 2주 내 배포 가능
2. **점진적 개선**: 데이터 쌓이면서 자연스럽게 개선
3. **리스크 최소화**: 기존 시스템 유지하면서 추가
4. **ML 준비**: 데이터 수집으로 PyTorch 전환 준비
5. **장기 비전**: 최종적으로 강력한 ML 시스템 완성

---

**Stage 1부터 시작하시겠어요?** 🚀

예상 일정:
- 설계: 1일
- 구현: 3일
- 테스트: 1일
- 배포: 1일
- **총 1주일 내 완성!**
