'use client';

import Link from 'next/link';
import type { RefObject } from 'react';
import { NAV_LINKS } from './constants';

type Props = {
  open: boolean;
  drawerRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  pathname: string;
  isActive: (path: string) => boolean;
};

export function MobileDrawer({ open, drawerRef, onClose, pathname, isActive }: Props) {
  return (
    <>
      <div
        className={`nav-overlay${open ? ' open' : ''}`}
        onClick={onClose}
      />

      <div ref={drawerRef} className={`nav-drawer${open ? ' open' : ''}`}>
        <div className="nav-drawer-grain" />
        <div className="nav-drawer-gradient" />

        <button className="nav-drawer-close" onClick={onClose} aria-label="닫기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="nav-drawer-header">
          <div style={{
            width: 32, height: 1,
            background: 'linear-gradient(90deg, var(--action), rgba(90,21,21,0.3))',
            marginBottom: 24,
          }} />
          <Link
            href="/"
            onClick={onClose}
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '2.2rem',
              fontWeight: 300,
              color: '#f0ece6',
              letterSpacing: '0.12em',
              lineHeight: 1.1,
              textDecoration: 'none',
              display: 'block',
              marginBottom: 12,
            }}
          >
            CAVE<br />DE VIN
          </Link>
          <div style={{
            width: 48, height: 1,
            background: 'linear-gradient(90deg, rgba(90,21,21,0.6), transparent)',
            marginBottom: 16,
          }} />
          <p style={{
            fontSize: '0.7rem',
            color: 'rgba(240, 236, 230, 0.4)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 500,
            margin: 0,
          }}>
            Sales Support
          </p>
        </div>

        <div className="nav-drawer-body">
          <Link
            href="/"
            className={`nav-drawer-link${pathname === '/' ? ' active' : ''}`}
            onClick={onClose}
          >
            Dashboard
          </Link>
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-drawer-link${isActive(link.href) ? ' active' : ''}`}
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="nav-drawer-footer">
          <div style={{ borderTop: '1px solid rgba(240,236,230,0.06)', paddingTop: 16 }}>
            <Link
              href="/admin"
              className={`nav-drawer-admin${isActive('/admin') ? ' active' : ''}`}
              onClick={onClose}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              Admin Console
            </Link>
            <div style={{
              marginTop: 20, paddingTop: 20,
              borderTop: '1px solid rgba(240, 236, 230, 0.06)',
              fontSize: '0.65rem',
              color: 'rgba(240, 236, 230, 0.15)',
              letterSpacing: '0.05em',
            }}>
              v2.0 &middot; Powered by AI
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
