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

export type ClientType = 'wine' | 'glass';

/**
 * admin/executive 는 전체 거래처 접근 가능.
 * 일반 user 는 본인이 담당한 거래처만.
 *
 * 와인(까브드뱅)과 글라스(대유라이프)는 client_code 네임스페이스가 다르며 충돌이 존재한다
 * (예: 30784 = 와인 코스트코 / 글라스 온6.5). 따라서 호출 측이 clientType 을 명시해야
 * 올바른 테이블에서 매니저를 검증할 수 있다.
 *
 *  - wine  : client_details (client_type='wine') 의 manager 매칭
 *  - glass : glass_shipments 의 최신 manager 매칭 (glass_clients 에는 manager 컬럼 없음)
 *  - 미지정: 과거 동작 호환을 위해 client_details → glass_clients 순으로 확인
 */
export async function canAccessClient(
  session: SalesSession,
  clientCode: string,
  clientType?: ClientType,
): Promise<boolean> {
  if (!clientCode) return false;
  // admin/executive 는 모든 거래처, sales_admin 은 사무업무 처리용으로 영업 전체 거래처 접근.
  if (session.role === 'admin' || session.role === 'executive' || session.role === 'sales_admin') return true;

  if (clientType === 'glass') {
    // 글라스: 가장 최근 출고의 매니저로 본인 담당 여부 확인
    const { data: ship } = await supabase
      .from('glass_shipments')
      .select('manager')
      .eq('client_code', clientCode)
      .not('manager', 'is', null)
      .order('ship_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ship?.manager) return ship.manager === session.manager;

    // 출고 이력이 없는 글라스 거래처(신규 등록 직후 등): 거래명세표가 아직 업로드
    // 되지 않은 상태이므로 글라스 전용 마스터의 담당자를 fallback 으로 사용.
    //  glass_client_carryover.manager — 이월 미수금 업로드 시 함께 들어가는 매니저
    //
    // ⚠️ client_details 는 와인(CDV) 코드 공간을 쓰는 테이블이라 fallback 으로 쓰면 안 됨.
    // 까브드뱅·대유라이프는 거래처 코드 체계가 독립이라(같은 코드가 다른 회사) 글라스 권한
    // 판정에 client_details 를 끌어오면 엉뚱한 법인 담당자로 통과/차단되는 코드 충돌이 발생.
    const { data: carry } = await supabase
      .from('glass_client_carryover')
      .select('manager')
      .eq('client_code', clientCode)
      .not('manager', 'is', null)
      .maybeSingle();
    if (carry?.manager) return carry.manager === session.manager;

    // 어느 소스에도 담당자 정보가 없는 신규 거래처: default-deny.
    return false;
  }

  if (clientType === 'wine') {
    const { data } = await supabase
      .from('client_details')
      .select('manager')
      .eq('client_code', clientCode)
      .eq('client_type', 'wine')
      .maybeSingle();
    return !!data && data.manager === session.manager;
  }

  // type 미지정(과거 호환): wine 우선 → 없으면 glass
  const { data } = await supabase
    .from('client_details')
    .select('manager, client_type')
    .eq('client_code', clientCode)
    .maybeSingle();

  if (!data) {
    const { data: glass } = await supabase
      .from('glass_clients')
      .select('client_code')
      .eq('client_code', clientCode)
      .maybeSingle();
    return !!glass;
  }

  return data.manager === session.manager;
}

/**
 * API route에서 호출: 세션 확인 + 거래처 접근 권한 확인.
 * 반환값이 NextResponse 면 그대로 return (401/403). null 이면 통과.
 */
export async function requireClientAccess(
  clientCode: string,
  clientType?: ClientType,
): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const allowed = await canAccessClient(session, clientCode, clientType);
  if (!allowed) {
    return NextResponse.json(
      { error: '해당 거래처에 접근할 권한이 없습니다.' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * 전 매니저 데이터 열람 가능 여부.
 * UI의 computeIsAdmin(app/sales/page-auth/hooks/useSalesAuth.ts)과 반드시 동일 기준 유지 —
 * 마케팅부는 role='user'지만 UI에서 매니저 전환을 제공하므로 서버도 허용해야 기능이 깨지지 않는다.
 */
export function canViewAllManagers(session: SalesSession): boolean {
  return session.role === 'admin' || session.role === 'executive' || session.role === 'sales_admin'
    || session.department === '마케팅부';
}

/**
 * 매니저 스코프 강제 (IDOR 방지). API route 진입부에서 호출.
 *  - 미로그인: 401 응답 반환
 *  - 전체 열람 권한: 요청된 manager 그대로 (빈 값 = 필터 없음/라우트 정책에 위임)
 *  - 일반 user: 요청값과 무관하게 본인 manager 로 강제
 */
export async function resolveManagerScope(requested: string | null | undefined): Promise<
  | { ok: true; session: SalesSession; viewAll: boolean; manager: string }
  | { ok: false; res: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, res: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  }
  const viewAll = canViewAllManagers(session);
  return { ok: true, session, viewAll, manager: viewAll ? (requested || '') : session.manager };
}

/**
 * 현재 세션의 매니저 이름 반환 (route 내부에서 filter 걸 때 사용).
 * admin/executive/sales_admin 는 null 반환 → filter 안 걸기 (모든 매니저 데이터 조회).
 */
export async function getManagerFilter(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === 'admin' || session.role === 'executive' || session.role === 'sales_admin') return null;
  return session.manager;
}
