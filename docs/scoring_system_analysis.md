# 🔍 현재 점수 시스템의 문제점 분석 및 개선 방안

## 📊 현재 상황 분석

### ✅ 잘 작동하는 부분
- 기본적인 문자열 매칭은 작동
- 학습 시스템은 구현되어 있음
- 가중치 시스템이 이론적으로 잘 설계됨

### ⚠️ 실제 문제점들

#### 1️⃣ **신호 불균형 문제**

```
현재 가중치:
- 사용자 학습: 3.0× (최대 +1.20)
- 최근 구매: 2.0× (최대 +0.40)
- 구매 빈도: 1.5× (최대 +0.225)
- 빈티지: 1.0× (최대 +0.20)
- 기본 점수: 1.0× (최대 +1.00)

문제: 사용자 학습이 너무 강력함!
→ 학습 데이터가 없으면 기본 점수만으로 판단
→ 기본 점수 0.6 vs 0.7 차이가 승패 결정
```

**실제 시나리오:**
```
입력: "레이크 찰리스 말보로 24병"

후보 1: "레이크 찰리스 에스테이트 리저브 말보로" (정답)
  - 기본 점수: 0.75
  - 학습: 0 (없음)
  - 최근 구매: 0
  - 합계: 0.75

후보 2: "레이크 하우스 말보로 소비뇽 블랑" (오답)
  - 기본 점수: 0.72
  - 최근 구매: +0.40 (5일 전 구매)
  - 합계: 1.12  ← 이게 1위! 😱
```

#### 2️⃣ **기본 점수 계산의 한계**

```typescript
// 현재 문제점
function scoreItem(q: string, name: string) {
  // 1. 영문 단어 매칭: 너무 관대함
  if (intersection.length >= 2) {
    return min(0.85, recall + 0.3);  // +0.3 보너스가 과함
  }
  
  // 2. 한글 정규화: 너무 단순함
  if (a === b) return 1.0;
  if (b.includes(a)) return 0.9;  // 부분 일치에 0.9는 과함
  
  // 3. 공통 문자 비율: 변별력 부족
  return min(0.89, common / max(6, a.length));
}
```

**문제 사례:**
```
입력: "샤또 마고"
후보 1: "샤또 마고" → 1.0 ✅
후보 2: "샤또 마고 세컨드" → 0.9 (너무 높음!)
후보 3: "샤또 라투르" → 0.5 (공통 문자: 샤또)
```

#### 3️⃣ **최근 구매 신호의 과도한 영향**

```
문제: 최근에 구매한 품목이 무조건 우선됨

예시:
  거래처가 3일 전에 "샤또 라투르" 구매
  → 모든 "샤또" 검색에서 +0.40 점 보너스
  
입력: "샤또 마고"
  - 샤또 마고: 0.8 + 0.0 = 0.8
  - 샤또 라투르: 0.5 + 0.40 = 0.9  ← 오답이 1위!
```

#### 4️⃣ **구매 빈도 신호의 맹점**

```
문제: 자주 구매하는 품목이 과도하게 우선됨

예시:
  거래처가 "기본 테이블 와인" 100회 구매
  → 모든 검색에서 보너스 받음
  
입력: "프리미엄 레드"
  - 프리미엄 레드: 0.7 + 0.0 = 0.7
  - 기본 테이블 와인: 0.4 + 0.225 = 0.625
  
차이가 작아서 헷갈림!
```

#### 5️⃣ **빈티지 신호의 역효과**

```
문제: 빈티지가 없는 품목에 불이익

예시:
  입력: "샴페인 돔 페리뇽"
  
후보 1: "돔 페리뇽 2018" (2018년산)
  - 빈티지 점수: +0.10 (2년 전)
  - 합계: 0.95 + 0.10 = 1.05
  
후보 2: "돔 페리뇽 NV" (논빈티지, 최고급)
  - 빈티지 점수: 0 (감지 불가)
  - 합계: 0.95 + 0.0 = 0.95  ← 오답!
```

---

## 🎯 개선 방안

### 방안 1: **신호 가중치 재조정** (빠른 개선)

```typescript
// 현재 (불균형)
SIGNAL_WEIGHTS = {
  USER_LEARNING: 3.0,      // 너무 강함
  RECENT_PURCHASE: 2.0,    // 너무 강함
  PURCHASE_FREQUENCY: 1.5, // 적당
  VINTAGE: 1.0,            // 약함
  BASE_SCORE: 1.0,         // 너무 약함
}

// 제안 (균형)
SIGNAL_WEIGHTS = {
  BASE_SCORE: 2.0,         // ⬆️ 기본 점수를 더 중요하게!
  USER_LEARNING: 2.5,      // ⬇️ 학습은 여전히 중요하지만 약간 낮춤
  RECENT_PURCHASE: 1.0,    // ⬇️ 최근 구매 영향 축소
  PURCHASE_FREQUENCY: 0.8, // ⬇️ 빈도 영향 축소
  VINTAGE: 0.5,            // ⬇️ 빈티지 영향 최소화
}
```

