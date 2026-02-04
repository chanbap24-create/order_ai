# Order AI

AI-powered order processing system for wine and glass items.

## Latest Updates (2026-02-04)

- ✅ **NEW:** Order Interpreter Engine with GPT-based parsing
- ✅ **FIXED:** OpenAI API authentication issue (sk-proj- keys)
- ✅ **CRITICAL FIX:** Corrected client history priority logic - existing items now appear first
- ✅ **CRITICAL FIX:** Normalize accents (é→e) and quotes ("" → "")
- ✅ **CRITICAL FIX:** Added supply_price to items table schema
- ✅ Fixed vintage grouping: normalize item names (remove prefixes AR, VG, etc.)
- ✅ Show both existing and new vintage items
- ✅ Resolved items show only 2 suggestions by default

## Features

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
- 🚀 **GPT 기반 파서 (NEW!)** 
  - 전체 품목 리스트와 거래처 입고 이력 기반 AI 매칭
  - 오타/새로운 표현 자동 대응
  - High/Medium/Low confidence 레벨로 매칭 품질 구분
  - 복잡한 규칙 없이 자연어 이해

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

**중요:** 공급가 데이터 초기화 (신규 설치 또는 업데이트 후 필수):

```bash
npm run init-supply-price
```

이 명령은 다음을 수행합니다:
- `items` 테이블에 `supply_price` 컬럼 추가
- `order-ai.xlsx`의 English 시트 L열에서 공급가 데이터 로드
- 약 313개 품목의 공급가 자동 업데이트

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

### 기본 파싱 API
- `POST /api/parse-full-order` - 전체 주문 파싱 (거래처 + 품목)
- `POST /api/parse-glass-order` - Glass 주문 파싱
- `POST /api/parse-order` - 품목 파싱
- `POST /api/resolve-client` - 거래처 매칭

### 🆕 GPT 기반 파싱 API
- `POST /api/parse-order-gpt` - **GPT 기반 발주 파싱** (추천)
  - 전체 품목 리스트 + 거래처 입고 이력 제공
  - AI가 자동으로 품목 매칭 및 confidence 평가
  - 기존 시스템과 통합되어 최적의 결과 제공
- `POST /api/interpret-order` - **Order Interpreter Engine (NEW)**
  - 2단계 필터링으로 최적화된 GPT 호출
  - 자동 확정 기능 (auto_confirm)
  - Confidence 점수 기반 매칭

### 학습 API
- `POST /api/learn-item-alias` - 품목 별칭 학습
- `POST /api/confirm-item-alias` - 품목 별칭 확인
- `POST /api/learn-client` - 거래처 학습
- `POST /api/learn-new-item` - 신규 품목 학습

## 기술 스택

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **AI**: OpenAI API (GPT-4o-mini)
- **Validation**: Zod

Last updated: 2026-02-04

-TEST12

## 🚀 Latest Deployment

**Last Updated**: 2026-02-04
**Version**: v1.2.0
**Commit**: 9f4aa97 - Supply price filter
**Features**:
- ✅ Supply price display for all items
- ✅ Filter out items without supply_price
- ✅ English sheet integration
- ✅ Improved matching accuracy

**Deployment Status**: 
- GitHub: ✅ Up to date
- Vercel: Check https://vercel.com/dashboard

---
