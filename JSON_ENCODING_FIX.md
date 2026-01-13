# JSON 한글 인코딩 문제 해결

## 📋 문제 상황

**증상:**
```json
{
  "item_name": "BL \uBB34\uB974\uACE0\uB258 \uC0E4\uB974\uB3C4\uB124 \uD034\uBCA0 \uB9AC\uC800\uBE0C"
}
```

**원인:**
- Next.js의 `NextResponse.json()`이 기본적으로 **ASCII 이스케이프**를 사용
- 한글 문자가 `\uXXXX` 형식으로 변환됨
- JSON은 유효하지만 **가독성 저하** 및 디버깅 어려움

---

## ✅ 해결 방법

### 1. 공통 헬퍼 함수 생성

**파일:** `app/lib/api-response.ts`

```typescript
import { NextResponse } from "next/server";

/**
 * 한글이 포함된 JSON을 올바르게 반환하는 헬퍼 함수
 * NextResponse.json()은 기본적으로 한글을 ASCII 이스케이프(\uXXXX)하므로
 * 명시적으로 Content-Type과 charset을 설정합니다.
 */
export function jsonResponse<T = any>(
  data: T,
  options: { status?: number; headers?: Record<string, string> } = {}
): Response {
  const { status = 200, headers = {} } = options;

  const jsonString = JSON.stringify(data, null, 2);

  return new Response(jsonString, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}
```

### 2. API Routes 수정

**변경 전:**
```typescript
return NextResponse.json({ item_name: "샤또마르고" });
```

**변경 후:**
```typescript
import { jsonResponse } from "@/app/lib/api-response";

return jsonResponse({ item_name: "샤또마르고" });
```

---

## 🔧 수정된 API 목록 (13개)

| API | 설명 |
|-----|------|
| `/api/parse-full-order` | 주문 전체 파싱 (가장 중요) |
| `/api/parse-order` | 간단 주문 파싱 |
| `/api/parse-order-v2` | 주문 파싱 v2 |
| `/api/parse-glass-order` | 와인잔 주문 파싱 |
| `/api/search-new-item` | 신규 품목 검색 |
| `/api/resolve-client` | 거래처 해결 |
| `/api/learn-client` | 거래처 학습 |
| `/api/learn-item-alias` | 품목 별명 학습 |
| `/api/learn-new-item` | 신규 품목 학습 |
| `/api/confirm-item-alias` | 품목 별명 확인 |
| `/api/delete-item-alias` | 품목 별명 삭제 |
| `/api/list-item-alias` | 품목 별명 목록 |
| `/api/sync-item-english` | 영문 동기화 |

---

## 🎯 결과

### Before (문제):
```json
{
  "item_no": "3020041",
  "item_name": "BL \uBB34\uB974\uACE0\uB258 \uC0E4\uB974\uB3C4\uB124 \uD034\uBCA0 \uB9AC\uC800\uBE0C",
  "score": 0.217
}
```

### After (해결):
```json
{
  "item_no": "3020041",
  "item_name": "BL 무르고뉴 샤르도네 퀴베 리저브",
  "score": 0.217
}
```

---

## 📝 추가 개선 사항

### 줄바꿈 정규화
- **문제:** Windows 스타일 줄바꿈(`\r\n`) 사용
- **해결:** Unix 스타일(`\n`)로 변환
- **명령어:** `sed -i 's/\r$//' <파일>`

### 자동화 스크립트
**파일:** `fix-json-encoding.sh`

```bash
#!/bin/bash
# 모든 API 라우트를 일괄 수정하는 스크립트

FILES=(
  "app/api/parse-full-order/route.ts"
  "app/api/search-new-item/route.ts"
  # ... 기타 파일들
)

for file in "${FILES[@]}"; do
  # CRLF → LF
  sed -i 's/\r$//' "$file"
  
  # import 추가
  sed -i '/^import.*NextResponse/a import { jsonResponse } from "@/app/lib/api-response";' "$file"
  
  # 교체
  sed -i 's/NextResponse\.json(/jsonResponse(/g' "$file"
done
```

---

## 🧪 테스트 방법

### 1. 로컬 테스트
```bash
curl http://localhost:3000/api/search-new-item \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"inputName": "샤또마르고", "topN": 3}'
```

### 2. 한글 확인
```bash
curl ... | jq '.candidates[0].item_name'
# 출력: "샤또마르고 2020" (한글 직접 표시)
```

---

## 💡 왜 이 방법이 필요한가?

### Next.js의 기본 동작
```typescript
NextResponse.json({ text: "한글" });
// → {"text":"\ud55c\uae00"}
```

### 명시적 헤더 설정
```typescript
new Response(JSON.stringify({ text: "한글" }), {
  headers: { "Content-Type": "application/json; charset=utf-8" }
});
// → {"text":"한글"}
```

**핵심:** `Content-Type` 헤더에 **`charset=utf-8`**를 명시해야 브라우저와 클라이언트가 UTF-8로 해석합니다.

---

## 📊 영향 범위

- ✅ **프론트엔드:** 한글 디코딩 불필요
- ✅ **디버깅:** 로그와 응답을 바로 읽을 수 있음
- ✅ **개발 경험:** JSON 응답 가독성 향상
- ✅ **호환성:** 모든 브라우저 및 HTTP 클라이언트 지원

---

## 🔗 관련 커밋

- **커밋 해시:** `2cac60f`
- **GitHub:** https://github.com/chanbap24-create/order_ai/commit/2cac60f
- **파일 수:** 15개 (13개 API + 1개 헬퍼 + 1개 스크립트)
- **변경 줄:** +473 / -364

---

## 🚀 배포

### Vercel 자동 배포
- GitHub에 푸시하면 **자동으로 배포** 시작
- 2-3분 후 새 빌드 반영

### 배포 확인
```bash
curl https://your-app.vercel.app/api/search-new-item \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"inputName": "샤또마르고"}'
```

**예상 응답:**
```json
{
  "success": true,
  "inputName": "샤또마르고",
  "candidates": [
    {
      "item_no": "1234567",
      "item_name": "샤또마르고 2020",
      "score": 0.95
    }
  ]
}
```

---

## 🎉 완료!

이제 모든 API에서 **한글이 직접 표시**됩니다!
