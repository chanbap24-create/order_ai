# 🚀 학습 데이터 기반 검색 정확도 개선 방안

## 📋 **현재 문제점**

### **현재 흐름**
```
입력: "ch 샤르도네"
  ↓
1. 거래처 이력 검색 (client_item_stats) → 모든 품목
2. 마스터 검색 (fetchFromMasterByTail) → "샤르도네" 키워드 80개
3. 영문명 검색 (item_english) → "ch", "샤르도네" 패턴 20개
  ↓
후보 풀: 100+ 개 품목
  ↓
점수 계산: 100개 모두 점수 계산 후 정렬
  ↓
학습 보너스: 이때 비로소 학습 데이터 활용
```

**문제**: 
- 학습 데이터를 **점수 계산 단계에서만** 활용
- 검색 단계에서는 **무관한 품목들도 다량 포함**
- 계산 비용 증가 + 정확도 저하

---

## 💡 **개선 방안: 학습 기반 Smart Search**

### **개선된 흐름**
```
입력: "ch 샤르도네"
  ↓
0. 학습 데이터 우선 조회 ← ✨ 새로 추가!
   - item_alias 테이블에서 "ch" 매칭 확인
   - search_learning 테이블에서 "ch샤르도네" 매칭 확인
   - 학습된 품목번호들을 우선 후보로 추가
  ↓
1. 거래처 이력 검색 (기존)
2. 마스터 검색 (기존)
3. 영문명 검색 (기존)
  ↓
후보 풀: 학습된 품목(우선) + 일반 검색 결과
  ↓
점수 계산: 학습 보너스 추가 적용
```

**효과**:
- ✅ 학습된 품목이 **검색 단계부터 우선 포함**
- ✅ 정확도 향상 + 계산 비용 최적화
- ✅ 학습 데이터의 효과 극대화

---

## 🔧 **구체적 구현 방안**

### **방안 1: 학습 후보 우선 주입 (추천)**

#### **장점**
- ✅ 기존 로직 유지하면서 학습 효과 극대화
- ✅ 학습된 품목이 후보 풀에 확실히 포함
- ✅ 간단한 구현 (기존 코드 수정 최소)

#### **구현**
```typescript
// app/lib/resolveItemsWeighted.ts

export function resolveItemsByClientWeighted(...) {
  return items.map((it) => {
    // ✨ Step 0: 학습 데이터 우선 조회
    const learnedCandidates = getLearnedCandidates(it.name, clientCode);
    
    // Step 1: 거래처 이력 후보
    const clientRows = db.prepare(`...`).all(clientCode);
    
    // Step 2: 마스터 후보
    const masterRows = fetchFromMasterByTail(it.name, 80);
    
    // Step 3: 영문명 후보
    const englishRows = [...];
    
    // ✨ 후보 풀 = 학습 후보(우선) + 기존 후보
    const poolMap = new Map();
    
    // 학습 후보를 먼저 추가 (최우선!)
    for (const r of learnedCandidates) {
      poolMap.set(r.item_no, { 
        item_no: r.item_no, 
        item_name: r.item_name,
        _isLearned: true  // 학습 후보 마킹
      });
    }
    
    // 기존 후보 추가
    for (const r of clientRows) poolMap.set(r.item_no, r);
    for (const r of masterRows) poolMap.set(r.item_no, r);
    for (const r of englishRows) poolMap.set(r.item_no, r);
    
    const pool = Array.from(poolMap.values());
    
    // ... 이후 점수 계산은 기존 로직 유지
  });
}

// ✨ 새로운 함수: 학습된 후보 조회
function getLearnedCandidates(
  rawInput: string, 
  clientCode: string
): Array<{ item_no: string; item_name: string; source: string }> {
  const candidates: Array<{ item_no: string; item_name: string; source: string }> = [];
  
  // 1) item_alias에서 학습된 별칭 매칭
  const learned = getLearnedMatch(rawInput);
  if (learned?.canonical) {
    // 품목번호로 실제 품목 조회
    const itemRows = db.prepare(`
      SELECT item_no, item_name 
      FROM client_item_stats 
      WHERE client_code = ? AND item_no = ?
    `).all(clientCode, learned.canonical) as any[];
    
    for (const r of itemRows) {
      candidates.push({
        item_no: String(r.item_no),
        item_name: String(r.item_name),
        source: 'item_alias'
      });
    }
  }
  
  // 2) search_learning에서 자주 선택한 품목 조회
  const searchBonuses = getSearchLearningBonuses(rawInput, 10); // 상위 10개
  for (const b of searchBonuses) {
    const itemRows = db.prepare(`
      SELECT item_no, item_name 
      FROM client_item_stats 
      WHERE client_code = ? AND item_no = ?
    `).all(clientCode, b.item_no) as any[];
    
    for (const r of itemRows) {
      candidates.push({
        item_no: String(r.item_no),
        item_name: String(r.item_name),
        source: 'search_learning'
      });
    }
  }
  
  // 중복 제거
  const uniqueMap = new Map<string, typeof candidates[0]>();
  for (const c of candidates) {
    if (!uniqueMap.has(c.item_no)) {
      uniqueMap.set(c.item_no, c);
    }
  }
  
  return Array.from(uniqueMap.values());
}
```

