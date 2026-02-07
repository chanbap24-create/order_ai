# 🔍 자연어 품목 검색 처리 순서

## 전체 흐름 (순서대로)

```
사용자 입력
    ↓
1️⃣ 자연어 전처리 (preprocessNaturalLanguage)
    ↓
2️⃣ 검색어 확장 (expandQuery)
    ↓
3️⃣ 품목번호 정확 매칭 (0단계)
    ↓
4️⃣ 후보 수집 (여러 소스에서)
    ↓
5️⃣ 생산자 필터링 (선택적)
    ↓
6️⃣ 학습 기반 확정 (Exact/Specific)
    ↓
7️⃣ 가중치 점수 계산
    ↓
8️⃣ 자동 확정 조건 검사
    ↓
9️⃣ 신규 품목 검색 (필요시)
    ↓
결과 반환
```

---

## 📝 상세 단계별 설명

### 1️⃣ **자연어 전처리** (`preprocessNaturalLanguage`)
**위치**: `app/lib/naturalLanguagePreprocessor.ts`

```
입력: "클레멍라발레 샤블리 두병"
```

#### 1-1. 불필요한 표현 제거
```
제거 대상: 안녕하세요, 부탁드립니다, 감사합니다, 주문합니다 등
결과: "클레멍라발레 샤블리 두병"
```

#### 1-2. 별칭 확장 (⭐ 핵심!)
```
별칭 DB 조회:
  - "클레멍 라발리" → "CL"
  - "비온디산티" → "비온디산티"
  
공백 무시 매칭:
  - "클레멍라발레" = "클레멍 라발리" ✅
  - "클레멍 라 발 레" = "클레멍 라발리" ✅
  
결과: "CL 샤블리 두병"
```

#### 1-3. 수량 표현 정규화
```
한글 숫자 변환:
  - "두병" → "2병"
  - "세박스" → "3cs"
  
단위 통일:
  - "케이스" → "cs"
  - "박스" → "cs"
  - "개" → "병"
  
결과: "CL 샤블리 2병"
```

#### 1-4. 와인 용어 정규화
```
품종 약어 확장:
  - "샤도" → "샤르도네"
  - "까베" → "카베르네"
  - "소비" → "소비뇽"
  
영문 품종 한글화:
  - "chardonnay" → "샤르도네"
  - "cabernet" → "카베르네"
  - "sauvignon" → "소비뇽"
  
와인 타입:
  - "brut" → "브륏"
  - "dry" → "드라이"
  - "red" → "레드"
  - "white" → "화이트"
  
결과: "CL 샤르도네 2병" (만약 샤도로 입력했다면)
```

#### 1-5. 생산자명 정규화
```
생산자 약어:
  - "ch" → "샤또"
  - "dom" → "도멘"
  - "chateau" → "샤또"
  - "domaine" → "도멘"
  - "maison" → "메종"
  
결과: "CL 샤블리 2병"
```

**최종 전처리 결과**: `"CL 샤블리 2병"`

---

### 2️⃣ **검색어 확장** (`expandQuery`)
**위치**: `app/lib/queryExpander.ts`

```
입력: "CL 샤블리 2병"
```

#### 토큰 매핑 학습 활용
```
token_mapping 테이블 조회:
  - "샤블리" → ["샤블리", "Chablis", "샤블리 화이트"]
  - "CL" → ["CL", "Clement", "클레멍"]
  
확장된 검색어 생성:
  - 원본: "CL 샤블리"
  - 확장: "CL Chablis 클레멍 샤블리"
```

**결과**: 
- `hasExpansion: true`
- `expanded: "CL Chablis 클레멍 샤블리"`

---

### 3️⃣ **품목번호 정확 매칭** (0단계)
**우선순위**: 🥇 **최우선**

```
입력: "0884/33 6개"
```

#### 패턴 감지
```
정규식: /^([A-Z]?\d{4,7}[\/-]?\d{0,3})$/i

매칭 예시:
  - "0884/33" ✅
  - "D701049" ✅
  - "4015/01" ✅
  - "RD0447" ✅
```

#### 3-1. 와인잔 특별 처리
```
패턴: "RD 0884/33" (품목명 내부)

검색 순서:
  1) 거래처 이력 (client_item_stats)
     WHERE item_name LIKE '%RD 0884/33%'
  
  2) 마스터 테이블 (items/item_master)
     WHERE item_name LIKE '%RD 0884/33%'

발견 시:
  - 점수: 1.0
  - 즉시 확정 (거래처 이력) 또는 제안 (마스터)
```

