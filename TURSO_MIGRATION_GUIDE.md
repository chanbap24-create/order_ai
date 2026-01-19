# Turso 마이그레이션 가이드

## 📋 개요

SQLite 데이터베이스를 Turso (libSQL) 클라우드로 마이그레이션합니다.

## ✅ 장점

- ✅ **SQLite 호환:** 기존 코드 최소 수정
- ✅ **무료 티어:** 9GB 스토리지, 무제한 읽기/쓰기
- ✅ **Edge 최적화:** 빠른 응답 속도
- ✅ **학습 기능 유지:** 별칭 학습, 자동 학습 모두 작동

## 🔧 설정 방법

### 1️⃣ Turso CLI 설치 및 로그인

**로컬 환경에서 실행:**

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (PowerShell)
irm get.tur.so/install.ps1 | iex

# 로그인 (GitHub 계정 사용)
turso auth login
```

### 2️⃣ Turso 데이터베이스 생성

```bash
# 데이터베이스 생성
turso db create order-ai

# 접속 URL 확인
turso db show order-ai

# 토큰 생성
turso db tokens create order-ai
```

**출력 예시:**
```
Name:           order-ai
URL:            libsql://order-ai-[your-username].turso.io
Auth Token:     eyJhbGc...
```

### 3️⃣ 로컬 DB를 Turso로 마이그레이션

```bash
# 현재 프로젝트 디렉토리에서
cd /path/to/webapp

# 로컬 SQLite DB를 Turso로 업로드
turso db shell order-ai < migrate_to_turso.sql

# 또는 직접 연결해서 테이블 확인
turso db shell order-ai
```

### 4️⃣ 환경 변수 설정

**Vercel 환경 변수 추가:**

```bash
# Vercel CLI 사용
vercel env add TURSO_DATABASE_URL
# 입력: libsql://order-ai-[your-username].turso.io

vercel env add TURSO_AUTH_TOKEN
# 입력: eyJhbGc... (토큰)
```

**또는 Vercel Dashboard에서:**
1. https://vercel.com/dashboard
2. 프로젝트 선택 → Settings → Environment Variables
3. 추가:
   - `TURSO_DATABASE_URL` = `libsql://order-ai-[your-username].turso.io`
   - `TURSO_AUTH_TOKEN` = `eyJhbGc...`

**로컬 개발용 (.env.local 파일 생성):**
```bash
TURSO_DATABASE_URL=libsql://order-ai-[your-username].turso.io
TURSO_AUTH_TOKEN=eyJhbGc...
```

### 5️⃣ 패키지 설치

```bash
npm install @libsql/client
```

---

## 📝 코드 수정 사항

아래 파일들이 자동으로 수정됩니다:

1. **app/lib/db.ts** - Turso 클라이언트로 전환
2. **package.json** - @libsql/client 추가

기존 코드는 대부분 그대로 작동합니다!

---

## 🧪 테스트 방법

### 로컬 테스트
```bash
npm run dev
```

### 프로덕션 배포
```bash
git add .
git commit -m "feat: Turso 마이그레이션"
git push origin main
```

---

## 📊 현재 데이터

- **item_alias:** 504개 별칭
- **client_item_stats:** 834개 품목
- **clients:** 152개 거래처

모두 Turso로 마이그레이션됩니다!

---

## 🔄 마이그레이션 스크립트

`migrate_to_turso.sql` 파일이 생성되었습니다.
이 파일을 Turso에 업로드하면 모든 데이터가 복사됩니다.

---

## ❓ 문제 해결

### "turso: command not found"
→ CLI 설치 필요: https://docs.turso.tech/cli/installation

### "Authentication required"
→ `turso auth login` 실행

### "Database already exists"
→ 기존 DB 삭제: `turso db destroy order-ai`

---

## 📚 참고 문서

- Turso 공식 문서: https://docs.turso.tech/
- libSQL Client: https://github.com/libsql/libsql-client-ts
- SQLite → Turso 마이그레이션: https://docs.turso.tech/tutorials/migrate-from-sqlite

---

**작성일:** 2026-01-16  
**상태:** 준비 완료
