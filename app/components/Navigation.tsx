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
          display: 'flex',
          alignItems: 'center',
          textDecoration: 'none'
        }}>
          <svg width="40" height="40" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 50 200 A 150 150 0 1 1 350 200" stroke="#1a1a1a" strokeWidth="40" fill="none"/>
            <path d="M 350 200 A 150 150 0 0 1 50 200" stroke="#1a1a1a" strokeWidth="40" fill="none"/>
            <circle cx="130" cy="115" r="30" fill="#1a1a1a"/>
            <circle cx="220" cy="115" r="30" fill="none" stroke="#1a1a1a" strokeWidth="4"/>
            <circle cx="310" cy="115" r="30" fill="#1a1a1a"/>
            <circle cx="175" cy="185" r="30" fill="#1a1a1a"/>
            <circle cx="265" cy="185" r="30" fill="#1a1a1a"/>
            <circle cx="220" cy="255" r="30" fill="#1a1a1a"/>
          </svg>
        </Link>
        
        {/* Navigation Links */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          background: 'white',
          padding: 'var(--space-1)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)'
        }}>
          <Link
            href="/inventory"
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
              color: isActive('/inventory') ? 'white' : '#1a1a1a',
              background: isActive('/inventory') ? '#1a1a1a' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.03em'
            }}
          >
            INVENTORY
          </Link>

          <Link
            href="/wine"
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
              color: isActive('/wine') ? 'white' : '#1a1a1a',
              background: isActive('/wine') ? '#1a1a1a' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.03em'
            }}
          >
            WINE
          </Link>
          
          <Link
            href="/glass"
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
              color: isActive('/glass') ? 'white' : '#1a1a1a',
              background: isActive('/glass') ? '#1a1a1a' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.03em'
            }}
          >
            RIEDEL
          </Link>
        </div>
      </div>
    </nav>
  );
}