#### 3-2. 일반 품목번호 매칭
```
검색 순서:
  1) 거래처 이력 (client_item_stats)
     WHERE item_no = '0884/33'
     
  2) 마스터 테이블 (items/item_master)
     WHERE item_no = '0884/33'
     
  3) 신규 품목 (master_items)
     WHERE item_no = '0884/33'

발견 시:
  - 점수: 1.0
  - method: "item_no_exact_client/master/new"
```

**결과**: 품목번호 발견 시 즉시 반환 (다음 단계 건너뜀)

---

### 4️⃣ **후보 수집** (여러 소스)
**품목번호 매칭 실패 시 진행**

```
입력: "CL 샤블리 2병"
```

#### 4-1. 거래처 이력 (`client_item_stats`)
```sql
SELECT item_no, item_name
FROM client_item_stats
WHERE client_code = '30709'  -- 베신임수
```

#### 4-2. 마스터 테이블 검색 (멀티 토큰)
**전략**: AND → Half → OR 순서

```
토큰 분리: ["CL", "샤블리"]

전략 1: AND 검색 (모든 토큰 포함) - 우선순위 3
  WHERE item_name LIKE '%CL%' AND item_name LIKE '%샤블리%'
  결과: 30개

전략 2: Half 검색 (절반 이상 포함) - 우선순위 2
  WHERE item_name LIKE '%CL%'
  결과: 40개

전략 3: OR 검색 (하나라도 포함) - 우선순위 1
  WHERE item_name LIKE '%CL%' OR item_name LIKE '%샤블리%'
  결과: 30개

총 후보: 중복 제거 후 우선순위 순 정렬
```

#### 4-3. 확장된 검색어로 재검색
```
확장 검색어: "CL Chablis 클레멍 샤블리"

마스터 테이블 재검색:
  - AND: LIKE '%CL%' AND LIKE '%Chablis%' ...
  - Half: LIKE '%CL%' AND LIKE '%Chablis%'
  - OR: LIKE '%CL%' OR LIKE '%Chablis%' ...
```

#### 4-4. 영문명 검색 (3글자 이상 영어)
```
영어 단어 추출: ["CL", "Chablis"]

item_english 테이블 조회:
  SELECT ie.item_no, cis.item_name, ie.name_en
  FROM item_english ie
  LEFT JOIN client_item_stats cis ON ie.item_no = cis.item_no
  WHERE LOWER(ie.name_en) LIKE '%chablis%'
```

#### 4-5. 후보 풀 통합 (중복 제거)
```
poolMap = {
  "D701049": { item_no: "D701049", item_name: "CL 샤블리 샹트 메흘르" },
  "D701050": { item_no: "D701050", item_name: "CL 샤블리 그랑크뤼" },
  ...
}

총 후보: 80개 (예시)
```

---

### 5️⃣ **생산자 필터링** (`detectProducer`)
**선택적 단계** (생산자 명시된 경우만)

```
입력: "비온디산티 브루넬로디 몬탈치노 12병"
```

#### 5-1. 생산자 감지
```
생산자 목록:
  한글: ['비온디산티', '알테시노', '가야', '안티노리', ...]
  영문: ['Biondi-Santi', 'Altesino', 'Gaja', 'Antinori', ...]

검색:
  1단계: 전체 문자열에서 가장 긴 매칭
    "비온디산티" 발견 ✅
    
  2단계: 첫 번째 토큰에서 매칭
    tokens[0] = "비온디산티" ✅
```

#### 5-2. 생산자 필터 적용
```
필터 전 후보: 80개

필터링:
  WHERE item_name LIKE '%비온디산티%'
  
필터 후 후보: 12개

제외된 품목 예시:
  ❌ "알테시노 브루넬로디 몬탈치노" (생산자 불일치)
  ❌ "안티노리 브루넬로" (생산자 불일치)
  ✅ "비온디산티 브루넬로디 몬탈치노 리제르바" (일치)
```

#### 5-3. 안전장치
```
if (filteredPool.length === 0) {
  console.warn("⚠️ 생산자 필터링 후 후보가 0개! 필터 무시");
  filteredPool = pool;  // 롤백
}
```

**결과**: 생산자가 일치하는 품목만 남김

---

### 6️⃣ **학습 기반 확정** (`getLearnedMatch`)
**우선순위**: 🥈 **높음**

