// 세션 쿠키 HMAC 서명 시크릿의 단일 해석 지점.
//
// 보안(H-1): 프로덕션에서 AUTH_SECRET 미설정 시 fail-closed(throw).
//   기존에는 SUPABASE_SERVICE_ROLE_KEY 로 묵시적 폴백했는데, 그 경우 DB 전권 키가
//   세션 서명 키와 동일해져 한쪽이 유출되면 (1)DB 장악 + (2)세션·admin 토큰 위조가
//   동시에 가능해진다. 프로덕션에서는 반드시 별도 시크릿을 강제한다.
//
// 개발/테스트: 로컬 편의를 위해 SERVICE_ROLE_KEY 폴백 허용(throw 안 함).
//
// ⚠️ Edge Runtime(middleware) 에서도 import 되므로 process.env 외 Node API 사용 금지.
export function getSessionSecret(): string {
  const explicit = process.env.AUTH_SECRET;
  if (explicit) return explicit;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY] AUTH_SECRET must be set in production. '
      + 'Refusing to fall back to SUPABASE_SERVICE_ROLE_KEY for session signing '
      + '(DB key and session key must be decoupled).',
    );
  }

  // 개발/테스트 폴백
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
