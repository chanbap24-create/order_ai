'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

const NAV_LINKS = [
  { href: '/inventory', label: 'Inventory' },
  { href: '/quote', label: 'Quote' },
  { href: '/sales', label: 'Sales' },
  { href: '/analysis', label: 'Analysis' },
  { href: '/order', label: 'Order' },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');

  // 외부 클릭 시 드로어 닫기
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

  // body 스크롤 잠금
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // 페이지 이동 시 메뉴 닫기
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <style>{`
        /* ─── Top bar ─── */
        .nav-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 56px;
          background: #fff;
          border-bottom: 1px solid #E5E5E5;
          z-index: 1000;
          display: flex;
          align-items: center;
          padding: 0 24px;
          font-family: 'DM Sans', -apple-system, sans-serif;
        }

        .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* ─── Logo ─── */
        .nav-logo {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 1.05rem;
          font-weight: 600;
          color: #1a1a2e;
          letter-spacing: 0.12em;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .nav-logo:hover { color: #5A1515; }

        /* ─── Desktop nav ─── */
        .nav-links {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .nav-link {
          position: relative;
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 500;
          color: #999;
          padding: 18px 0;
          transition: color 0.2s ease;
          white-space: nowrap;
        }
        .nav-link:hover { color: #5A1515; }
        .nav-link.active {
          color: #5A1515;
          font-weight: 600;
        }
        .nav-link.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #5A1515;
          border-radius: 1px;
        }

        /* ─── Hamburger ─── */
        .nav-hamburger {
          display: none;
          width: 36px; height: 36px;
          border: none;
          background: transparent;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          color: #2D2D2D;
          padding: 0;
          flex-shrink: 0;
        }

        /* ─── Mobile logo (center) ─── */
        .nav-mobile-logo {
          display: none;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 0.95rem;
          font-weight: 600;
          color: #1a1a2e;
          letter-spacing: 0.12em;
          text-decoration: none;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        /* ─── Overlay ─── */
        .nav-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1001;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .nav-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        /* ─── Side drawer (dark, matches dashboard sidebar) ─── */
        .nav-drawer {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: 300px;
          max-width: 82vw;
          background: #1a1a2e;
          z-index: 1002;
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', -apple-system, sans-serif;
          overflow: hidden;
        }
        .nav-drawer.open {
          transform: translateX(0);
        }

        /* Grain texture overlay */
        .nav-drawer-grain {
          position: absolute; inset: 0;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          pointer-events: none;
        }

        /* Gradient accent */
        .nav-drawer-gradient {
          position: absolute; top: 0; left: 0; right: 0; height: 100%;
          background: radial-gradient(ellipse at 20% 20%, rgba(90, 21, 21, 0.15) 0%, transparent 60%);
          pointer-events: none;
        }

        .nav-drawer-header {
          position: relative;
          z-index: 1;
          padding: 40px 32px 0;
          flex-shrink: 0;
        }

        .nav-drawer-close {
          position: absolute;
          top: 16px; right: 16px;
          width: 32px; height: 32px;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(240, 236, 230, 0.3);
          border-radius: 6px;
          transition: all 0.2s ease;
          z-index: 2;
        }
        .nav-drawer-close:hover {
          color: rgba(240, 236, 230, 0.7);
          background: rgba(240, 236, 230, 0.06);
        }

        .nav-drawer-body {
          position: relative;
          z-index: 1;
          flex: 1;
          overflow-y: auto;
          padding: 32px 0 0;
        }

        .nav-drawer-link {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 32px;
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 500;
          color: rgba(240, 236, 230, 0.5);
          letter-spacing: 0.03em;
          transition: all 0.2s ease;
        }
        .nav-drawer-link:hover {
          color: rgba(240, 236, 230, 0.85);
          background: rgba(240, 236, 230, 0.04);
        }
        .nav-drawer-link.active {
          color: #f0ece6;
          font-weight: 600;
          background: rgba(90, 21, 21, 0.25);
          border-left: 3px solid #5A1515;
        }

        .nav-drawer-footer {
          position: relative;
          z-index: 1;
          padding: 0 32px 32px;
          flex-shrink: 0;
        }

        .nav-drawer-admin {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-size: 0.7rem;
          color: rgba(240, 236, 230, 0.25);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 500;
          padding: 8px 0;
          transition: color 0.3s ease;
        }
        .nav-drawer-admin:hover {
          color: rgba(240, 236, 230, 0.6);
        }
        .nav-drawer-admin.active {
          color: rgba(240, 236, 230, 0.6);
        }

        /* ─── Responsive ─── */
        @media (max-width: 768px) {
          .nav-bar { padding: 0 16px; }
          .nav-links { display: none; }
          .nav-logo { display: none; }
          .nav-hamburger { display: flex; }
          .nav-mobile-logo { display: block; }
        }
      `}</style>

      <header className="nav-bar">
        <div className="nav-inner" style={{ position: 'relative' }}>
          {/* Left: Logo (desktop) / Hamburger (mobile) */}
          <Link href="/" className="nav-logo">CAVE DE VIN</Link>
          <button
            ref={hamburgerRef}
            className="nav-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="메뉴"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Center: Nav tabs (desktop) / Logo (mobile) */}
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

          {/* Right: spacer for balance */}
          <div style={{ width: 32, flexShrink: 0 }} />
        </div>
      </header>

      {/* ─── Overlay ─── */}
      <div
        className={`nav-overlay${mobileMenuOpen ? ' open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* ─── Side drawer (dark, matches dashboard sidebar) ─── */}
      <div ref={drawerRef} className={`nav-drawer${mobileMenuOpen ? ' open' : ''}`}>
        {/* Texture overlays */}
        <div className="nav-drawer-grain" />
        <div className="nav-drawer-gradient" />

        {/* Close button */}
        <button className="nav-drawer-close" onClick={() => setMobileMenuOpen(false)} aria-label="닫기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Branding header */}
        <div className="nav-drawer-header">
          <div style={{
            width: 32, height: 1,
            background: 'linear-gradient(90deg, #5A1515, rgba(90,21,21,0.3))',
            marginBottom: 24,
          }} />
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
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

        {/* Nav links */}
        <div className="nav-drawer-body">
          <Link
            href="/"
            className={`nav-drawer-link${pathname === '/' ? ' active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-drawer-link${isActive(link.href) ? ' active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="nav-drawer-footer">
          <div style={{ borderTop: '1px solid rgba(240,236,230,0.06)', paddingTop: 16 }}>
            <Link
              href="/admin"
              className={`nav-drawer-admin${isActive('/admin') ? ' active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
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