```
입력: "클레멍 라발리 샤블리 2"
```

#### 6-1. item_alias 테이블 조회
```sql
SELECT alias, canonical, count
FROM item_alias
WHERE alias = '클레멍 라발리 샤블리'
  OR alias LIKE '%클레멍 라발리%'
ORDER BY LENGTH(alias) DESC
```

#### 6-2. 매칭 종류

**Exact 매칭** (kind: "exact")
```
입력(정규화): "클레멍라발리샤블리2"
별칭(정규화): "클레멍라발리샤블리2"

조건: 완전 일치
결과: 
  - 즉시 확정 ✅
  - score: 1.0
  - method: "alias_exact_item_no"
```

**Contains Specific 매칭** (kind: "contains_specific")
```
입력: "클레멍 라발리 샤블리 그랑크뤼 2021"
별칭: "클레멍 라발리 샤블리"

조건:
  - 별칭이 입력에 포함
  - 별칭이 충분히 구체적 (토큰 3개 이상 또는 12글자 이상)

결과:
  - 즉시 확정 ✅
  - score: 0.99
  - method: "alias_contains_specific_item_no"
```

**Contains Weak 매칭** (kind: "contains_weak")
```
입력: "CL 샤블리 2"
별칭: "CL"

조건:
  - 별칭이 입력에 포함
  - 별칭이 짧음 (토큰 2개 이하, 12글자 미만)

결과:
  - 즉시 확정 안함 ❌
  - 점수 계산 단계로 진행
  - 높은 신뢰도 필요 (score ≥ 0.88, gap ≥ 0.30)
```

**결과**: Exact/Specific 학습이면 즉시 확정, 아니면 점수 계산 진행

---

### 7️⃣ **가중치 점수 계산** (`calculateWeightedScore`)
**위치**: `app/lib/weightedScoring.ts`

```
입력: "CL 샤블리 2병"
후보: "CL 샤블리 샹트 메흘르 2021"
```

#### 7-1. 기본 점수 계산 (`scoreItem`)

**영문 단어 매칭 우선** (3글자 이상)
```
입력 영어 단어: ["CL", "Chablis"]
후보 영어 단어: ["CL", "Chablis", "Chante", "Merlur"]

교집합: ["CL", "Chablis"] = 2개

점수 계산:
  - 3개 이상 매칭: recall + precision / 2 + 0.2 (최대 0.95)
  - 2개 매칭: recall + 0.3 (최대 0.85)
  - 1개 이하: 한글 정규화 로직으로

결과: 0.80 (예시)
```

**한글 정규화 로직** (영문 단어 부족 시)
```
정규화:
  - 공백 제거
  - 소문자 변환
  - 특수문자 제거
  - 품종 약어 확장

입력: "clsauvignonblanc" → "cl소비뇽블랑"
후보: "cl소비뇽블랑레스토랑" → "cl소비뇽블랑레스토랑"

점수:
  - 완전 일치: 1.0
  - 포함 관계: 0.9
  - 글자 매칭: common / max(6, length)
```

#### 7-2. 가중치 시그널 수집

```javascript
signals = {
  baseScore: 0.80,           // 기본 점수 (20%)
  userLearning: 0.15,        // 사용자 학습 (25%)
  recentPurchase: 0.10,      // 최근 구매 (15%)
  purchaseFrequency: 0.20,   // 구매 빈도 (20%)
  vintage: 0.05,             // 빈티지 (10%)
}
```

**사용자 학습** (user_item_history)
```sql
SELECT item_no, alias
FROM user_item_history
WHERE user_id = 'current_user'
  AND item_no = 'D701049'
  AND alias LIKE '%CL%'
ORDER BY updated_at DESC
LIMIT 1
```

**최근 구매** (client_item_stats)
```sql
SELECT last_order_date, item_no
FROM client_item_stats
WHERE client_code = '30709'
  AND item_no = 'D701049'
```

**구매 빈도** (client_item_stats)
```sql
SELECT order_count, item_no
FROM client_item_stats
WHERE client_code = '30709'
  AND item_no = 'D701049'
```

**빈티지 매칭**
```
입력: "샤르도네 2021"
후보: "샤르도네 2021" → +0.05
후보: "샤르도네 2020" → 0
```

