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

## 디자인 시스템 (KREAM 스타일 — 2026-07 확정)

순백·쿨블랙·중립 헤어라인. **색은 하드코딩 금지 — `app/styles/design-system.css` 토큰만** (`--action`(블랙 CTA)·`--border-*`·`--surface-*`·`--text-*`·`--status-*`·`--promo`·`--meeting-*`·`--importance-*`·`--neutral-*` 램프). hex에 알파를 붙이지 말고 `color-mix(in srgb, var(--x) 10%, transparent)` 사용.

새 화면/컴포넌트는 확립된 문법을 따를 것:
- **스탯 요약** = 스트립: 박스 없이 상하 헤어라인 + 세로 구분(borderLeft), 라벨 11px tertiary / 값 18~20px 700 `tabular-nums` `nowrap`, 상태는 숫자 색으로만 (예: `TodayStrip`, `AgingSummary`)
- **목록** = 헤어라인 연속 행(박스 카드 금지): `borderBottom: 1px solid var(--border-subtle)`, 섹션헤더는 볼드 텍스트+헤어라인 (예: `WeekList`, `AlertCard`)
- **칩 다운그레이드**: 채운 색 배경 칩 금지 → 색 텍스트 또는 도트(5~7px)+텍스트. 기본값 상태('일반' 등)는 표기 생략. 원색 풀폭 밴드 금지
- **테이블**: 숫자 우측정렬 tabular, 합계행은 원색 배경 대신 `surface-muted`+굵은 상단 헤어라인
- **컨트롤**: 필터/토글은 박스(Section) 없이 플랫, 서브탭은 필터카드 안에 세로 구분선으로
- **로딩** = 스켈레톤(`app/components/ui/Skeleton.tsx`: List/StatStrip/Table), "로딩 중..." 텍스트 금지
- **모바일**: 팝오버/드롭다운은 768px 이하 바텀시트로, 입력 16px(iOS 줌 방지), 한국어 `keep-all` 전역 적용됨
- **사용자 취향**: 굵은 강조(800) 금지(타이틀 1.5rem/500, 탭 활성 700), sticky 탭바 금지, radius 카드 12 상한
- **파일 전송**: 모바일 다운로드는 `shareOrDownloadFile`(app/lib/shareFile.ts) — 파일만 공유(URL 미포함)

## 핵심 코딩 규칙

### 1. 모듈화 필수

모든 기능은 **단일 책임 모듈**로 분리한다. **핵심은 줄 수가 아니라 "페이지/라우트에 로직 금지"다.**

- **페이지 파일(`page.tsx`)에 비즈니스 로직을 넣지 않는다.** UI 구성과 이벤트 위임만 담당.
- **로직은 `app/lib/`**, **UI 파편은 `app/components/`** 또는 `app/<route>/components/`로 분리.
- **API 라우트(`route.ts`)는 얇게 유지**한다. 핸들러는 요청 파싱 → 도메인 함수 호출 → 응답만. 실제 로직은 `app/lib/`의 함수로.
- **훅/상태/데이터 페칭**은 `useXxx` 훅으로 추출 (`app/<route>/hooks/` 또는 `app/hooks/`).
- **상수·타입**은 별도 파일(`constants.ts`, `types.ts`)로.

### 2. 분리 시 복제 금지 (모듈화의 최대 함정)

**분리하면서 비슷한 코드를 복사해 두 벌 만들지 않는다.** 이 코드베이스의 실버그 대부분이 "쪼개면서 복제한" 유틸들의 드리프트에서 나왔다 (fetchAll 13벌 → 한쪽만 보세 필터 누락, quickRanges 2벌 → KST/로컬타임 불일치, deliveryDate 3벌).

- 새 모듈을 만들기 전에 **같은 역할의 유틸이 이미 있는지 먼저 확인**하고, 있으면 재사용·공용화한다.
- 확립된 공용 유틸: `app/lib/fetchAll.ts`(1000행 캡 페이지네이션 — 테이블·RPC 공용), `app/lib/dateKst.ts`(KST 날짜), `app/lib/sessionCache.ts`(클라이언트 TTL 캐시).
- 두 곳에서 같은 로직이 필요해지는 순간이 공용 모듈로 승격할 타이밍이다 (예: 수금 브리핑 `app/lib/collection-alerts.ts` — 화면 API와 텔레그램 발송이 공유).

