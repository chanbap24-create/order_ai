---
name: project-authz-model
description: order_ai 인증/인가 아키텍처 — 세션 HMAC, 역할 모델, middleware 게이트, IDOR 방어층(authz.ts)의 구조와 일관성 갭
metadata:
  type: project
---

order_ai의 인증/인가는 2계층 구조다.

**계층 1 — middleware.ts (인증 = 로그인 여부만):**
- 쿠키 `sales_auth`(7일) / `admin_auth`(24h)에 HMAC-SHA256 서명된 base64url 페이로드.
- 서명 키 `SECRET = AUTH_SECRET || SUPABASE_SERVICE_ROLE_KEY`. 프로덕션에서 AUTH_SECRET 미설정 시 DB 서비스롤 키가 세션 서명 키로 폴백됨(경고만).
- middleware는 "로그인됨"만 확인. 리소스별 권한은 안 봄.

**계층 2 — app/lib/authz.ts (인가 = 리소스 소유권):**
- `requireClientAccess(clientCode, type)` / `canAccessClient` / `getManagerFilter`.
- 역할: admin·executive·sales_admin = 전체 접근, 일반 user = 본인 담당 거래처만.
- CDV(와인)/DL(글라스)는 client_code 네임스페이스가 충돌하므로 clientType 명시 필수.

**핵심 갭 (Why 중요):** 계층 2는 *옵트인*이라 라우트마다 호출 여부가 제각각. `manager`를 쿼리스트링에서 직접 받아 세션과 대조 없이 쓰는 라우트가 IDOR 노출. Supabase service_role 키 사용 → RLS 우회됨 → 서버측 authz가 유일한 방어선.

**How to apply:** sales 데이터 라우트 리뷰 시, `searchParams.get('manager')`를 쓰면서 `getSession()`/`getManagerFilter()`/`requireClientAccess()`를 안 거치면 무조건 IDOR로 플래그. [[project-shipment-price-format]] 관련 미수금 데이터가 가장 민감.
