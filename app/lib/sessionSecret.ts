// 세션 쿠키 HMAC 서명 시크릿의 단일 해석 지점.
//
// 보안(H-1): AUTH_SECRET 와 DB 전권 키(SERVICE_ROLE_KEY)를 분리해야 한다.
//   동일하면 한쪽 유출 시 (1)DB 장악 + (2)세션·admin 토큰 위조가 동시에 가능.
//   → 프로덕션에 AUTH_SECRET(별도 랜덤값)을 설정하는 것이 목표.
//
// ✅ fail-closed(2026-07): 프로덕션에 AUTH_SECRET 설정 완료 → 미설정 시 SERVICE_ROLE_KEY 폴백을
//   금지하고 즉시 throw. 실수로 키가 빠져도 DB 전권 키로 세션이 서명되는 일이 다시는 없다.
//   개발/테스트(NODE_ENV≠production)는 로컬 편의를 위해 폴백 유지(경고).
//
// ⚠️ Edge Runtime(middleware) 에서도 import 되므로 process.env 외 Node API 사용 금지.
//    요청 시점에만 호출되며(모듈 top-level 아님) 프로덕션엔 AUTH_SECRET이 있으므로 throw 안 됨.
let warned = false;
export function getSessionSecret(): string {
  const explicit = process.env.AUTH_SECRET;
  if (explicit) return explicit;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY] AUTH_SECRET is required in production. '
      + 'Set a separate random value (do NOT reuse SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  if (!warned) {
    warned = true;
    console.warn('[SECURITY] AUTH_SECRET not set — dev fallback to SUPABASE_SERVICE_ROLE_KEY. Set AUTH_SECRET.');
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
