# 🚨 Vercel SQLite Write 문제 해결

## 문제 원인
- **Vercel Serverless Functions는 읽기 전용 파일 시스템**
- SQLite의 `INSERT`, `UPDATE`, `DELETE` 작업이 불가능
- 로컬에서는 작동하지만 Vercel에서는 500 에러 발생

## 해결된 API
- ✅ `/api/learn-client` - 읽기 전용으로 변경
- ⏳ `/api/delete-item-alias` - 수정 필요
- ⏳ `/api/learn-item-alias` - 수정 필요

## 옵션 선택

### Option 1: 클라이언트 저장 (현재 적용 중) ⭐
**장점:**
- 빠른 구현
- 추가 비용 없음
- 사용자별 학습 데이터 독립적

**단점:**
- 브라우저 변경 시 데이터 손실
- 여러 기기 간 동기화 불가

**구현:**
```typescript
// 클라이언트에서 localStorage 사용
const learnedClients = JSON.parse(
  localStorage.getItem('learnedClients') || '[]'
);
```

### Option 2: Vercel Postgres (권장) 🎯
**장점:**
- 완전한 Read/Write 지원
- 데이터 영구 저장
- 여러 기기 간 동기화
- Vercel 통합 우수

**단점:**
- 추가 설정 필요
- 소량 비용 발생 (Free tier 있음)

**구현:**
```bash
# Vercel Dashboard에서 Postgres 추가
# 자동으로 환경 변수 설정됨
```

### Option 3: Turso (SQLite 호환) 🔥
**장점:**
- SQLite 문법 그대로 사용
- 마이그레이션 최소화
- 빠른 성능

**단점:**
- 새로운 서비스 가입 필요
- SDK 추가 필요

---

## 다음 단계

### 즉시 적용 (5분)
1. 나머지 Write API 읽기 전용으로 변경
2. 배포 및 테스트

### 장기 개선 (1시간)
1. Vercel Postgres 설정
2. 학습 테이블 마이그레이션
3. API 업데이트

