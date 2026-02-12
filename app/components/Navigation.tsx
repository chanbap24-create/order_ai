'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/inventory': 'Inventory',
  '/quote': 'Quote',
  '/order': 'Order',
  '/admin': 'Admin',
  '/glass': 'Glass',
};

const NAV_LINKS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/inventory',
    label: 'Inventory',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href: '/quote',
    label: 'Quote',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: '/order',
    label: 'Order',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    ),
  },
];

export default function Navigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');

  // 현재 페이지 타이틀
  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) =>
      path === '/' ? pathname === '/' : pathname.startsWith(path)
    )?.[1] || 'Cave De Vin';

  // 드로어 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <style>{`
        /* ─── Drawer ─── */
        .gn-drawer-overlay {
          position: fixed; inset: 0; z-index: 1999;
          background: rgba(0,0,0,0.45);
          opacity: 0; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .gn-drawer-overlay.open { opacity: 1; pointer-events: auto; }

        .gn-drawer {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 280px; z-index: 2000;
          background: #1a1a2e;
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          display: flex; flex-direction: column;
          padding: 0;
          overflow-y: auto;
        }
        .gn-drawer.open { transform: translateX(0); }

        .gn-drawer-link {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 24px;
          text-decoration: none;
          font-size: 0.85rem; font-weight: 500;
          color: rgba(240,236,230,0.55);
          transition: all 0.2s ease;
          border-left: 2px solid transparent;
        }
        .gn-drawer-link:hover {
          color: #f0ece6;
          background: rgba(240,236,230,0.04);
        }
        .gn-drawer-link.active {
          color: #f0ece6;
          border-left-color: #5A1515;
          background: rgba(90,21,21,0.15);
        }

        /* ─── Top bar ─── */
        .gn-topbar { height: 48px; }
        .gn-hamburger { display: none; }

        @media (max-width: 768px) {
          .gn-topbar { height: 44px !important; padding: 0 12px !important; }
          .gn-hamburger { display: flex !important; }
          .gn-page-title { font-size: 0.8rem !important; }
        }
      `}</style>

      {/* ─── Drawer Overlay ─── */}
      <div
        className={`gn-drawer-overlay${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ─── Slide-out Drawer ─── */}
      <nav className={`gn-drawer${drawerOpen ? ' open' : ''}`}>
        {/* Drawer header */}
        <div style={{
          padding: '28px 24px 20px',
          borderBottom: '1px solid rgba(240,236,230,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1.4rem',
              fontWeight: 300,
              color: '#f0ece6',
              letterSpacing: '0.1em',
            }}>
              CAVE DE VIN
            </h2>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1px solid rgba(240,236,230,0.12)', background: 'transparent',
                color: 'rgba(240,236,230,0.5)', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
          <p style={{
            fontSize: '0.65rem',
            color: 'rgba(240,236,230,0.25)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginTop: 6,
          }}>
            Sales Automation
          </p>
        </div>

        {/* Nav links */}
        <div style={{ padding: '12px 0', flex: 1 }}>
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`gn-drawer-link${isActive(link.href) ? ' active' : ''}`}
              onClick={() => setDrawerOpen(false)}
            >
              <span style={{ opacity: isActive(link.href) ? 1 : 0.5, display: 'flex' }}>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>

        {/* Drawer footer */}
        <div style={{
          padding: '16px 24px 24px',
          borderTop: '1px solid rgba(240,236,230,0.06)',
        }}>
          <Link
            href="/admin"
            className="gn-drawer-link"
            onClick={() => setDrawerOpen(false)}
            style={{ padding: '8px 0', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <span>Admin</span>
          </Link>
          <div style={{
            marginTop: 12,
            fontSize: '0.6rem',
            color: 'rgba(240,236,230,0.15)',
            letterSpacing: '0.05em',
          }}>
            v2.0 · Powered by AI
          </div>
        </div>
      </nav>

      {/* ─── Minimal Top Bar ─── */}
      <header className="gn-topbar" style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 48,
        background: '#fafaf8',
        borderBottom: '1px solid #e8e5e0',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          {/* Left: hamburger + page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="gn-hamburger"
              onClick={() => setDrawerOpen(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#8E8E93', padding: 4,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <span className="gn-page-title" style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#1a1a2e',
              letterSpacing: '0.01em',
            }}>
              {pageTitle}
            </span>
          </div>

          {/* Right: utility icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Search */}
            <button style={{
              width: 32, height: 32, borderRadius: 8,
              border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#8E8E93', transition: 'color 0.2s ease',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#5A1515')}
              onMouseLeave={e => (e.currentTarget.style.color = '#8E8E93')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Profile / Menu */}
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: 'none',
                background: 'linear-gradient(135deg, #5A1515, #8B1538)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#f0ece6', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.03em',
              }}
            >
              C
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
