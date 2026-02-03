# Order AI - 와인 발주 파서

한국 와인 수입사 발주 메시지를 자동으로 파싱하고 구조화하는 Next.js 애플리케이션입니다.

## 🌐 프로젝트 URL
- **GitHub**: https://github.com/chanbap24-create/order-ai
- **Vercel 배포**: (아래 배포 가이드 참조)
- **데모**: https://3000-ihrunfcj6wdldlndzi6r8-d0b9e1e2.sandbox.novita.ai

## 주요 기능

- 📝 발주 메시지 자동 파싱 (거래처, 품목, 수량, 가격)
- 🔍 거래처 및 품목 자동 매칭 (퍼지 매칭)
- 🤖 OpenAI GPT를 활용한 자연어 처리
- 📊 엑셀 파일 기반 데이터 동기화
- 🌐 영어 발주 메시지 자동 번역
- 🆕 **신규 품목 자동 검색** (order-ai.xlsx English 시트 활용)
  - 입고 이력 없는 품목 → English 시트에서 자동 검색
  - 상위 3개 후보 표시 → 사용자 선택 → 거래처 입고 이력에 자동 저장
  - 다음 검색부터 자동 매칭 ✅
- 🎯 **조합 가중치 시스템** (학습, 구매 패턴, 빈티지 등 종합 분석)
- 📚 **품목 학습 기능** (선택한 품목 자동 저장, 다음 검색 시 가산점)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# 필수
OPENAI_API_KEY=your_openai_api_key_here

# ✅ 속도 개선 옵션
ENABLE_TRANSLATION=false  # 번역 비활성화 (한국어만 사용 시 권장, 2~5초 단축)

# 선택적
# DB_PATH=data.sqlite3
# ORDER_AI_XLSX_PATH=order-ai.xlsx
# OPENAI_MODEL=gpt-4o-mini
# MAX_ITEMS=20
```

자세한 환경 변수 목록은 `env.example` 파일을 참고하세요.

### 3. 데이터베이스 초기화

엑셀 파일에서 데이터를 가져와 데이터베이스를 초기화합니다:

```bash
python scripts/import_client_excel.py
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 프로젝트 구조

```
order-ai/
├── app/
│   ├── api/              # API 라우트
│   ├── components/       # React 컴포넌트
│   ├── lib/              # 유틸리티 함수
│   │   ├── db.ts         # 데이터베이스 연결
│   │   ├── errors.ts     # 에러 처리
│   │   ├── validation.ts # 입력 검증
│   │   ├── logger.ts     # 로깅
│   │   └── config.ts     # 설정 관리
│   └── types/            # TypeScript 타입 정의
├── scripts/              # 유틸리티 스크립트
└── data.sqlite3          # SQLite 데이터베이스
```

## API 엔드포인트

- `POST /api/parse-full-order` - 전체 주문 파싱 (거래처 + 품목)
- `POST /api/resolve-client` - 거래처 매칭
- `POST /api/parse-order` - 품목 파싱
- `POST /api/parse` - 기본 파싱
- `POST /api/learn-item-alias` - 품목 별칭 학습
- `POST /api/confirm-item-alias` - 품목 별칭 확인

## 기술 스택

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **AI**: OpenAI API
- **Validation**: Zod

## 🚀 Vercel 배포 가이드

### 방법 1: Vercel 웹사이트에서 배포 (권장)

1. **Vercel 계정 생성/로그인**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인

2. **프로젝트 Import**
   - "Add New..." → "Project" 클릭
   - GitHub에서 `order-ai` 저장소 선택
   - "Import" 클릭

3. **환경 변수 설정**
   - "Environment Variables" 섹션에서 다음 추가:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ENABLE_TRANSLATION=true
   ORDER_AI_XLSX_PATH=./order-ai.xlsx
   DB_PATH=./data.sqlite3
   ```

4. **배포 시작**
   - "Deploy" 클릭
   - 몇 분 후 배포 완료되면 URL 확인

### 방법 2: Vercel CLI 사용

```bash
# Vercel CLI 설치
npm install -g vercel

# 배포 실행
vercel

# 프로덕션 배포
vercel --prod
```

### 주의사항

- ⚠️ SQLite 데이터베이스는 Vercel의 Serverless Functions에서 읽기 전용입니다
- ⚠️ 데이터 쓰기가 필요한 경우 Vercel Postgres 또는 외부 DB 사용 권장
- ✅ 현재 구조는 읽기 작업 위주이므로 정상 작동합니다

## 라이선스

Private
# Last updated: Tue Jan  6 23:52:31 UTC 2026


<!-- redeploy test 105-->


<!-- force deploy 2026-01-12T10:59:40Z -->

---

## 🚀 최신 배포 정보

**Version:** 2.0.0  
**Last Deploy:** 2026-02-02 04:50 UTC  
**Commit:** 12d19d2

### ✨ Version 2.0.0 주요 변경사항

#### 후보 품목 표시 개선
- **총 후보 개수**: 4개 → **8개**로 확장
- **정렬 방식**: 기존 입고품목 우선 정렬
  - 1순위: 기존 품목 (is_new_item=false)
  - 2순위: 같은 그룹 내에서 점수 내림차순

#### 검색 로직 개선
- 거래처 이력 우선 검색 (한글 품목명 우선)
- 빈티지 중복 제거 시 기존 품목 우선
- item_no 기준 중복 제거

#### 예시 결과
**검색:** "클레멍 라발레 샤블리 2병"

```
✅ 기존 품목
1. 3021065 - CL 샤블리 "샹트 메흘르" (0.652)
2. 3021049 - 클레멍 라발리, 샤블리 (0.535)

🆕 신규 품목
3. 3022049 - CL 샤블리 (0.652)
4. 3020701 - CL 샤블리 "레 자딜레" (0.652)
5. 3021705 - CL 샤블리 1er Cru "코트 드 주앙" (0.652)
6. 3022704 - 클레멍 라발리, 샤블리 "레 자딜레" (0.475)
7. 3020050 - 클레멍 라발리, 샤블리 45도 (0.470)
```

### 📊 배포 확인

API 버전 확인:
```bash
curl https://your-domain/api/parse-full-order
```

예상 응답:
```json
{
  "version": "2.0.0",
  "features": {
    "suggestions": 8,
    "sorting": "existing_items_first"
  }
}
```

---

**Build Status**: [![Deploy](https://img.shields.io/badge/deploy-production-green)](https://github.com/chanbap24-create/order_ai)