---

### **방안 2: 동적 검색 우선순위 조정 (고급)**

#### **장점**
- ✅ 학습 데이터에 따라 검색 전략 자동 조정
- ✅ 최적화 극대화 (불필요한 검색 생략 가능)
- ✅ 학습이 많을수록 검색 속도도 빨라짐

#### **구현**
```typescript
function resolveItemsByClientWeighted(...) {
  return items.map((it) => {
    const learned = getLearnedMatch(it.name);
    const searchBonuses = getSearchLearningBonuses(it.name, 10);
    
    // ✨ 학습 데이터 신뢰도 평가
    const hasStrongLearning = learned?.kind === 'exact' || learned?.kind === 'contains_specific';
    const hasFrequentSearch = searchBonuses.length > 0 && searchBonuses[0].hit_count >= 5;
    
    let pool: Array<{ item_no: string; item_name: string }> = [];
    
    if (hasStrongLearning || hasFrequentSearch) {
      // ✅ 강한 학습이 있으면 검색 범위 축소
      console.log(`[Smart Search] 학습 데이터 우선 모드: ${it.name}`);
      
      // 학습된 후보만 우선 조회
      const learnedCandidates = getLearnedCandidates(it.name, clientCode);
      pool.push(...learnedCandidates);
      
      // 거래처 이력은 조회 (빠름)
      const clientRows = db.prepare(`...`).all(clientCode);
      pool.push(...clientRows);
      
      // 마스터 검색은 제한적으로 (20개만)
      const masterRows = fetchFromMasterByTail(it.name, 20);
      pool.push(...masterRows);
      
    } else {
      // ❌ 학습 데이터 없으면 기존 방식 (전체 검색)
      console.log(`[Smart Search] 전체 검색 모드: ${it.name}`);
      
      const clientRows = db.prepare(`...`).all(clientCode);
      const masterRows = fetchFromMasterByTail(it.name, 80);
      const englishRows = [...];
      
      pool.push(...clientRows, ...masterRows, ...englishRows);
    }
    
    // 중복 제거 후 점수 계산
    const poolMap = new Map();
    for (const r of pool) poolMap.set(r.item_no, r);
    const uniquePool = Array.from(poolMap.values());
    
    // ... 점수 계산
  });
}
```

---

### **방안 3: 학습 기반 검색어 확장 (창의적)**

#### **아이디어**
- 사용자가 "ch"라고 입력하면 → 학습 데이터에서 "찰스하이직"으로 자동 확장
- 약어 → 전체 이름 변환으로 검색 정확도 향상

