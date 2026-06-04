'use client';

import Link from 'next/link';

export function HomeSidebar({ mounted }: { mounted: boolean }) {
  return (
    <div className="home-sidebar" style={{
      width: 360, minWidth: 360,
      background: '#1a1a2e',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '60px 40px 40px',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
        background: 'radial-gradient(ellipse at 20% 20%, rgba(90, 21, 21, 0.15) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateX(0)' : 'translateX(-20px)',
        transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}>
        <div style={{
          width: 32, height: 1,
          background: 'linear-gradient(90deg, var(--action), rgba(90,21,21,0.3))',
          marginBottom: 32,
        }} />

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '2.6rem', fontWeight: 300,
          color: '#f0ece6', letterSpacing: '0.12em',
          lineHeight: 1.1, marginBottom: 12,
        }}>
          CAVE<br />DE VIN
        </h1>

        <div style={{
          width: 48, height: 1,
          background: 'linear-gradient(90deg, rgba(90,21,21,0.6), transparent)',
          marginBottom: 20,
        }} />

        <p style={{
          fontSize: '0.75rem',
          color: 'rgba(240, 236, 230, 0.4)',
          letterSpacing: '0.2em', textTransform: 'uppercase',
          fontWeight: 500,
        }}>
          Sales Support
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ borderTop: '1px solid rgba(240,236,230,0.06)', paddingTop: 16 }}>
          <Link
            href="/admin"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: '0.7rem', color: 'rgba(240, 236, 230, 0.25)',
              textDecoration: 'none', letterSpacing: '0.15em',
              textTransform: 'uppercase', fontWeight: 500, padding: '8px 0',
              transition: 'color 0.3s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(240, 236, 230, 0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240, 236, 230, 0.25)')}
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
            fontSize: '0.65rem', color: 'rgba(240, 236, 230, 0.15)',
            letterSpacing: '0.05em',
          }}>
            v2.0 &middot; Powered by AI
          </div>
        </div>
      </div>
    </div>
  );
}
