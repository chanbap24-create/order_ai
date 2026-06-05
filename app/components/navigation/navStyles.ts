export const NAV_STYLES = `
/* ─── Top bar ─── */
.nav-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 56px;
  background: #fff;
  border-bottom: 1px solid var(--gray-200);
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
.nav-logo:hover { color: var(--action); }

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
.nav-link:hover { color: var(--action); }
.nav-link.active {
  color: var(--action);
  font-weight: 600;
}
.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--action);
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
  border-left: 3px solid var(--action);
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
`;
