'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SIDEBAR_LINKS } from './sidebarConstants';
import { SIDEBAR_STYLES } from './sidebarStyles';

/**
 * Phase A PoC: 데스크탑 영구 좌측 사이드바.
 * - 데스크탑(>=1024px) 에서만 표시. 모바일은 기존 TopBar + Drawer 사용.
 * - 접기/펴기 토글, 활성 표시. Breadcrumb 은 다음 단계에서 추가.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // localStorage 로 접힘 상태 영구 보존
  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? window.localStorage.getItem('cdv:sidebar:collapsed')
      : null;
    if (saved === '1') setCollapsed(true);
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cdv:sidebar:collapsed', collapsed ? '1' : '0');
    }
    // body 에 클래스 토글 → layout main 의 padding 조정
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('cdv-sidebar-collapsed', collapsed);
    }
  }, [collapsed]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <style>{SIDEBAR_STYLES}</style>
      <aside
        className={`app-sidebar${collapsed ? ' collapsed' : ''}`}
        aria-label="주 메뉴"
      >
        <Link href="/" className="sb-logo" title="홈">
          <span className="sb-logo-mark">C</span>
          <span className="sb-logo-text">CAVE DE VIN</span>
        </Link>

        <nav className="sb-nav">
          {SIDEBAR_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sb-link${isActive(link.href) ? ' active' : ''}`}
              title={link.label}
            >
              <span className="sb-icon" aria-hidden>
                {link.icon}
              </span>
              <span className="sb-label">{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* 하단 영역: Admin + 접기 토글 */}
        <div className="sb-footer">
          <Link
            href="/admin"
            className={`sb-link sb-admin-link${isActive('/admin') ? ' active' : ''}`}
            title="Admin"
          >
            <span className="sb-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span className="sb-label">Admin</span>
          </Link>

          <button
            type="button"
            className="sb-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
