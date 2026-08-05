# design-sync notes — Order AI

## 개요
- order_ai는 **배포 라이브러리가 아니라 Next.js 앱** → `shape: package` + **커스텀 엔트리**(`.design-sync/entry.ts`)로 synth 번들.
- 대상: `app/components/ui/` 프리미티브 6파일 / 9 export (Button·Card·PageHeader·Section·Stack·Skeleton 4종).
- 토큰 소스: `app/styles/design-system.css` (토큰 + `.btn`/`.card`/`.sk` 컴포넌트 클래스가 한 파일에 공존 → `_ds_bundle.css`로 복사되어 styles.css 클로저에 포함).
- Claude Design 프로젝트: **Order AI Design System** (`f1062a41-4329-46d3-9cea-37d5894c6e9e`).

## 반복 방지 메모
- **엔트리 수동 관리**: `app/components/ui/index.ts` 배럴은 Button·Card(default export)를 안 담아서, `.design-sync/entry.ts`에서 default→named로 재export한다. **ui에 프리미티브가 추가되면 entry.ts + componentSrcMap 둘 다 갱신**할 것.
- **PKG_DIR 해결**: order-ai는 self-install이 안 되므로 `--entry .design-sync/entry.ts`를 넘겨 PKG_DIR이 repo 루트로 잡히게 한다(안 주면 `node_modules/order-ai` 조회로 크래시).
- **폰트**: Pretendard(앱 `layout.tsx`에서 CDN 로드) + Apple SD Gothic Neo(시스템) → `runtimeFontPrefixes`로 처리(번들에 폰트 안 실림). DS 팬에선 시스템 폰트로 폴백.
- **guidelinesGlob: []** — repo `docs/*.md`는 내부 엔지니어링 문서라 디자인 가이드로 올리지 않음(비우지 않으면 ~52개 딸려옴).
- **overrides**: Skeleton 3종(List/StatStrip/Table)은 `cardMode: column`(풀폭). StatStripSkeleton은 grid overflow로 실제 flag됨.
- **렌더 검증**: playwright chromium 대신 **시스템 Chrome** 재사용 → `DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` 로 validate/capture 실행.

## Re-sync risks (다음 실행이 지켜봐야 할 것)
- `app/components/ui/`에 컴포넌트가 늘면 자동 감지 안 됨 → entry.ts·componentSrcMap 수동 추가 필요.
- `design-system.css`의 토큰/클래스 이름이 바뀌면 conventions.md의 인용이 낡을 수 있음 → 재sync 시 헤더 검증 통과 확인.
- Pretendard CDN 버전은 `app/layout.tsx`에 핀(@v1.3.9). 앱에서 바꾸면 DS 폴백 동작만 영향(번들엔 무관).
- 프리뷰(.design-sync/previews/*)는 `'order-ai'`에서 import — story-imports 정책이 번들 전역으로 매핑함(실제 order-ai 패키지 아님).
