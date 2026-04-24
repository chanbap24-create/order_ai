/**
 * 리소스 단위 권한 검증 (Authorization).
 *
 * middleware는 "로그인 여부"만 확인하고 각 route의 리소스별 권한은 체크하지 않음.
 * → 로그인된 sales user가 다른 매니저 거래처 데이터 조회 가능 (IDOR).
 *
 * 이 모듈:
 *  - getSessionFromRequest: 쿠키에서 세션 추출 (auth.ts getSession과 동일 로직)
 *  - canAccessClient: 현재 매니저가 해당 거래처를 볼 수 있는지
 *  - requireClientAccess: API route에서 한 번에 체크 + 403 응답 생성
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession, type SalesSession } from '@/app/lib/auth';

/**
 * admin/executive 는 전체 거래처 접근 가능.
 * 일반 user 는 client_details.manager === session.manager 인 거래처만.
 */
export async function canAccessClient(
  session: SalesSession,
  clientCode: string,
): Promise<boolean> {
  if (!clientCode) return false;
  if (session.role === 'admin' || session.role === 'executive') return true;

  // sales user: client_details.manager 매칭 확인
  const { data } = await supabase
    .from('client_details')
    .select('manager')
    .eq('client_code', clientCode)
    .maybeSingle();

  if (!data) {
    // client_details 에 없는 경우: glass 거래처일 가능성
    const { data: glass } = await supabase
      .from('glass_clients')
      .select('client_code')
      .eq('client_code', clientCode)
      .maybeSingle();
    // glass_clients 는 manager 필드 없음 → 일단 허용 (필요시 강화)
    return !!glass;
  }

  return data.manager === session.manager;
}

/**
 * API route에서 호출: 세션 확인 + 거래처 접근 권한 확인.
 * 반환값이 NextResponse 면 그대로 return (401/403). null 이면 통과.
 */
export async function requireClientAccess(clientCode: string): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const allowed = await canAccessClient(session, clientCode);
  if (!allowed) {
    return NextResponse.json(
      { error: '해당 거래처에 접근할 권한이 없습니다.' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * 현재 세션의 매니저 이름 반환 (route 내부에서 filter 걸 때 사용).
 * admin/executive 는 null 반환 → filter 안 걸기.
 */
export async function getManagerFilter(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === 'admin' || session.role === 'executive') return null;
  return session.manager;
}