#### 7-3. 최종 점수 계산
```
rawTotal = 
  baseScore      * 0.20 (20%) +
  userLearning   * 0.25 (25%) +
  recentPurchase * 0.15 (15%) +
  purchaseFrequency * 0.20 (20%) +
  vintage        * 0.10 (10%)

예시:
  = 0.80 * 0.20 +   // 0.16
    0.15 * 0.25 +   // 0.0375
    0.10 * 0.15 +   // 0.015
    0.20 * 0.20 +   // 0.04
    0.05 * 0.10     // 0.005
  = 0.2575

finalScore = min(0.99, rawTotal)
```

#### 7-4. 확장 검색 부스트
```
원본 점수: 0.75
확장 점수: 0.80

최종 = max(0.75, 0.80 * 1.2) = max(0.75, 0.96) = 0.96
```

**결과**: 모든 후보에 대해 최종 점수 계산 완료

---

### 8️⃣ **자동 확정 조건 검사**

```
후보 리스트 (점수 순):
  1위: 0.92 - "CL 샤블리 샹트 메흘르"
  2위: 0.65 - "CL 샤블리 그랑크뤼"
  3위: 0.58 - "샤블리 도멘"
```

#### 8-1. 기본 조건
```
조건:
  - 1위 점수 ≥ minScore (0.55)
  - gap (1위 - 2위) ≥ minGap (0.15)

예시:
  score: 0.92 ≥ 0.55 ✅
  gap: 0.92 - 0.65 = 0.27 ≥ 0.15 ✅
  
결과: 자동 확정 가능 ✅
```

#### 8-2. 생산자 명시 시 엄격한 조건
```
생산자 감지: "비온디산티"

조건:
  - 점수 ≥ 0.85 (더 높음)
  - gap ≥ 0.25 (더 넓음)

예시:
  score: 0.78 < 0.85 ❌
  gap: 0.30 ≥ 0.25 ✅
  
결과: 자동 확정 불가 ❌ (수동 선택 필요)
```

#### 8-3. 토큰 3개 이상 시 고신뢰도 필요
```
입력: "클레멍 라발리 샤블리 그랑크뤼" (4개 토큰)

조건 (learned 없을 때):
  - 점수 ≥ 0.90 (highConfidenceScore)
  - gap ≥ 0.35 (highConfidenceGap)

또는:
  - 점수 ≥ 0.75 (minScore)
  - gap ≥ 0.25 (minGap)

예시:
  score: 0.88 < 0.90 ❌
  gap: 0.40 ≥ 0.35 ✅
  
결과: 자동 확정 불가 ❌ (0.90 미만)
```

**결과**: 조건 충족 시 resolved: true, 아니면 false

---

### 9️⃣ **신규 품목 검색** (필요시)
**조건**: 점수 < 0.70 또는 생산자 명시 시 < 0.85

```
1위 점수: 0.65 < 0.70 → 신규 품목 검색 실행
```

#### 9-1. master_items 검색
```
입력: "CL 샤블리"

searchMasterSheet(query, limit=5):
  - English 시트에서 검색
  - 유사도 계산
  - 상위 5개 반환
```

#### 9-2. 생산자 필터링 (선택적)
```
생산자: "비온디산티"

신규 품목 필터링:
  WHERE item_name LIKE '%비온디산티%'

결과:
  ✅ "비온디산티 브루넬로디 몬탈치노 리제르바 2017 (신규)"
  ❌ "알테시노 브루넬로" (제외)
```

#### 9-3. 제안 목록 구성
```
suggestions = [
  { 기존 품목 1위 },
  { 신규 품목 1위 },
  { 신규 품목 2위 },
  { 신규 품목 3위 }
]

최대 3-5개 제안
```

**결과**: 신규 품목이 상위에 포함된 제안 목록

---

## 🎯 최종 결과 구조

```javascript
{
  name: "클레멍라발레 샤블리 2",
  qty: 2,
  normalized_query: "CL 샤블리",
  resolved: true,  // 자동 확정 여부
  item_no: "D701049",
  item_name: "CL 샤블리 샹트 메흘르 2021",
  score: 0.92,
  method: "weighted",
  
  candidates: [
    { item_no: "D701049", item_name: "CL 샤블리 샹트 메흘르", score: 0.92 },
    { item_no: "D701050", item_name: "CL 샤블리 그랑크뤼", score: 0.65 },
    ...
  ],
  
  suggestions: [
    { item_no: "D701049", item_name: "CL 샤블리 샹트 메흘르", score: 0.92 },
    { item_no: "NEW001", item_name: "CL 샤블리 (신규)", score: 0.85, is_new_item: true },
    ...
  ]
}
```

