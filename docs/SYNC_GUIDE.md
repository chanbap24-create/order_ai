# 📦 Order AI - 주문 자동화 시스템

## 🔄 일일 자동 동기화 설정 가이드

### 개요
이 시스템은 **하루 1회** 전산 시스템 API를 호출하여 최신 데이터를 동기화합니다.
실시간 호출이 아닌 **배치 방식**으로 동작하여 API 서버 부담을 최소화합니다.

---

## 📋 동작 방식

```
┌─────────────────────────────────────────────────────────┐
│  [매일 오전 9시 자동 실행]                                │
│                                                          │
│  1. Vercel Cron Job 트리거                               │
│  2. /api/sync-daily 호출                                 │
│  3. 전산 시스템 API에서 데이터 조회                       │
│  4. SQLite DB에 저장                                     │
│  5. 완료! 하루 종일 저장된 데이터 사용                    │
│                                                          │
│  API 호출 빈도: 하루 1회 (월 30회)                       │
│  소요 시간: 약 5분                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 환경변수 설정

### Vercel 대시보드에서 설정:

1. Vercel 프로젝트 접속: https://vercel.com
2. **Settings** → **Environment Variables** 클릭
3. 다음 변수 추가:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `COMPANY_API_URL` | `https://api.company.com` | 전산 시스템 API 베이스 URL |
| `COMPANY_API_KEY` | `your-api-key-here` | API 인증키 |

### 로컬 개발 환경:

`.env.local` 파일 생성:
```bash
COMPANY_API_URL=https://api.company.com
COMPANY_API_KEY=your-api-key-here
```

---

## 📊 필요한 API 엔드포인트

전산팀에 요청할 API 목록:

### 1. 거래처 정보
```
GET {COMPANY_API_URL}/api/clients

Response:
[
  {
    "client_code": "30709",
    "client_name": "베신임수",
    "phone": "010-1234-5678",
    "address": "서울시 강남구"
  }
]
```

### 2. 품목 정보
```
GET {COMPANY_API_URL}/api/items

Response:
[
  {
    "item_no": "D701049",
    "item_name": "RD 0884/33 로프무스 레스토랑 샬렘린",
    "supply_price": 25000,
    "category": "glass"
  }
]
```

### 3. 거래 이력 (최근 6개월)
```
GET {COMPANY_API_URL}/api/transactions?from=6m

Response:
[
  {
    "transaction_id": "TX12345",
    "client_code": "30709",
    "item_no": "D701049",
    "quantity": 6,
    "unit_price": 25000,
    "date": "2025-01-15"
  }
]
```

---

## ⏰ 스케줄 설정

### Vercel Cron Job (자동 설정됨)

`vercel.json` 파일에서 스케줄 확인:
```json
{
  "crons": [
    {
      "path": "/api/sync-daily",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**스케줄:** `0 9 * * *` (매일 오전 9시 KST)

### 스케줄 변경 방법:

```json
"schedule": "0 9 * * *"   // 매일 오전 9시
"schedule": "0 6 * * *"   // 매일 오전 6시
"schedule": "0 9 * * 1-5" // 평일만 오전 9시
"schedule": "0 */6 * * *" // 6시간마다
```

---

## 🧪 테스트 방법

### 수동 동기화 테스트:

브라우저에서 직접 호출:
```
https://order-ai-one.vercel.app/api/sync-daily
```

**응답 예시 (성공):**
```json
{
  "success": true,
  "method": "api",
  "message": "전산 시스템 API 동기화 완료",
  "stats": {
    "clients": 150,
    "items": 450,
    "transactions": 1200
  },
  "duration": 4523,
  "timestamp": "2025-01-15T09:00:05.123Z"
}
```

**응답 예시 (API 미설정 - 엑셀 사용):**
```json
{
  "success": true,
  "method": "excel",
  "message": "엑셀 파일에서 동기화 완료",
  "result": {
    "synced": true,
    "reason": "file_changed"
  },
  "duration": 1234
}
```

---

## 📈 모니터링

### Vercel 대시보드에서 확인:

1. **Logs** 탭:
   - 동기화 성공/실패 로그
   - 오류 메시지
   - 처리 시간

2. **Analytics** 탭:
   - API 호출 횟수
   - 응답 시간
   - 에러율

### 로그 예시:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[SYNC] 일일 데이터 동기화 시작
[SYNC] 시작 시간: 2025-01-15 09:00:00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[SYNC] 전산 시스템 API 호출 중...
[SYNC] API 호출: https://api.company.com/api/clients
[SYNC] 성공: 150개 항목
[SYNC] API 호출: https://api.company.com/api/items
[SYNC] 성공: 450개 항목
[SYNC] 데이터베이스 저장 중...
[SYNC] 거래처 150개 저장 중...
[SYNC] 품목 450개 저장 중...
[SYNC] DB 저장 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[SYNC] 동기화 완료! (4523ms)
[SYNC] 거래처: 150개
[SYNC] 품목: 450개
[SYNC] 거래 이력: 1200개
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔒 보안 고려사항

### ✅ 적용된 보안 조치:

- [x] **HTTPS 전용**: TLS 암호화 통신
- [x] **API 키 보관**: 환경변수에 안전하게 저장
- [x] **읽기 전용**: 데이터 조회만 (수정 권한 없음)
- [x] **타임아웃 설정**: 30초 제한
- [x] **로깅**: 모든 동기화 기록
- [x] **최소 권한**: 필요한 데이터만 접근

---

## 🚨 문제 해결

### Q1: 동기화가 실행되지 않아요
**A:** Vercel Cron Job 확인
1. Vercel 대시보드 → Settings → Cron Jobs
2. 스케줄 활성화 확인
3. 최근 실행 로그 확인

### Q2: API 오류가 나요
**A:** 환경변수 확인
1. `COMPANY_API_URL` 정확한지 확인
2. `COMPANY_API_KEY` 유효한지 확인
3. 전산팀에 API 상태 문의

### Q3: 데이터가 업데이트 안 돼요
**A:** 수동 동기화 시도
1. `https://order-ai-one.vercel.app/api/sync-daily` 호출
2. 응답 메시지 확인
3. 에러 메시지 있으면 개발팀 문의

### Q4: API가 없어요
**A:** 엑셀 방식 계속 사용
- 환경변수 설정 안 하면 자동으로 엑셀 사용
- `order-ai.xlsx` 파일 업데이트하면 됨
- API 준비되면 나중에 연결 가능

---

## 📞 지원

문제 발생 시:
1. Vercel Logs 확인
2. `/api/sync-daily` 수동 호출 테스트
3. 개발팀 문의 (에러 메시지 포함)

---

## 🎯 장점 요약

| 항목 | 기존 (수동) | 개선 (자동) |
|------|------------|------------|
| 업데이트 빈도 | 수동 (불규칙) | 매일 오전 9시 |
| 작업 시간 | 10분/일 | 0분 (자동) |
| API 호출 | - | 하루 1회 |
| 데이터 신선도 | 하루 이상 지연 | 최대 1일 지연 |
| 에러 가능성 | 사람 실수 | 자동 재시도 |

---

**마지막 업데이트:** 2025-01-15