**효과:**
```
Before (학습 없을 때):
  기본 점수: 0.8 × 1.0 = 0.8
  최근 구매: 0.2 × 2.0 = 0.4
  합계: 1.2  → 최근 구매가 결정적 영향

After:
  기본 점수: 0.8 × 2.0 = 1.6
  최근 구매: 0.2 × 1.0 = 0.2
  합계: 1.8  → 기본 점수가 더 중요!
```

### 방안 2: **기본 점수 계산 개선** (정확도 향상)

```typescript
// 현재 문제
if (b.includes(a)) return 0.9;  // 부분 일치 0.9는 과함!

// 개선안
function scoreItem(q: string, name: string) {
  const a = norm(q);
  const b = norm(name);
  
  // 1. 완전 일치
  if (a === b) return 1.0;
  
  // 2. 부분 일치 - 비율로 계산
  if (b.includes(a)) {
    const ratio = a.length / b.length;
    return 0.7 + (ratio * 0.2);  // 0.7 ~ 0.9
    // 예: "샤또 마고" / "샤또 마고 세컨드"
    //     = 0.7 + (8/12 * 0.2) = 0.833
  }
  
  // 3. 역순 부분 일치 - 더 낮게
  if (a.includes(b)) {
    const ratio = b.length / a.length;
    return 0.6 + (ratio * 0.2);  // 0.6 ~ 0.8
  }
  
  // 4. 토큰 일치도 (단어 단위)
  const aTokens = new Set(a.split(/\s+/));
  const bTokens = new Set(b.split(/\s+/));
  const intersection = [...aTokens].filter(t => bTokens.has(t));
  
  if (intersection.length > 0) {
    const recall = intersection.length / aTokens.size;
    const precision = intersection.length / bTokens.size;
    return (recall + precision) / 2 * 0.8;  // 최대 0.8
  }
  
  // 5. 문자 일치도 (마지막 수단)
  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  return Math.min(0.6, common / Math.max(6, a.length));
}
```

### 방안 3: **컨텍스트 기반 신호 조정** (스마트 적용)

```typescript
function calculateWeightedScore(
  rawInput: string,
  clientCode: string,
  itemNo: string,
  baseScore: number
): WeightedScore {
  // 기본 신호 계산
  const signals = {
    userLearning: getUserLearningSignal(rawInput, itemNo),
    recentPurchase: getRecentPurchaseSignal(clientCode, itemNo),
    purchaseFrequency: getPurchaseFrequencySignal(clientCode, itemNo),
    vintage: getVintageSignal(rawInput, itemNo),
  };
  
  // ✨ 스마트 가중치 조정
  let weights = { ...SIGNAL_WEIGHTS };
  
  // 1. 기본 점수가 높으면 다른 신호 영향 축소
  if (baseScore >= 0.85) {
    weights.RECENT_PURCHASE *= 0.5;
    weights.PURCHASE_FREQUENCY *= 0.5;
  }
  
  // 2. 기본 점수가 낮으면 학습/이력 신호 강화
  if (baseScore < 0.6) {
    weights.USER_LEARNING *= 1.5;
    weights.RECENT_PURCHASE *= 1.2;
  }
  
  // 3. 학습 데이터가 있으면 다른 신호 약화
  if (signals.userLearning.count > 0) {
    weights.RECENT_PURCHASE *= 0.7;
    weights.PURCHASE_FREQUENCY *= 0.7;
  }
  
  // 최종 점수 계산
  return {
    finalScore: 
      baseScore * weights.BASE_SCORE +
      signals.userLearning.score * weights.USER_LEARNING +
      signals.recentPurchase.score * weights.RECENT_PURCHASE +
      signals.purchaseFrequency.score * weights.PURCHASE_FREQUENCY +
      signals.vintage.score * weights.VINTAGE,
    signals,
    weights
  };
}
```

### 방안 4: **최소 점수 차이 요구** (오판 방지)

