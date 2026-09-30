import { SIDEBAR_LINKS } from '../sidebar/sidebarConstants';

/** 모바일 TopBar·드로어 메뉴 — 데스크탑 사이드바(SIDEBAR_LINKS)에서 파생 (단일 소스).
 *  ⚠️ 과거 별도 하드코딩 목록이라 사이드바에만 항목이 추가되는 드리프트가 있었음
 *  (Order v3·소믈리에가 모바일에서 안 보이던 버그). 여기에 직접 항목을 추가하지 말 것. */
export const NAV_LINKS = SIDEBAR_LINKS
  .filter((l) => l.href !== '/') // 홈은 드로어 상단 로고가 담당
  .map(({ href, label }) => ({ href, label }));