#### **구현**
```typescript
// 학습 데이터에서 약어 → 전체 이름 매핑 추출
function expandSearchQuery(rawInput: string): string[] {
  const queries = [rawInput]; // 원본 검색어
  
  // item_alias에서 학습된 별칭 찾기
  const learned = getLearnedMatch(rawInput);
  if (learned?.canonical) {
    // 품목번호로 실제 품목명 조회
    const itemRow = db.prepare(`
      SELECT item_name FROM client_item_stats WHERE item_no = ? LIMIT 1
    `).get(learned.canonical) as any;
    
    if (itemRow?.item_name) {
      // "3A24401 찰스하이직 샤르도네 2022" → "찰스하이직"
      const producerName = extractProducerName(itemRow.item_name);
      if (producerName) {
        queries.push(producerName); // 확장 검색어 추가
      }
    }
  }
  
  return queries;
}

// 사용 예시
const searchQueries = expandSearchQuery("ch 샤르도네");
// → ["ch 샤르도네", "찰스하이직 샤르도네"]

// 확장된 검색어로 더 정확한 검색
for (const query of searchQueries) {
  const masterRows = fetchFromMasterByTail(query, 40);
  pool.push(...masterRows);
}
```

---

## 📊 **효과 비교**

### **Before (현재)**
```
입력: "ch 샤르도네"

검색 후보: 100+ 개 (대부분 무관한 품목)
- 샤르도네가 들어간 모든 품목
- 찰스하이직은 후보에 포함되지만 낮은 순위

점수 계산:
- 찰스하이직: 0.60 (기본) + 1.20 (학습) = 1.80
- 샤또 샤르도네: 0.85 (기본) = 0.85

결과: 찾긴 하지만 후보가 너무 많음
```

### **After (방안 1 적용)**
```
입력: "ch 샤르도네"

✨ 학습 후보 우선 조회:
- "ch" → "3A24401 찰스하이직 샤르도네" (item_alias)
- "ch샤르도네" → "3A24401" (search_learning, 5회 클릭)

검색 후보: 50개 (학습 후보 우선 + 일반 검색)
- 찰스하이직 샤르도네 (학습 후보, 최우선)
- 기타 샤르도네 품목들

점수 계산:
- 찰스하이직: 0.60 + 1.20 + 0.29 = 2.09 ✅
- 샤또 샤르도네: 0.85

결과: 찰스하이직이 확실한 1위, 후보 수 감소
```

### **After (방안 2 적용)**
```
입력: "ch 샤르도네"

✨ 학습 신뢰도 평가:
- learned.kind = 'contains_weak'
- hit_count = 5 (frequent)
→ 학습 우선 모드 활성화

검색 후보: 30개 (학습 + 거래처 + 제한적 마스터)
- 마스터 검색 80개 → 20개로 축소
- 검색 속도 향상

결과: 빠르고 정확한 검색
```

---

## 🎯 **추천 구현 순서**

### **Phase 1: 방안 1 (학습 후보 우선 주입)**
- 구현 난이도: ★☆☆☆☆
- 효과: ★★★★☆
- 기존 로직 영향: 최소
- **지금 바로 구현 가능**

### **Phase 2: 방안 2 (동적 검색 우선순위)**
- 구현 난이도: ★★☆☆☆
- 효과: ★★★★★
- 검색 성능까지 개선
- Phase 1 완료 후 추가

### **Phase 3: 방안 3 (검색어 확장)**
- 구현 난이도: ★★★☆☆
- 효과: ★★★☆☆
- 창의적이지만 복잡도 증가
- 필요시 추가

---

## ✅ **구현하시겠어요?**

**방안 1 (학습 후보 우선 주입)**을 먼저 구현해드릴까요?

예상 효과:
- ✅ "ch" 학습 시 검색 정확도 크게 향상
- ✅ 학습된 품목이 확실히 후보에 포함
- ✅ 기존 로직 유지하면서 안전한 개선
- ✅ 구현 시간: 10분

**지금 바로 구현해 드릴까요?** 🚀
