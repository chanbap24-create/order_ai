# Excel → DB 동기화 가이드

## 📋 개요

order-ai.xlsx 파일의 "Client" 시트 데이터를 SQLite 데이터베이스에 동기화하는 시스템입니다.

## 🎯 해결한 문제

**문제:** "CL 샤블리 샹트 메흘르" 입고 내역이 Excel에는 있지만 검색이 안 됨
**원인:** Excel 데이터가 DB에 동기화되지 않음
**해결:** Excel → DB 자동 동기화 시스템 구축

---

## 📊 동기화 결과

### ✅ 동기화 완료 (2026-01-16)

```
- 거래처: 152개
- 품목: 834개
- Excel 파일: order-ai.xlsx
- DB 파일: data.sqlite3
```

### ✅ 확인된 데이터

**CL 샤블리 품목:**
1. CL 샤블리
2. CL 샤블리 "레 자딜레"
3. CL 샤블리 "샹트 메흘르" ✅ (품번: 3021065)

**보졸레 품목:**
- LR 보졸레 빌라쥬 프리뫼르 (품번: 2025001)

---

## 🔧 시스템 구조

### 1️⃣ **Excel 파일 구조**

**시트:** Client  
**컬럼 매핑:**
- E열 (4) → 거래처명 (client_name)
- F열 (5) → 거래처코드 (client_code)
- M열 (12) → 품목번호 (item_no)
- N열 (13) → 품목명 (item_name)
- T열 (19) → 공급가 (supply_price)

### 2️⃣ **데이터베이스 테이블**

#### `clients` 테이블
```sql
CREATE TABLE clients (
  client_code TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

#### `client_alias` 테이블
```sql
CREATE TABLE client_alias (
  client_code TEXT NOT NULL,
  alias TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  PRIMARY KEY (client_code, alias)
)
```

#### `client_item_stats` 테이블 ⭐
```sql
CREATE TABLE client_item_stats (
  client_code TEXT NOT NULL,
  item_no TEXT NOT NULL,
  item_name TEXT NOT NULL,
  supply_price REAL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_code, item_no)
)
```

---

## 🚀 동기화 방법

### 방법 1: 수동 스크립트 실행

```bash
cd /home/user/webapp
node sync_excel_to_db.js
```

**출력 예시:**
```
✅ Excel → DB 동기화 완료!
   - 거래처: 152개
   - 품목: 834개

최종 결과: {
  "synced": true,
  "clients": 152,
  "items": 834
}
```

### 방법 2: API 호출

```bash
curl https://order-ai-one.vercel.app/api/sync-daily
```

### 방법 3: 자동 동기화 (권장)

다음 API들은 **자동으로** Excel → DB 동기화를 실행합니다:
- `/api/parse-full-order`
- `/api/parse-order-v2`
- `/api/parse-glass-order`
- `/api/sync-daily`

---

## 🔍 데이터 확인 방법

### 1️⃣ SQL 쿼리

```bash
# CL 샤블리 검색
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3');
const result = db.prepare('SELECT * FROM client_item_stats WHERE item_name LIKE \"%CL%샤블리%\"').all();
console.log(result);
db.close();
"
```

### 2️⃣ 웹 UI 확인

1. https://order-ai-one.vercel.app/wine 접속
2. 검색창에 입력: `CL 샤블리 샹트 메흘르`
3. 결과 확인

---

## 📝 별칭 시스템

### 별칭 테이블

| alias | canonical | count |
|-------|-----------|-------|
| cl | 클레멍 라발리 | 23 |
| vg | 뱅상 지라르댕 | 89 |
| ro | 로버트 오틀리 | 65 |

### 검색 흐름

```
입력: "클레멍 라발리 샤블리"
  ↓ (양방향 별칭 확장)
확장: "클레멍 라발리 샤블리 cl"
  ↓ (DB 검색)
매칭: "CL 샤블리 샹트 메흘르" ✅
```

---

## 🐛 트러블슈팅

### 문제: 검색이 안 됨

**확인 사항:**
1. DB 파일이 존재하는가?
   ```bash
   ls -lh data.sqlite3
   ```

2. 테이블에 데이터가 있는가?
   ```bash
   sqlite3 data.sqlite3 "SELECT COUNT(*) FROM client_item_stats;"
   ```

3. Excel 파일이 최신인가?
   ```bash
   ls -lh order-ai.xlsx
   ```

**해결 방법:**
```bash
# 동기화 재실행
node sync_excel_to_db.js
```

### 문제: 보졸레가 나옴

**원인:** 생산자 매칭 로직
- "클레멍 라발리" → WINE_PRODUCERS에 등록됨
- 다른 품목 중 "클레멍" 또는 "라발리"가 포함된 것이 제안됨

**해결:**
- 별칭 확장으로 "cl"이 추가되면 정확히 "CL 샤블리"만 매칭됨 ✅

---

## 📂 관련 파일

### 핵심 파일
- `app/lib/syncFromXlsx.ts` - 동기화 로직
- `sync_excel_to_db.js` - 수동 실행 스크립트
- `order-ai.xlsx` - 원본 데이터
- `data.sqlite3` - SQLite DB

### API 엔드포인트
- `app/api/sync-daily/route.ts`
- `app/api/parse-full-order/route.ts`
- `app/api/parse-order-v2/route.ts`
- `app/api/parse-glass-order/route.ts`

### 관련 문서
- `BIDIRECTIONAL_ALIAS.md` - 양방향 별칭 시스템
- `LEARNED_ALIASES.md` - 학습된 별칭 504개
- `PRODUCER_UPDATE_SUMMARY.md` - 생산자 71개

---

## 🎯 다음 단계

### ✅ 완료
- [x] Excel → DB 동기화 구현
- [x] 834개 품목 적재
- [x] CL 샤블리 샹트 메흘르 검색 가능
- [x] 양방향 별칭 확장 (cl ↔ 클레멍 라발리)

### 🔜 예정
- [ ] Vercel 배포 시 자동 동기화 검증
- [ ] 실시간 검색 정확도 테스트
- [ ] 약어 정리 (중복 제거, 표준화)

---

## 📚 참고

### 커밋 히스토리
- `653d6bf` - Excel → DB 동기화 완료 (834개 품목)
- `6cede37` - 양방향 별칭 확장 시스템 추가
- `2654417` - 양방향 별칭 문서 추가

### 배포 URL
- **프로덕션:** https://order-ai-one.vercel.app
- **리포지토리:** https://github.com/chanbap24-create/order_ai

---

**업데이트:** 2026-01-16  
**담당:** GenSpark AI Assistant
