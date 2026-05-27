/**
 * Phase A 사이드바 스타일.
 * - 데스크탑(>=1024px) 에서만 노출.
 * - 너비 232px (펼침) / 60px (접힘).
 * - 톤은 기존 burgundy(#5A1515) 유지.
 */
export const SIDEBAR_STYLES = `
.app-sidebar {
  display: none;
}

.sb-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 18px 22px;
  color: #1a1a2e;
  text-decoration: none;
  letter-spacing: 0.12em;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.sb-logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #5A1515;
  color: #fff;
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}
.sb-logo-text {
  font-family: 'Cormorant Garamond', serif;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
}

.sb-nav {
  display: flex;
  flex-direction: column;
  padding: 10px 8px;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
}
.sb-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 6px;
  color: #6b6b78;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  letter-spacing: 0.01em;
  transition: background 0.12s ease, color 0.12s ease;
  white-space: nowrap;
}
.sb-link:hover {
  background: rgba(90,21,21,0.05);
  color: #2c1810;
}
.sb-link.active {
  background: rgba(90,21,21,0.08);
  color: #5A1515;
  font-weight: 600;
}
.sb-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.sb-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 8px;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.08);
  background: #fff;
  color: #8a8580;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.sb-collapse-btn:hover {
  background: rgba(90,21,21,0.05);
  color: #5A1515;
}

/* 접힘 상태 */
.app-sidebar.collapsed {
  width: 60px;
}
.app-sidebar.collapsed .sb-logo {
  justify-content: center;
  padding: 18px 0 22px;
}
.app-sidebar.collapsed .sb-logo-text { display: none; }
.app-sidebar.collapsed .sb-link {
  justify-content: center;
  padding: 9px 0;
}
.app-sidebar.collapsed .sb-label { display: none; }

/* 데스크탑에서만 표시 + 기존 nav-bar / nav-links 데스크탑 숨김 */
@media (min-width: 1024px) {
  .app-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 232px;
    background: #fff;
    border-right: 1px solid rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    z-index: 50;
    transition: width 0.18s ease;
  }
  /* 기존 상단 nav-bar 는 데스크탑에서 숨김 (모바일은 그대로 사용) */
  .nav-bar { display: none; }

  /* main 영역 좌측 패딩으로 sidebar 공간 확보, 상단 패딩은 제거 */
  main {
    padding-left: 232px !important;
    padding-top: 0 !important;
    transition: padding-left 0.18s ease;
  }
  body.cdv-sidebar-collapsed main {
    padding-left: 60px !important;
  }
}
`;
