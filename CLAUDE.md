# Order AI — Claude 작업 지침

## 프로젝트 개요

- **스택**: Next.js 16 (App Router) + React 19 + TypeScript + Supabase(Postgres) + SQLite(로컬) + OpenAI/Anthropic
- **도메인**: 와인/잔 유통 발주·출고·재고·영업 관리. 엑셀 동기화, GPT 기반 발주 파싱, 거래처/품목 매칭
- **주요 경로**
  - `app/` — App Router 페이지 (admin, glass, inventory, order, order-v2, sales, wine 등)
  - `app/api/` — API 라우트 (parse-order*, sync-*, learn-*, tasting-notes 등)
  - `app/lib/` — 도메인 로직·매처·DB·파서 (서버 모듈)
  - `app/components/` — 공용 UI 컴포넌트
  - `migrations/` — SQL 마이그레이션
  - `scripts/` — 운영/동기화 스크립트
  - `supabase/` — Supabase 설정

## 법인 분리 (중요)

까브드뱅(**CDV**)과 대유라이프(**DL**)는 **항상 분리**해서 개발·데이터 관리. 공용 로직이어도 스키마/엔티티/쿼리는 법인 단위로 구분할 것.

## 핵심 코딩 규칙

### 1. 모듈화 필수

모든 기능은 **단일 책임 모듈**로 분리한다.

- **페이지 파일(`page.tsx`)에 비즈니스 로직을 넣지 않는다.** UI 구성과 이벤트 위임만 담당.
- **로직은 `app/lib/`**, **UI 파편은 `app/components/`** 또는 `app/<route>/components/`로 분리.
- **API 라우트(`route.ts`)는 얇게 유지**한다. 핸들러는 요청 파싱 → 도메인 함수 호출 → 응답만. 실제 로직은 `app/lib/`의 함수로.
- **훅/상태/데이터 페칭**은 `useXxx` 훅으로 추출 (`app/<route>/hooks/` 또는 `app/hooks/`).
- **상수·타입**은 별도 파일(`constants.ts`, `types.ts`)로.

### 2. 300줄 상한

**한 파일은 300줄을 넘기지 않는다.**

- 신규 작성 또는 파일을 수정할 때 300줄을 초과하면 **반드시 분리**한다.
- 기존 300줄 초과 파일(`app/inventory/page.tsx`, `app/glass/page.tsx`, `app/wine/page.tsx`, `app/sales/components/ActionTab.tsx` 등)을 수정할 때는, 해당 수정 범위라도 분리 가능하면 모듈로 빼낸다. 전면 리팩터링은 사용자 승인 후 수행.
- 공백/주석만으로 줄이는 꼼수 금지. **의미 단위 분리**로 해결.

### 3. 분리 기준 예시

- **페이지가 비대할 때**: 탭/섹션별 컴포넌트, 데이터 로딩 훅, 핸들러 모음으로 분리
- **파서/매처가 비대할 때**: 전처리 · 핵심 알고리즘 · 후처리 · 스코어링으로 분리
- **API 라우트가 비대할 때**: validation, service, repository 계층으로 분리

## 기타 컨벤션

- **경로 별칭**: tsconfig에 따라 상대경로 또는 별칭 사용. 새 별칭은 도입 전 사용자에게 확인.
- **DB 접근**: Supabase 클라이언트는 `app/lib/db.ts` 등 기존 모듈을 통해서만 사용. 라우트에서 직접 커넥션 생성 금지.
- **환경 변수**: `app/lib/env.ts`에서 중앙 관리. `process.env.XXX`를 라우트/컴포넌트에서 직접 읽지 말 것.
- **에러 처리**: `app/lib/errors.ts`, `app/lib/api-response.ts`의 기존 유틸 사용.
- **로깅**: `app/lib/logger.ts` 사용.
- **가격 포맷 주의**: `shipments` 가격 컬럼은 2025-08 전후 포맷이 다름. **Q열=판매단가**가 핵심.
- **수량 파싱 주의**: 2자리 빈티지(예: `22`)를 수량으로 오인하지 않도록 파서 규칙 확인 (최근 커밋 `99246ae7`).

## 작업 플로우

- 구현 전: 수정 대상 파일의 라인 수를 확인하고, 300줄 초과가 예상되면 **분리 계획을 먼저 제안**.
- 구현 후: `npm run lint`로 기본 검증. 빌드 확인이 필요하면 `npm run build`.
- 커밋은 사용자가 명시적으로 요청할 때만 생성.

## 금지 사항

- 페이지 파일에 대규모 `useState`/`useEffect`/핸들러 직접 작성 → 훅으로 추출
- API 라우트에 DB 쿼리·비즈니스 로직 인라인 작성
- 300줄 초과 파일을 그대로 두고 추가 코드 append
- 법인 구분 없이 CDV·DL을 같은 테이블·쿼리로 섞기
- `process.env` 직접 참조 (env.ts 경유)
