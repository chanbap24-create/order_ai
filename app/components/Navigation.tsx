'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV_STYLES } from './navigation/navStyles';
import { TopBar } from './navigation/TopBar';
import { MobileDrawer } from './navigation/MobileDrawer';

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

  return (
    <>
      <style>{NAV_STYLES}</style>

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
