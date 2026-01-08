# 🚀 Stage 1: 토큰 매핑 학습 시스템 구현 완료

## ✅ **구현된 기능**

### **1. 데이터베이스 스키마**
- ✅ `token_mapping` 테이블: 토큰 → 키워드 매핑 저장
- ✅ `ml_training_data` 테이블: PyTorch 학습용 데이터 수집
- ✅ `token_frequency` 테이블: 토큰 출현 빈도 추적

### **2. 자동 학습 시스템** (`app/lib/autoLearn.ts`)
- ✅ 사용자 선택 → 자동 토큰 매핑 학습
- ✅ 생산자 약어 감지 (ch → 찰스하이직)
- ✅ 품종 약어 감지 (샤도 → 샤르도네)
- ✅ ML 데이터 자동 수집

### **3. 검색어 확장** (`app/lib/queryExpander.ts`)
- ✅ 학습된 매핑으로 검색어 자동 확장
- ✅ "ch 샤도" → "찰스하이직 샤르도네"
- ✅ 신뢰도 기반 필터링

### **4. 검색 통합** (`app/lib/resolveItemsWeighted.ts`)
- ✅ 원본 + 확장 검색어 동시 사용
- ✅ 확장 검색 20% 부스트
- ✅ 검색 로그 출력

### **5. API 엔드포인트** (`app/api/auto-learn/route.ts`)
- ✅ POST `/api/auto-learn`: 자동 학습 트리거

---

## 🔧 **프론트엔드 통합 방법**

### **Wine Order 페이지에 추가할 코드**

```typescript
// app/wine/page.tsx

// 후보 선택 시 자동 학습 호출
async function handleItemSelection(
  itemIndex: number,
  selectedItemNo: string,
  selectedItemName: string
) {
  const item = parsed_items[itemIndex];
  const suggestions = getTop4Suggestions(item);
  
  // 선택된 품목과 거부된 품목 분리
  const rejectedItems = suggestions
    .filter(s => s.item_no !== selectedItemNo)
    .map(s => ({
      item_no: s.item_no,
      item_name: s.item_name
    }));
  
  // ✨ 자동 학습 호출 (백그라운드)
  try {
    const response = await fetch('/api/auto-learn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: item.raw || item.name,  // 원본 입력
        selectedItem: {
          item_no: selectedItemNo,
          item_name: selectedItemName
        },
        rejectedItems,
        clientCode: client?.client_code,
        features: {
          recent_purchase: 0.8,  // 실제 값으로 대체
          frequency: 0.9,
          vintage: 0.7
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('[AutoLearn] 학습 완료:', result);
      
      // 학습 성공 피드백 (선택적)
      if (result.mappings && result.mappings.length > 0) {
        result.mappings.forEach((m: any) => {
          console.log(`✨ 학습: "${m.token}" → "${m.mapped}" (${m.type})`);
        });
      }
    }
  } catch (err) {
    console.error('[AutoLearn] 학습 실패:', err);
    // 실패해도 사용자 경험에는 영향 없음 (백그라운드 작업)
  }
  
  // 기존 확정 로직 계속 진행...
}
```

---

## 📊 **작동 방식**

### **시나리오: "ch 샤도" 3회 학습**

#### **1회차**
```
입력: "ch 샤도 24병"
검색: "ch 샤도" (확장 없음) → 후보 100개
사용자 선택: "찰스하이직 샤르도네 2022"

✨ 자동 학습:
  - "ch" → "찰스하이직" (producer, confidence: 0.5)
  - "샤도" → "샤르도네" (varietal, confidence: 0.5)
  - ML 데이터 저장 (ID: 1)
```

#### **2회차**
```
입력: "ch 샤도 24병"
검색:
  - 원본: "ch 샤도"
  - 확장: "찰스하이직 샤르도네" ← ✨ 토큰 변환!
  
후보: 찰스하이직 샤르도네 관련 10개 (정확도 향상!)
사용자 선택: "찰스하이직 샤르도네 2022"

✨ 자동 학습:
  - "ch" → "찰스하이직" (confidence: 0.6)
  - "샤도" → "샤르도네" (confidence: 0.6)
  - ML 데이터 저장 (ID: 2)
```

