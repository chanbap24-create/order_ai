'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  
  const isActive = (path: string) => pathname === path;
  
  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '70px',
      background: 'var(--color-card)',
      borderBottom: '1px solid var(--color-border)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--space-6)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Logo */}
        <Link href="/" style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 800,
          color: 'var(--color-text)',
          textDecoration: 'none',
          letterSpacing: '-0.02em'
        }}>
          Order AI
        </Link>
        
        {/* Navigation Links */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)'
        }}>
          <Link
            href="/wine"
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
              color: isActive('/wine') ? 'white' : 'var(--color-text-light)',
              background: isActive('/wine') ? 'var(--color-primary)' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '-0.011em'
            }}
          >
            CV
          </Link>
          
          <Link
            href="/glass"
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
              color: isActive('/glass') ? 'white' : 'var(--color-text-light)',
              background: isActive('/glass') ? 'var(--color-primary)' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '-0.011em'
            }}
          >
            DL
          </Link>
        </div>
      </div>
    </nav>
  );
}
