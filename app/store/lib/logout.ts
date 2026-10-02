'use client';

// 매장 앱 로그아웃 — 재고 앱·소믈리에 메뉴 공용. 세션 쿠키 삭제 + 응대 중 손님·카트 비우고 로그인 화면(소믈리에)으로.
import { endGuestSession } from '@/app/lib/store/cartSession';
import { clearAuthHint } from '@/app/sales/page-auth/lib/authHint';

export async function logoutStoreApp() {
  if (!window.confirm('로그아웃할까요?\n응대 중인 손님과 정산 목록도 비워집니다.')) return;
  await fetch('/api/auth/login', { method: 'DELETE' }).catch(() => null);
  endGuestSession();
  clearAuthHint();
  window.location.href = '/sommelier';
}