#### **3회차**
```
입력: "ch 샤도 24병"
검색:
  - 원본: "ch 샤도"
  - 확장: "찰스하이직 샤르도네"
  
후보: 찰스하이직 샤르도네 관련 5개
1위: "찰스하이직 샤르도네 2022" (score 1.15) ← 자동 확정!

✨ 자동 학습:
  - "ch" → "찰스하이직" (confidence: 0.7)
  - "샤도" → "샤르도네" (confidence: 0.7)
  - ML 데이터 저장 (ID: 3)
```

---

## 🧪 **테스트 방법**

### **1. 마이그레이션 확인**
```bash
npm run db:console:local
> SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%token%';
# token_mapping, ml_training_data, token_frequency 확인
```

### **2. 자동 학습 테스트**
```bash
# PM2 로그 확인
pm2 logs order-ai --nostream | grep -E '(AutoLearn|QueryExpand)'

# 예상 출력:
# [AutoLearn] 학습 시작: "ch 샤르도네" → 3A24401
# [AutoLearn] 입력 토큰: ["ch","샤르도네"]
# [AutoLearn] 키워드: producer="찰스하이직", varietal="샤르도네"
# [AutoLearn] 토큰 매핑: "ch" → "찰스하이직" (producer, count: 1)
# [QueryExpand] "ch 샤르도네" → "찰스하이직 샤르도네"
#   ✨ "ch" → "찰스하이직" (producer, confidence: 0.50)
```

### **3. 학습된 매핑 확인**
```bash
npm run db:console:local
> SELECT * FROM token_mapping ORDER BY confidence DESC, learned_count DESC;

# 예상 출력:
# token | mapped_text | token_type | confidence | learned_count
# ch    | 찰스하이직   | producer   | 0.7        | 3
# 샤도  | 샤르도네     | varietal   | 0.6        | 2
```

### **4. ML 데이터 수집 확인**
```bash
> SELECT COUNT(*) FROM ml_training_data;
> SELECT query_normalized, selected_item_name FROM ml_training_data LIMIT 5;
```

---

## 📈 **예상 효과**

### **즉시 효과 (1주 후)**
- ✅ 자주 쓰는 약어 자동 학습
- ✅ 검색 정확도 20-30% 향상
- ✅ 후보 개수 80% 감소

### **중기 효과 (1개월 후)**
- ✅ 100+ 토큰 매핑 학습
- ✅ 검색 정확도 50% 향상
- ✅ ML 데이터 500+ 건 수집

### **장기 효과 (3개월 후)**
- ✅ PyTorch 모델 전환 준비 완료
- ✅ 자동 패턴 인식 가능
- ✅ 거의 모든 약어 자동 처리

---

## 🚀 **다음 단계**

### **즉시 (오늘)**
1. ✅ 서버 재시작
2. ✅ 마이그레이션 확인
3. ✅ 로그 모니터링

### **1주 내**
1. [ ] Wine Order 페이지에 자동 학습 호출 추가
2. [ ] 실제 발주로 테스트
3. [ ] 학습 데이터 확인

### **1개월 후**
1. [ ] 학습된 매핑 리뷰
2. [ ] ML 데이터 분석
3. [ ] PyTorch 개발 시작

---

## 💡 **빠른 시작**

```bash
# 1. 서버 재시작
fuser -k 3000/tcp 2>/dev/null || true
pm2 restart order-ai

# 2. 로그 확인
pm2 logs order-ai --nostream | tail -50

# 3. 테스트 URL
# https://3000-ihrunfcj6wdldlndzi6r8-d0b9e1e2.sandbox.novita.ai/wine
```

---

**구현 완료! 이제 실제로 사용하면서 학습이 쌓이는 것을 확인하세요!** 🎉
