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
      height: '80px',
      background: 'white',
      borderBottom: '1px solid #E5E7EB',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--space-6)',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08)'
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
          textDecoration: 'none',
          padding: '0',
          marginLeft: '-8px'
        }}>
          <img 
            src="/logo.png" 
            alt="Cave De Vin Logo" 
            style={{
              height: '64px',
              width: '64px',
              objectFit: 'contain'
            }}
          />
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
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              textDecoration: 'none',
              color: isActive('/inventory') ? 'white' : '#1a1a1a',
              background: isActive('/inventory') ? '#8B1538' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.03em'
            }}
          >
            INVENTORY
          </Link>

          <Link
            href="/wine"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              textDecoration: 'none',
              color: isActive('/wine') ? 'white' : '#1a1a1a',
              background: isActive('/wine') ? '#8B1538' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.03em'
            }}
          >
            WINE
          </Link>
          
          <Link
            href="/glass"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              textDecoration: 'none',
              color: isActive('/glass') ? 'white' : '#1a1a1a',
              background: isActive('/glass') ? '#8B1538' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.03em'
            }}
          >
            RIEDEL
          </Link>

          <Link
            href="/quote"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              textDecoration: 'none',
              color: isActive('/quote') ? 'white' : '#1a1a1a',
              background: isActive('/quote') ? '#8B1538' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.03em'
            }}
          >
            QUOTE
          </Link>

          <Link
            href="/admin"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              textDecoration: 'none',
              color: isActive('/admin') ? 'white' : '#1a1a1a',
              background: isActive('/admin') ? '#8B1538' : 'transparent',
              transition: 'all var(--transition-fast)',
              letterSpacing: '0.03em'
            }}
          >
            ADMIN
          </Link>
        </div>
      </div>
    </nav>
  );
}
