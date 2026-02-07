# 프로젝트 규칙 검토 및 개선 제안

## 📋 현재 프로젝트 상태 분석

### ✅ 잘 되어 있는 부분
1. **명확한 파일 구조**: API 라우트, lib 유틸리티 분리
2. **데이터베이스 스키마 관리**: `init_db.sql`로 스키마 버전 관리
3. **에러 처리 기본 구조**: try-catch 블록 사용
4. **TypeScript 사용**: 타입 안정성 기반 마련

---

## 🔴 강화가 필요한 영역

### 1. **타입 안정성 (Type Safety)**
**현재 문제점:**
- API 라우트에서 `any` 타입 과다 사용
- 응답 타입이 명확히 정의되지 않음
- 데이터베이스 쿼리 결과 타입이 없음

**개선 제안:**
```typescript
// app/types/api.ts 생성 필요
export type ParseFullOrderResponse = {
  success: boolean;
  status: "resolved" | "needs_review_client" | "needs_review_items";
  client?: ClientInfo;
  items?: ItemInfo[];
  // ...
};

// 모든 API 응답에 명시적 타입 적용
```

**우선순위: 🔴 높음**

---

### 2. **환경 변수 관리 (Environment Variables)**
**현재 문제점:**
- 필수 환경 변수 검증 없음
- `.env.example` 파일 없음
- 런타임에만 에러 발생 (빌드 타임 검증 없음)

**개선 제안:**
```typescript
// app/lib/env.ts 생성
const requiredEnvVars = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  // ...
} as const;

function validateEnv() {
  const missing = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  
  return requiredEnvVars;
}

export const env = validateEnv();
```

**우선순위: 🔴 높음**

---

### 3. **에러 처리 일관성 (Error Handling)**
**현재 문제점:**
- 에러 메시지 포맷이 라우트마다 다름
- 일부는 `errMsg()` 헬퍼 사용, 일부는 직접 처리
- HTTP 상태 코드가 일관되지 않음

**개선 제안:**
```typescript
// app/lib/errors.ts 생성
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  
  // 로깅 추가
  console.error("Unexpected error:", error);
  
  return NextResponse.json(
    { success: false, error: "Internal server error" },
    { status: 500 }
  );
}
```

**우선순위: 🟡 중간**

---

### 4. **입력 검증 (Input Validation)**
**현재 문제점:**
- API 요청 본문 검증이 최소한만 수행
- 타입 체크 없이 `body?.text ?? ""` 같은 패턴 사용
- SQL injection 방지가 prepared statement에만 의존

**개선 제안:**
```typescript
// app/lib/validation.ts 생성
import { z } from "zod"; // 또는 다른 validation 라이브러리

export const parseFullOrderSchema = z.object({
  message: z.string().min(1, "메시지가 필요합니다"),
  force_resolve: z.boolean().optional().default(false),
});

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data);
}
```

**우선순위: 🟡 중간**

---

### 5. **로깅 시스템 (Logging)**
**현재 문제점:**
- `console.log`만 사용
- 프로덕션/개발 환경 구분 없음
- 구조화된 로깅 없음

**개선 제안:**
```typescript
// app/lib/logger.ts 생성
type LogLevel = "debug" | "info" | "warn" | "error";

export const logger = {
  debug: (msg: string, meta?: object) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] ${msg}`, meta);
    }
  },
  info: (msg: string, meta?: object) => {
    console.log(`[INFO] ${msg}`, meta);
  },
  error: (msg: string, error?: unknown, meta?: object) => {
    console.error(`[ERROR] ${msg}`, { error, ...meta });
  },
};
```

**우선순위: 🟡 중간**

---

### 6. **데이터베이스 연결 관리 (Database Connection)**
**현재 문제점:**
- 연결 에러 처리 없음
- 트랜잭션 관리 없음
- 연결 풀링 없음 (better-sqlite3는 단일 연결)

**개선 제안:**
```typescript
// app/lib/db.ts 개선
export const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === "development" ? console.log : undefined,
});

// 연결 확인
db.pragma("journal_mode = WAL");

// 헬퍼 함수 추가
export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const transaction = db.transaction(fn);
  return transaction();
}
```

**우선순위: 🟢 낮음** (SQLite는 단일 연결이므로)

---

### 7. **설정 관리 (Configuration)**
**현재 문제점:**
- 설정값이 코드에 하드코딩됨
- 중앙 집중식 설정 파일 없음

**개선 제안:**
```typescript
// app/lib/config.ts 생성
export const config = {
  openai: {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    maxItems: parseInt(process.env.MAX_ITEMS || "20", 10),
  },
  matching: {
    minScore: parseFloat(process.env.MIN_MATCH_SCORE || "0.85"),
    minGap: parseFloat(process.env.MIN_SCORE_GAP || "0.15"),
  },
  // ...
} as const;
```

**우선순위: 🟢 낮음**

---

### 8. **테스트 (Testing)**
**현재 문제점:**
- 테스트 파일이 전혀 없음
- 단위 테스트, 통합 테스트 부재

**개선 제안:**
```typescript
// __tests__/lib/parseItems.test.ts 생성
// Jest 또는 Vitest 설정 추가
```

**우선순위: 🟡 중간** (프로젝트 규모에 따라)

---

### 9. **문서화 (Documentation)**
**현재 문제점:**
- README가 기본 Next.js 템플릿 그대로
- API 엔드포인트 문서 없음
- 환경 변수 설명 없음

**개선 제안:**
- README에 프로젝트 개요, 설치 방법, 환경 변수 설명 추가
- 각 API 라우트에 JSDoc 주석 추가

**우선순위: 🟡 중간**

---

### 10. **코드 일관성 (Code Consistency)**
**현재 문제점:**
- 함수 네이밍이 일관되지 않음 (camelCase vs snake_case 혼용)
- 주석 스타일이 다양함 (한글/영어 혼용)

**개선 제안:**
- ESLint 규칙 강화
- Prettier 설정 추가
- 코딩 컨벤션 문서 작성

**우선순위: 🟢 낮음**

---

## 📊 우선순위 요약

### 즉시 개선 필요 (🔴)
1. **타입 안정성 강화** - 런타임 에러 방지
2. **환경 변수 검증** - 배포 시 에러 방지

### 단기 개선 (🟡)
3. **에러 처리 일관성** - 유지보수성 향상
4. **입력 검증** - 보안 및 안정성
5. **로깅 시스템** - 디버깅 용이성
6. **문서화** - 온보딩 시간 단축

### 장기 개선 (🟢)
7. **설정 관리** - 유연성 향상
8. **코드 일관성** - 가독성 향상
9. **테스트** - 리팩토링 안전성

---

## 🎯 추천 구현 순서

1. **1주차**: 타입 정의 추가 + 환경 변수 검증
2. **2주차**: 에러 처리 통일 + 입력 검증
3. **3주차**: 로깅 시스템 + 기본 문서화

이 순서로 진행하면 프로젝트 안정성이 크게 향상됩니다.
