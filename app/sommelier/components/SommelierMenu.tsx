'use client';

// 소믈리에 화면 공용 앱 메뉴(⋮⋮⋮) — 인트로·손님 정보·취향 문답·추천 결과 헤더 오른쪽.
// 고르면 재고 앱의 해당 목록으로(선택 매장 그대로 넘김). 입고 알림 점(빨강=입고, 초록=대기).
import { useState } from 'react';
import { AppsMenu, AppsMenuButton, MenuIcons, type AppsMenuItem } from '@/app/store/components/AppsMenu';
import { useRestockAlerts } from '@/app/store/hooks/useRestockAlerts';
import { logoutStoreApp } from '@/app/store/lib/logout';
import { PasswordSheet } from '@/app/store/components/PasswordSheet';

export function SommelierMenu() {
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const restock = useRestockAlerts(true);
  const goStore = (to?: 'mine' | 'incoming' | 'alerts') => {
    window.location.href = to ? `/store?open=${to}` : '/store';
  };
  const items: AppsMenuItem[] = [
    { key: 'search', label: '재고 검색', icon: MenuIcons.search, onClick: () => goStore() },
    { key: 'mine', label: '매장 재고', icon: MenuIcons.stock, onClick: () => goStore('mine') },
    { key: 'incoming', label: '입고 예정', icon: MenuIcons.incoming, onClick: () => goStore('incoming') },
    {
      key: 'alerts', label: '입고 알림', icon: MenuIcons.alerts, dot: restock.tileDot, onClick: () => goStore('alerts'),
      sub: restock.arrived.length ? `입고 ${restock.arrived.length}건` : restock.waiting.length ? `대기 ${restock.waiting.length}건` : undefined,
    },
    { key: 'guests', label: '고객', sub: '단골 카드', icon: MenuIcons.guests, onClick: () => { window.location.href = '/store/customers'; } },
    { key: 'admin', label: '관리자', icon: MenuIcons.store, onClick: () => { window.location.href = '/sommelier/admin'; } },
    { key: 'password', label: '비밀번호 변경', icon: MenuIcons.password, onClick: () => setPwOpen(true) },
    { key: 'logout', label: '로그아웃', icon: MenuIcons.logout, onClick: () => void logoutStoreApp() },
  ];
  return (
    // 헤더 높이를 늘리지 않게 버튼 여백 상쇄
    <span style={{ position: 'relative', display: 'inline-flex', margin: '-10px -8px -10px 0' }}>
      <AppsMenuButton open={open} onToggle={() => setOpen((v) => !v)} dot={restock.tileDot} />
      <AppsMenu open={open} onClose={() => setOpen(false)} items={items} />
      {pwOpen && <PasswordSheet onClose={() => setPwOpen(false)} />}
    </span>
  );
}
