// 세션 쿠키 HMAC 서명 시크릿의 단일 해석 지점.
//
// 보안(H-1): AUTH_SECRET 와 DB 전권 키(SERVICE_ROLE_KEY)를 분리해야 한다.
//   동일하면 한쪽 유출 시 (1)DB 장악 + (2)세션·admin 토큰 위조가 동시에 가능.
//   → 프로덕션에 AUTH_SECRET(별도 랜덤값)을 설정하는 것이 목표.
//
// ⚠️ 현재는 미설정 시 SERVICE_ROLE_KEY 폴백 + 경고(throw 아님).
//   throw 로 강제하면 AUTH_SECRET 미설정 환경에서 빌드/부팅이 막혀 서비스가
//   중단되므로, 환경변수 설정이 확인되기 전까지는 경고로만 둔다.
//   AUTH_SECRET 설정 완료 후 fail-closed(throw)로 다시 강화할 것.
//
// ⚠️ Edge Runtime(middleware) 에서도 import 되므로 process.env 외 Node API 사용 금지.
let warned = false;
export function getSessionSecret(): string {
  const explicit = process.env.AUTH_SECRET;
  if (explicit) return explicit;

  if (process.env.NODE_ENV === 'production' && !warned) {
    warned = true;
    console.warn(
      '[SECURITY] AUTH_SECRET not set in production — falling back to SUPABASE_SERVICE_ROLE_KEY '
      + 'for session signing. Set AUTH_SECRET (separate random value) to decouple DB key from '
      + 'session signing, then re-enable the hard guard.',
    );
  }

  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
