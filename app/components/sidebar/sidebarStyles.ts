/**
 * Phase A 사이드바 스타일 — 다크 네이비 톤.
 * - 데스크탑(>=1024px) 에서만 노출.
 * - 너비 232px (펼침) / 60px (접힘).
 * - 배경 var(--surface-dark), warm white 텍스트, burgundy 액티브.
 */
export const SIDEBAR_STYLES = `
.app-sidebar {
  display: none;
}

.sb-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  /* 메인 PageHeader 구분선 y(약 84px = 24 + title 32 + accent 12 + 16) 와 정렬되도록 padding 조정 */
  padding: 26px 18px 30px;
  color: var(--text-on-dark);
  text-decoration: none;
  letter-spacing: 0.12em;
  border-bottom: 1px solid var(--border-on-dark);
}
.sb-logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--action);
  color: var(--text-on-primary);
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}
.sb-logo-text {
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
  color: var(--text-on-dark-muted);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  letter-spacing: 0.01em;
  transition: background 0.12s ease, color 0.12s ease;
  white-space: nowrap;
}
.sb-link:hover {
  background: var(--surface-dark-active);
  color: var(--text-on-dark);
}
.sb-link.active {
  background: var(--action);
  color: var(--text-on-dark);
  font-weight: 700;
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

.sb-footer {
  border-top: 1px solid var(--border-on-dark);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sb-admin-link {
  color: var(--text-on-dark-subtle);
}

.sb-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid var(--border-on-dark);
  background: transparent;
  color: var(--text-on-dark-subtle);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.sb-collapse-btn:hover {
  background: var(--surface-dark-active);
  color: var(--text-on-dark);
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
    background-color: var(--surface-dark);
    /* HomeSidebar 와 동일 질감:
     *   1. SVG fractalNoise 3% — 빈티지 페인트 입자감
     *   2. radial-gradient 뉴트럴 글로우 (좌상단)
     */
    background-image:
      radial-gradient(ellipse at 20% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-repeat: no-repeat, repeat;
    background-size: 100% 100%, 256px 256px;
    /* 단단한 1px border 대신 soft shadow 로 사이드바→메인 자연스러운 연결 */
    box-shadow: 6px 0 28px -12px rgba(0, 0, 0, 0.18), 1px 0 0 0 rgba(0, 0, 0, 0.04);
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
