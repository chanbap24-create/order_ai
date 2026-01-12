# Riedel 데이터 추가 완료

## 📅 작업 일시
2026-01-12

## ✅ 완료 작업

### 1. **Excel 데이터 구조**

**파일:** `order-ai.xlsx` → `riedel` 시트

**컬럼 매핑:**
- **B열 (Code)**: 품목 코드 (예: 4100/00R, 4100/16R)
- **C열 (Item KR)**: 한글 품목명 (예: 레드타이 보르도 그랑크뤼)
- **D열 (Item EN)**: 영문 품목명 (예: RED TIE BORDEAUX GRAND CRU)
- **F열 (공급가)**: 공급가격 (예: 160,000원)

---

### 2. **데이터베이스 업데이트**

**테이블:** `glass_items`

**추가된 컬럼:**
- `english_name TEXT` (신규 추가)

**데이터 통계:**
- **추가된 Riedel 품목**: 377개
- **기존 Glass 품목**: 241개
- **전체 Glass 품목**: 618개

---

## 📊 데이터 샘플

### 추가된 Riedel 데이터

```
[4100/00R] 레드타이 보르도 그랑크뤼
  영문: RED TIE BORDEAUX GRAND CRU
  가격: 160,000원

[4100/16R] 레드타이 버건디 그랑크뤼
  영문: RED TIE BURGUNDY GRAND CRU
  가격: 160,000원

[4100/07R] 레드타이 오크드 샤르도네
  영문: RED TIE OAKED CHARDONNAY
  가격: 160,000원

[4100/08R] 레드타이 샴페인
  영문: RED TIE CHAMPAGNE
  가격: 160,000원

[4100/15R] 레드타이 리슬링 그랑크뤼
  영문: RED TIE RIESLING GRAND CRU
  가격: 160,000원
```

---

## 🔍 검색 테스트

### 1. **코드로 검색**
```
입력: 4100/00R
결과: ✅ [4100/00R] 레드타이 보르도 그랑크뤼
```

### 2. **한글명으로 검색**
```
입력: 레드타이
결과:
  1. [4100/00R] 레드타이 보르도 그랑크뤼
  2. [4100/16R] 레드타이 버건디 그랑크뤼
  3. [4100/07R] 레드타이 오크드 샤르도네
  ... (총 5개)
```

### 3. **영문명으로 검색**
```
입력: BLACK TIE
결과:
  1. [4100/00-1BB] 블랙타이 올블랙 보르도 그랑크뤼
     영문: BLACK TIE ALL BLACK BORDEAUX GRAND CRU
  2. [4100/16-1BB] 블랙타이 올블랙 버건디 그랑크뤼
     영문: BLACK TIE ALL BLACK BURGUNDY GRAND CRU
  ... (총 5개)
```

---

## 🎯 사용 방법

### Glass 페이지에서 검색

**URL:** https://3000-ihrunfcj6wdldlndzi6r8-d0b9e1e2.sandbox.novita.ai/glass

**입력 예시:**
```
레드타이 보르도 12개
블랙타이 샴페인 24개
4100/00R 6개
```

**검색 기능:**
- ✅ 코드로 검색 (4100/00R)
- ✅ 한글명으로 검색 (레드타이)
- ✅ 영문명으로 검색 (BLACK TIE)
- ✅ 멀티 토큰 검색 (레드타이 보르도)
- ✅ 약어 학습 (학습 탭에서 설정)

---

## 📈 통계

| 항목 | 개수 |
|------|------|
| **전체 Glass 품목** | 618개 |
| **Riedel 품목** | 377개 (61%) |
| **기타 Glass 품목** | 241개 (39%) |

---

## 🔧 기술 상세

### 데이터 처리 과정

1. **Excel 로드**
   - Python openpyxl 사용
   - `order-ai.xlsx` → `riedel` 시트 읽기
   - Row 6부터 데이터 시작 (Row 5는 헤더)

2. **데이터 변환**
   - B열 → `item_no` (코드)
   - C열 → `item_name` (한글명)
   - D열 → `english_name` (영문명)
   - F열 → `supply_price` (공급가)

3. **데이터베이스 업데이트**
   - `english_name` 컬럼 추가
   - 기존 Riedel 데이터 삭제 (코드 형식: `%/%`)
   - 377개 새 데이터 삽입
   - 타임스탬프 자동 생성

### 스키마

```sql
CREATE TABLE glass_items (
    item_no TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    english_name TEXT,
    supply_price REAL,
    created_at DATETIME,
    updated_at DATETIME
);
```

---

## ✅ 완료 상태

- ✅ Excel 데이터 로드 (377개)
- ✅ `english_name` 컬럼 추가
- ✅ 데이터베이스 업데이트
- ✅ 검색 테스트 완료
- ✅ 서버 재시작
- ✅ Git 커밋 완료

---

## 🚀 다음 단계

1. **실제 테스트**
   - Glass 페이지에서 Riedel 품목 검색
   - 코드/한글명/영문명 검색 테스트
   - 자동 완성 및 정확도 확인

2. **약어 학습**
   - 자주 사용하는 Riedel 약어 등록
   - 예: `rd` → `리델`, `rt` → `레드타이`

3. **GitHub Push**
   - 변경사항을 GitHub에 Push
   - Vercel 자동 배포

---

**Riedel 데이터 377개가 성공적으로 추가되었습니다!** 🎉

이제 Glass 페이지에서 Riedel 제품을 코드, 한글명, 영문명으로 검색할 수 있습니다.