---

## 🔧 설정 파일

### 중앙 설정 (`ITEM_MATCH_CONFIG`)
**위치**: `app/lib/itemMatchConfig.ts`

```typescript
export const ITEM_MATCH_CONFIG = {
  autoResolve: {
    minScore: 0.75,              // 기본 최소 점수
    minGap: 0.25,                // 기본 최소 격차
    highConfidenceScore: 0.90,   // 고신뢰도 점수
    highConfidenceGap: 0.35,     // 고신뢰도 격차
  },
  weights: {
    baseScore: 0.20,             // 20%
    userLearning: 0.25,          // 25%
    recentPurchase: 0.15,        // 15%
    purchaseFrequency: 0.20,     // 20%
    vintage: 0.10,               // 10%
  }
}
```

---

## 📊 실제 처리 예시

### 예시 1: "클레멍라발레 샤블리 2"

```
1️⃣ 전처리:
   입력: "클레멍라발레 샤블리 2"
   별칭 확장: "CL 샤블리 2"
   수량 정규화: "CL 샤블리 2병"

2️⃣ 검색어 확장:
   원본: "CL 샤블리"
   확장: "CL Chablis 클레멍 샤블리"

3️⃣ 품목번호: 매칭 없음 (품목명 입력)

4️⃣ 후보 수집:
   - 거래처 이력: 15개
   - 마스터(원본): 25개
   - 마스터(확장): 20개
   - 영문명: 10개
   총 후보: 40개 (중복 제거)

5️⃣ 생산자: 감지 안됨

6️⃣ 학습:
   - "클레멍 라발리" → "D701049" (Exact) ✅
   결과: 즉시 확정 🎉

최종:
   resolved: true
   item_no: "D701049"
   item_name: "CL 샤블리 샹트 메흘르 2021"
   score: 1.0
   method: "alias_exact_item_no"
```

### 예시 2: "비온디산티 브루넬로디 몬탈치노 12병"

```
1️⃣ 전처리:
   입력: "비온디산티 브루넬로디 몬탈치노 12병"
   별칭: 변경 없음
   수량: "12병"

2️⃣ 검색어 확장:
   확장: "비온디산티 Brunello Montalcino 브루넬로"

3️⃣ 품목번호: 없음

4️⃣ 후보 수집: 80개

5️⃣ 생산자:
   감지: "비온디산티" ✅
   필터링: 80개 → 12개

6️⃣ 학습: 없음

7️⃣ 점수 계산:
   1위: 0.88 - "비온디산티 브루넬로디 몬탈치노 리제르바 2016"
   2위: 0.55 - "비온디산티 브루넬로디 몬탈치노 2018"

8️⃣ 자동 확정 조건:
   생산자 명시 → 엄격 모드
   score: 0.88 ≥ 0.85 ✅
   gap: 0.33 ≥ 0.25 ✅
   결과: 자동 확정 ✅

최종:
   resolved: true
   item_no: "D805123"
   score: 0.88
```

### 예시 3: "0884/33 6개"

```
1️⃣ 전처리:
   입력: "0884/33 6개"
   별칭: ��경 없음
   수량: "6병"

2️⃣ 검색어 확장: 건너뜀

3️⃣ 품목번호:
   패턴 매칭: "0884/33" ✅
   
   와인잔 검색:
   - 거래처: "RD 0884/33 로프무스 레스토랑 샬렘린" 발견 ✅
   
   결과: 즉시 확정 🎉

최종:
   resolved: true
   item_no: "D701049"
   item_name: "RD 0884/33 로프무스 레스토랑 샬렘린"
   score: 1.0
   method: "glass_pattern_client"
```

---

## 🎨 결론

### 핵심 우선순위:
1. **품목번호 직접 입력** → 즉시 확정
2. **Exact 학습** → 즉시 확정
3. **생산자 필터링** → 정확도 향상
4. **가중치 시스템** → 자동 확정
5. **신규 품목 검색** → 보조 수단

### 주요 기능:
- ✅ 공백 무시 별칭 매칭
- ✅ 다중 소스 후보 수집
- ✅ 생산자 자동 필터링
- ✅ 학습 기반 자동 확정
- ✅ 신규 품목 자동 제안

---

**작성일**: 2026-01-15  
**버전**: 1.0  
**파일**: NATURAL_LANGUAGE_FLOW.md
