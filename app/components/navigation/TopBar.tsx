'use client';

import Link from 'next/link';
import type { RefObject } from 'react';
import { NAV_LINKS } from './constants';

type Props = {
  hamburgerRef: RefObject<HTMLButtonElement | null>;
  onToggleMenu: () => void;
  isActive: (path: string) => boolean;
};

export function TopBar({ hamburgerRef, onToggleMenu, isActive }: Props) {
  return (
    <header className="nav-bar">
      <div className="nav-inner" style={{ position: 'relative' }}>
        <Link href="/" className="nav-logo">CAVE DE VIN</Link>
        <button
          ref={hamburgerRef}
          className="nav-hamburger"
          onClick={onToggleMenu}
          aria-label="메뉴"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <nav className="nav-links">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link${isActive(link.href) ? ' active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="nav-mobile-logo">CAVE DE VIN</Link>

        <div style={{ width: 32, flexShrink: 0 }} />
      </div>
    </header>
  );
}
