'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV_STYLES } from './navigation/navStyles';
import { TopBar } from './navigation/TopBar';
import { MobileDrawer } from './navigation/MobileDrawer';
import { Sidebar } from './sidebar/Sidebar';

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        drawerRef.current && !drawerRef.current.contains(target) &&
        hamburgerRef.current && !hamburgerRef.current.contains(target)
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // 소믈리에(백화점 손님 대면 화면)는 앱 네비 없이 단독 풀스크린 (훅 뒤에 위치해야 함)
  if (pathname.startsWith('/sommelier')) return null;

  return (
    <>
      <style>{NAV_STYLES}</style>

      {/* 데스크탑 영구 사이드바 (Phase A) — 모바일에서는 CSS 로 숨김 */}
      <Sidebar />

      {/* 기존 상단 TopBar — 모바일 전용 (데스크탑은 sidebarStyles 에서 hide) */}
      <TopBar
        hamburgerRef={hamburgerRef}
        onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        isActive={isActive}
      />

      <MobileDrawer
        open={mobileMenuOpen}
        drawerRef={drawerRef}
        onClose={() => setMobileMenuOpen(false)}
        pathname={pathname}
        isActive={isActive}
      />
    </>
  );
}
