# Order AI - 와인 발주 파서

한국 와인 수입사 발주 메시지를 자동으로 파싱하고 구조화하는 Next.js 애플리케이션입니다.

## 🌐 프로젝트 URL
- **GitHub**: https://github.com/chanbap24-create/order-ai
- **데모**: https://3000-ihrunfcj6wdldlndzi6r8-d0b9e1e2.sandbox.novita.ai

## 주요 기능

- 📝 발주 메시지 자동 파싱 (거래처, 품목, 수량, 가격)
- 🔍 거래처 및 품목 자동 매칭 (푸지 매칭)
- 🤖 OpenAI GPT를 활용한 자연어 처리
- 📊 엑셀 파일 기반 데이터 동기화
- 🌐 영어 발주 메시지 자동 번역

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

## 라이선스

Private