### 3. 300줄 — 경보이지 법이 아니다

**300줄은 책임 혼합을 감지하는 경보(tripwire)로 쓴다.** 파일 종류에 따라 엄격도가 다르다.

- **페이지·라우트·컴포넌트: 엄격 적용.** 여기서 300줄 초과는 거의 항상 책임 혼합의 신호 → 반드시 분리한다. (예: 원장 라우트 287→53줄 lib 분리, inventory/page.tsx 훅 추출)
- **응집력 있는 알고리즘 lib(매처·파서·스코어러)는 예외 허용.** 하나의 알고리즘이 원래 400줄이면 억지로 찢는 게 오히려 가독성을 해친다. 신규 수정 시 의미 단위(전처리·핵심·후처리·스코어링) 분리를 **검토**하되, 전면 리팩터링은 사용자 승인 후 수행. (현존 예: `resolveItemsWeighted.ts`, `order-v2/parse/route.ts` — 후자는 발주 핵심 경로라 특히 신중)
- 공백/주석만으로 줄이는 꼼수 금지. **의미 단위 분리**로 해결.

### 4. 분리 기준 예시

- **페이지가 비대할 때**: 탭/섹션별 컴포넌트, 데이터 로딩 훅, 핸들러 모음으로 분리
- **파서/매처가 비대할 때**: 전처리 · 핵심 알고리즘 · 후처리 · 스코어링으로 분리
- **API 라우트가 비대할 때**: validation, service, repository 계층으로 분리

## 기타 컨벤션

- **경로 별칭**: tsconfig에 따라 상대경로 또는 별칭 사용. 새 별칭은 도입 전 사용자에게 확인.
- **DB 접근**: Supabase 클라이언트는 `app/lib/db.ts` 등 기존 모듈을 통해서만 사용. 라우트에서 직접 커넥션 생성 금지.
- **⚠️ Supabase 1000행 캡 (반복 발생 함정)**: PostgREST는 `select`·`rpc`(SETOF) 결과를 **기본 1000행에서 잘라낸다**. 1000건을 넘길 수 있는 조회(담당자 거래처, 전체 거래처/품목/출고, tasting_notes 등)는 **반드시 페이지네이션**(`.range(from, to)` 반복)하거나 배치 조회할 것. 단발 호출은 조용히 일부만 반환돼 "일부 데이터 누락"으로 나타난다(예: `manager_clients` RPC가 1000곳에서 잘려 담당 거래처 일부가 검색/발주 후보에서 누락된 버그, 커밋 `e25fd3e3`). **정확히 1000·정확히 999건이 반환되면 캡을 의심**하라. `.limit(N>1000)`도 캡을 못 넘는다. **공용 유틸 `app/lib/fetchAll.ts`의 `fetchAllRows`를 사용할 것** (테이블·SETOF RPC 공용, 2026-08 감사에서 12개 지점 일괄 교체). 새 페이지네이션 루프를 인라인으로 또 만들지 말 것.
- **⚠️ 담당자 스코프 = 현재 담당 기준 (반복 함정)**: 거래처의 **현재 담당은 `client_details.manager`**(와인, 거래처정보 업로드·출고 sync로 최신 유지)다. **`shipments.manager`는 출고 시점의 옛 담당**이라 재배정돼도 안 바뀐다. 거래처 목록·매출·분석·등급 등에서 담당별로 거래처를 스코프하거나 매출을 귀속할 때 `shipments.manager`로 필터하면 **재배정된 거래처가 옛 담당에 잔존/매출 오귀속**된다 → **와인은 `client_details.manager`(client_type='wine') 기준**으로 스코프하고, 매출은 client_code별로 집계(담당 무관 총합)할 것. 글라스는 `client_details`에 담당 컬럼이 없어 `glass_shipments.manager` 유지. 관련 수정 커밋: `ab20c8e5`(거래처목록)·`941dcb39`(분석)·`85ea1ff5`(통계/등급) + 매출분석 RPC(fn_client_analysis/fn_manager_brands/fn_shipment_filters).
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
