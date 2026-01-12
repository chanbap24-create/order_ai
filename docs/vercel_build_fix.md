# Vercel 빌드 에러 수정

## 🐛 문제

Vercel 배포 시 TypeScript 타입 에러 발생:

```
Type error: Object literal may only specify known properties, 
and 'manual_input' does not exist in type '{ recent_purchase?: number; ... }'
```

**에러 위치**: `app/api/learn-item-alias/route.ts:141:11`

---

## ✅ 수정 내용

### 1. **타입 정의 확장** (`app/lib/autoLearn.ts`)

**Before:**
```typescript
export interface LearnFromSelectionInput {
  // ...
  features?: {
    recent_purchase?: number;
    frequency?: number;
    vintage?: number;
  };
}
```

**After:**
```typescript
export interface LearnFromSelectionInput {
  // ...
  features?: {
    recent_purchase?: number;
    frequency?: number;
    vintage?: number;
    manual_input?: boolean;      // ✅ 추가
    source?: string;              // ✅ 추가
    [key: string]: any;           // ✅ 확장 가능
  };
}
```

### 2. **.gitignore 업데이트**

SQLite 임시 파일 무시 추가:
```gitignore
# SQLite database files
*.sqlite3-shm
*.sqlite3-wal
```

---

## 📊 영향 범위

### 수정된 파일
- `app/lib/autoLearn.ts`: 타입 정의 확장
- `.gitignore`: SQLite 임시 파일 추가

### 영향받는 API
- `POST /api/learn-item-alias`: 수동 학습 API
- `learnFromSelection()`: 자동 학습 함수

---

## 🧪 검증

### 타입 체크 통과
```typescript
// 이제 정상 작동
learnFromSelection({
  query: rawAlias,
  selectedItem: { ... },
  rejectedItems: [],
  clientCode: 'manual_learning',
  features: {
    manual_input: true,    // ✅ OK
    source: 'learn_item_alias_api'  // ✅ OK
  }
});
```

### Vercel 배포
- 타입 에러 해결
- 빌드 성공 예상

---

## 📝 커밋 내역

```bash
f8a677c - fix: LearnFromSelectionInput 타입에 manual_input, source 추가
```

**변경 사항:**
- features 속성에 `manual_input`, `source` 필드 추가
- `[key: string]: any`로 확장 가능하도록 수정
- .gitignore에 SQLite shm/wal 파일 추가

---

## 🚀 배포 상태

- [x] 타입 에러 수정
- [x] Git 커밋
- [ ] GitHub 푸시 (네트워크 이슈로 대기 중)
- [ ] Vercel 자동 배포

**GitHub 푸시 대기 중** - 네트워크 타임아웃으로 인해 수동 푸시 필요

---

## 💡 참고

### 타입 확장 이유
1. **수동 학습 지원**: `manual_input: true`로 수동 입력 구분
2. **소스 추적**: `source` 필드로 학습 출처 기록
3. **확장성**: `[key: string]: any`로 향후 필드 추가 용이

### 관련 코드
```typescript
// app/api/learn-item-alias/route.ts:140
features: {
  manual_input: true,           // 수동 학습 플래그
  source: 'learn_item_alias_api' // 소스 추적
}
```

---

## ✅ 결론

TypeScript 타입 에러가 해결되었으며, Vercel 빌드가 정상적으로 진행될 것으로 예상됩니다.

GitHub 푸시만 완료되면 Vercel이 자동으로 배포를 시작합니다.
