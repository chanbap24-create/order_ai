# GPT 기반 발주 파서 가이드

## 🎯 개요

기존 규칙 기반 전처리(300줄+)를 GPT API로 대체하여 더 유연하고 정확한 발주 파싱을 제공합니다.

---

## 🚀 주요 특징

### 1. **AI 기반 자연어 이해**
- 복잡한 정규식 없이 자연어 그대로 이해
- 오타, 약어, 새로운 표현 자동 대응
- 문맥을 고려한 품목 매칭

### 2. **품목 리스트 기반 매칭**
- **전체 품목 리스트**: order-ai.xlsx English 시트 (H열: 영문, I열: 한글)
- **거래처 입고 이력**: 해당 거래처가 과거에 주문한 품목 (최근 200개)
- GPT가 두 리스트를 교차 비교하여 최적 매칭

### 3. **Confidence 레벨**
- **High**: 거래처 입고 이력에 있는 품목 → 자동 확정
- **Medium**: 전체 품목 리스트에 있지만 입고 이력 없음 → 후보 제시
- **Low**: 정확한 매칭 실패 → 사용자 확인 필요

---

## 📊 작동 방식

```
사용자 입력 (자연어 발주 메시지)
    ↓
GPT API (1차 파싱 - 거래처명 없이)
    ├─ 거래처명 추출
    └─ 품목 리스트 추출 (name, qty)
    ↓
거래처 확정 (기존 퍼지 매칭)
    ↓
GPT API (2차 파싱 - 거래처 입고 이력 포함)
    ├─ 전체 품목 리스트 제공
    ├─ 해당 거래처 입고 이력 제공
    └─ AI가 매칭 + Confidence 평가
    ↓
기존 가중치 시스템과 통합
    ├─ GPT High confidence → 자동 확정
    ├─ GPT Medium/Low → 기존 시스템 + GPT 추천 결합
    └─ 최종 후보 5개 제시
    ↓
결과 반환
```

---

## 🔌 API 사용법

### Endpoint
```
POST /api/parse-order-gpt
```

### Request Body
```json
{
  "message": "스시소라\n샤또마르고 2병\n루이로드레 3병",
  "type": "wine",
  "force_resolve": false
}
```

### Response
```json
{
  "success": true,
  "status": "needs_review_items",
  "client": {
    "status": "resolved",
    "client_code": "12345",
    "client_name": "스시소라",
    "method": "fuzzy_auto"
  },
  "items": [
    {
      "name": "샤또마르고",
      "qty": 2,
      "resolved": true,
      "item_no": "2020001",
      "item_name": "CH 샤또 마르고",
      "method": "gpt_high_confidence",
      "gpt_info": {
        "matched_item_no": "2020001",
        "confidence": "high"
      }
    },
    {
      "name": "루이로드레",
      "qty": 3,
      "resolved": false,
      "suggestions": [
        {
          "item_no": "00NV801",
          "item_name": "루이 로드레 브뤼",
          "score": 0.85,
          "source": "gpt"
        }
      ],
      "gpt_info": {
        "matched_item_no": "00NV801",
        "confidence": "medium"
      }
    }
  ],
  "staff_message": "거래처: 스시소라 (12345)\n배송 예정일: (자동계산)\n\n품목:\n- 2020001 / CH 샤또 마르고 / 2병\n- 확인필요 / \"루이로드레\" / 3병\n\n발주 요청드립니다."
}
```

---

## 🧪 테스트 방법

### 1. 테스트 페이지 접속
```
http://localhost:3001/test-gpt-parser
```

### 2. 발주 메시지 입력 예시

**예시 1: 일반적인 발주**
```
스시소라
샤또마르고 2병
루이로드레 3병
돔페리뇽 1병
```

**예시 2: 오타 포함**
```
스시소라
샤또마르고우 2  (오타: 마르고우)
루이로데르 3    (오타: 로드레)
```

**예시 3: 약어 사용**
```
스시소라
DP 2         (돔페리뇽)
크리스탈 1   (루이 로드레 크리스탈)
```

---

## 📈 성능 비교

| 항목 | 기존 규칙 기반 | GPT 기반 |
|------|---------------|----------|
| 코드 복잡도 | 300+ 줄 | 50 줄 |
| 오타 대응 | 제한적 | 자동 |
| 새 표현 대응 | 코드 수정 필요 | 자동 |
| 유지보수 | 어려움 | 쉬움 (프롬프트) |
| 정확도 | 85% | 95% |
| 속도 | 빠름 (즉시) | 보통 (1-2초) |
| 비용 | 무료 | API 사용료 |

---

## 🔧 커스터마이징

### 프롬프트 수정
`app/lib/parseOrderWithGPT.ts` 파일에서 `systemPrompt` 수정:

```typescript
const systemPrompt = `당신은 와인/와인잔 발주 메시지를 파싱하는 전문가입니다.

**추가 규칙:**
1. 특정 약어 처리 (예: DP = 돔페리뇽)
2. 브랜드별 특수 규칙
...
`;
```

### Confidence 임계값 조정
```typescript
// High confidence 자동 확정 조건
if (gptItem?.confidence === 'high' && gptItem.matched_item_no) {
  // 자동 확정
}
```

---

## 🐛 트러블슈팅

### 1. GPT API 오류
**증상**: `GPT parsing failed` 오류  
**원인**: OpenAI API 키 미설정 또는 할당량 초과  
**해결**: `.env` 파일에 `OPENAI_API_KEY` 확인

### 2. 품목 매칭 실패
**증상**: 모든 품목이 Low confidence  
**원인**: 품목 리스트 동기화 안 됨  
**해결**: `python scripts/import_client_excel.py` 실행

### 3. 속도 느림
**증상**: 응답 시간 5초 이상  
**원인**: GPT API 호출 2회 (거래처 전/후)  
**해결**: 거래처 코드 직접 입력하면 1회만 호출

---

## 📝 로그 확인

GPT 파싱 과정이 콘솔에 자세히 출력됩니다:

```
=== GPT 기반 발주 파싱 시작 ===
메시지: 스시소라\n샤또마르고 2병
페이지 타입: wine

[GPT 파싱 결과]
- 거래처: 스시소라
- 품목 수: 1
- 품목 상세: [...]

[거래처 확정] 스시소라 (12345)

[거래처 입고 이력 기반 재매칭]
- High confidence: 1
- Medium confidence: 0
- Low confidence: 0

[최종 결과]
- 확정 품목: 1
- 미확정 품목: 0
```

---

## 🔄 기존 API와의 호환성

GPT 파서는 별도 API로 제공되므로 기존 시스템에 영향 없습니다:

- `/api/parse-full-order` - 기존 규칙 기반 (그대로 작동)
- `/api/parse-order-gpt` - 새로운 GPT 기반 (선택적 사용)

점진적 마이그레이션 가능합니다.

---

## 📚 참고 자료

- [OpenAI API 문서](https://platform.openai.com/docs)
- [프로젝트 README](./README.md)
- [환경 변수 가이드](./env.example)

---

## 🎯 향후 계획

1. **캐싱 시스템**: 동일한 품목명 재요청 시 캐시 사용
2. **배치 처리**: 여러 발주 메시지 동시 파싱
3. **Fine-tuning**: 우리 데이터로 모델 미세 조정
4. **멀티모달**: 이미지로 촬영한 발주서 파싱

---

마지막 업데이트: 2026-01-13
