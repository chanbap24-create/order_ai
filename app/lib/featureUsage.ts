/**
 * 계정별 기능 사용 카운터.
 *
 * - 미들웨어(Edge runtime)에서 인증 통과 직후 fire-and-forget 호출
 * - Supabase RPC `increment_feature_usage(date, manager, feature)` 로 UPSERT(+1)
 * - Edge 호환: fetch 만 사용. supabase-js 미사용.
 *
 * 추가/수정 시: classifyFeature 의 매핑 테이블에 케이스 1~2줄 추가.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** YYYY-MM-DD (KST). 자정 직전 UTC 요청도 한국 날짜로 정확히 분리. */
function todayKst(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * 경로 + method → 기능명. 추적 안 할 경로는 null.
 * 사용자 가시 액션 단위로 묶어서 잡음을 줄임 (조회/저장 분리는 일부만).
 */
export function classifyFeature(method: string, pathname: string): string | null {
  // 자기 자신 추적 호출은 제외 (무한루프 방지)
  if (pathname.startsWith('/api/admin/feature-usage')) return null;
  if (pathname.startsWith('/api/auth/')) return null;
  if (pathname === '/api/sales/clients/managers') return null;

  // ─ 세일즈 ─
  if (pathname === '/api/sales/ledger' && method === 'GET') return '매출처원장조회';
  if (pathname === '/api/sales/ledger/export') return '매출처원장내보내기';
  if (pathname === '/api/sales/item-ledger' && method === 'GET') return '품목별판매조회';
  if (pathname === '/api/sales/recommend') return 'AI추천';
  if (pathname === '/api/sales/meetings/briefing') return 'AI미팅브리핑';
  if (pathname.startsWith('/api/sales/meetings')) return method === 'GET' ? '미팅조회' : '미팅저장';
  if (pathname.startsWith('/api/sales/outstanding')) return '미수현황';
  if (pathname.startsWith('/api/sales/expense')) return '경비관리';
  if (pathname.startsWith('/api/sales/action')) return '액션';
  if (pathname.startsWith('/api/sales/alert')) return '알림';
  if (pathname.startsWith('/api/sales/analysis')) return '영업분석';
  if (pathname.startsWith('/api/sales/briefing')) return '브리핑';
  if (pathname.startsWith('/api/sales/dismissed')) return '미수해제';
  if (pathname.startsWith('/api/sales/clients/stats')) return '거래처통계';
  if (pathname.startsWith('/api/sales/clients')) return method === 'GET' ? '거래처조회' : '거래처저장';
  if (pathname.startsWith('/api/sales/recommend')) return 'AI추천';
  if (pathname.startsWith('/api/sales')) return '세일즈기타';

  // ─ 재고/검색 ─
  if (pathname.startsWith('/api/inventory/search')) return '재고검색';
  if (pathname.startsWith('/api/inventory')) return '재고조회';

  // ─ 발주/견적 ─
  if (pathname.startsWith('/api/parse-order') || pathname.startsWith('/api/parse-glass-order')) return '발주파싱';
  if (pathname.startsWith('/api/order-v2') || pathname === '/api/order' || pathname.startsWith('/api/order/')) return '발주작성';
  if (pathname.startsWith('/api/quote')) return '견적서';

  // ─ 와인 콘텐츠 ─
  if (pathname.startsWith('/api/tasting-notes')) return '테이스팅노트';
  if (pathname.startsWith('/api/wine')) return '와인조회';

  // ─ 기타 ─
  if (pathname.startsWith('/api/marketing')) return '마케팅분석';
  if (pathname.startsWith('/api/forecast')) return '수입량예측';

  return null;
}

/**
 * fire-and-forget 카운터 증가. Edge에서 await 없이 호출되어 응답 지연 없음.
 * 실패해도 무시(추적은 best-effort).
 */
export async function trackFeatureUsage(manager: string, feature: string): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY || !manager || !feature) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_feature_usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        p_date: todayKst(),
        p_manager: manager,
        p_feature: feature,
      }),
    });
  } catch {
    // 무시 — 추적 실패가 사용자 요청에 영향 주지 않음
  }
}