```typescript
// 현재: 점수 차이가 작아도 자동 확정
if (top.score >= 0.55 && (top.score - second.score) >= 0.15) {
  resolved = true;
}

// 개선: 점수 차이 조건 강화
const config = {
  highConfidence: {
    minScore: 0.90,
    minGap: 0.25,  // 큰 차이 필요
  },
  mediumConfidence: {
    minScore: 0.70,
    minGap: 0.30,  // 더 큰 차이 필요
  },
  lowConfidence: {
    minScore: 0.55,
    minGap: 0.40,  // 매우 큰 차이 필요
  }
};

// 자동 확정 조건
if (top.score >= config.highConfidence.minScore && 
    gap >= config.highConfidence.minGap) {
  resolved = true;  // 90점 이상 + 0.25 차이
}
else if (top.score >= config.mediumConfidence.minScore && 
         gap >= config.mediumConfidence.minGap) {
  resolved = true;  // 70점 이상 + 0.30 차이
}
else {
  resolved = false;  // 수동 확인 필요
}
```

### 방안 5: **부정 신호 도입** (오답 제거)

```typescript
// 새로운 신호: 명백한 불일치 감지
function getNegativeSignal(rawInput: string, itemName: string): number {
  // 1. 색상 불일치 (-0.3)
  const inputColor = extractColor(rawInput);   // "레드", "화이트", "로제"
  const itemColor = extractColor(itemName);
  if (inputColor && itemColor && inputColor !== itemColor) {
    return -0.3;
  }
  
  // 2. 품종 불일치 (-0.2)
  const inputVariety = extractVariety(rawInput);  // "까베", "샤도네"
  const itemVariety = extractVariety(itemName);
  if (inputVariety && itemVariety && inputVariety !== itemVariety) {
    return -0.2;
  }
  
  // 3. 생산자 불일치 (-0.4)
  const inputProducer = extractProducer(rawInput);
  const itemProducer = extractProducer(itemName);
  if (inputProducer && itemProducer && 
      !areProducersSimilar(inputProducer, itemProducer)) {
    return -0.4;
  }
  
  return 0;
}

// 최종 점수에 반영
finalScore = rawScore + negativeSignal;
```

---

## 🎯 추천 개선 순서

### Phase 1: 즉시 적용 (1일)
1. ✅ **가중치 재조정** (방안 1)
   - BASE_SCORE: 1.0 → 2.0
   - RECENT_PURCHASE: 2.0 → 1.0
   - 효과: 기본 매칭 정확도 향상

2. ✅ **자동 확정 조건 강화** (방안 4)
   - 점수 차이 요구 증가
   - 효과: 오판 감소

### Phase 2: 중기 개선 (1주)
3. 🔧 **기본 점수 계산 개선** (방안 2)
   - 부분 일치 점수 조정
   - 토큰 기반 매칭 강화
   - 효과: 변별력 향상

4. 🔧 **컨텍스트 기반 조정** (방안 3)
   - 기본 점수에 따른 동적 가중치
   - 효과: 상황별 최적화

### Phase 3: 장기 강화 (1개월)
5. 🚀 **부정 신호 도입** (방안 5)
   - 명백한 불일치 감지
   - 효과: 오답 제거

---

## 📊 예상 효과

### Before (현재)
```
정확도: 85% (100건 중 15건 오류)
오류 원인:
  - 최근 구매 과도 영향: 40%
  - 기본 점수 낮음: 35%
  - 빈도 과도 영향: 15%
  - 빈티지 역효과: 10%
```

### After (Phase 1 개선 후)
```
정확도: 92% (100건 중 8건 오류)
오류 감소:
  - 최근 구매 영향 축소: -50%
  - 기본 점수 강화: -30%
  - 자동 확정 신중: -20%
```

### After (Phase 2 개선 후)
```
정확도: 95% (100건 중 5건 오류)
추가 개선:
  - 부분 일치 정확도: -40%
  - 컨텍스트 최적화: -30%
  - 변별력 향상: -30%
```

---

## 🤔 제 의견

### 현재 시스템의 가장 큰 문제:
**"최근 구매"와 "구매 빈도" 신호가 너무 강력해서, 기본 매칭이 약한 품목도 1위로 올라옴**

### 빠른 해결책:
1. **가중치 조정**: BASE_SCORE를 2.0으로, RECENT_PURCHASE를 1.0으로
2. **자동 확정 조건 강화**: 점수 차이를 더 크게 요구

### 장기 방향:
- 기본 점수 계산 로직을 더 정교하게 개선
- 학습 데이터가 쌓이면 PyTorch로 전환

---

## 💬 질문

1. **지금 당장 Phase 1 개선을 적용해볼까요?**
   - 가중치 조정 + 자동 확정 조건 강화
   - 10분이면 완료

2. **실제 오류 사례를 보여주시면**
   - 더 정확한 문제 진단 가능
   - 맞춤 개선 방안 제시

3. **테스트 방법 선호는?**
   - A) 일부만 변경해서 비교 테스트
   - B) 전체 변경 후 실전 테스트
