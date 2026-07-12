'use client';

import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** 짧은 카테고리 라벨 (선택). 예: "Sales", "Inventory" */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** 우측 액션 영역 (Button 등) */
  actions?: ReactNode;
}

/**
 * 모든 페이지 상단에 동일한 규칙으로 노출되는 헤더.
 * eyebrow/title/subtitle/actions 4 슬롯. typography·여백·구분선 자동 통일.
 *
 * 모바일(<=768px) 분기: title 축소, actions wrap, 카드 padding 축소
 * — globalThis CSS 가 아닌 PageHeader 자체에 inline media via <style scoped>
 */
export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <>
      <style>{PAGE_HEADER_STYLES}</style>
      <header className="ph-root">
        <div className="ph-text">
          {eyebrow && <p className="ph-eyebrow">{eyebrow}</p>}
          <h1 className="ph-title">{title}</h1>
          {subtitle && <p className="ph-sub">{subtitle}</p>}
        </div>
        {actions && <div className="ph-actions">{actions}</div>}
      </header>
    </>
  );
}

const PAGE_HEADER_STYLES = `
  /* KREAM 스타일 타이틀 블록 — 장식(액센트바) 없이 크고 무거운 타이포가 위계를 만든다 */
  .ph-root {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    padding: 8px 0 20px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  .ph-text { min-width: 0; }
  .ph-eyebrow {
    font-size: 11px;
    color: var(--text-muted);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 700;
    margin: 0 0 4px;
  }
  .ph-title {
    font-size: 1.5rem;    font-weight: 500;
    color: var(--text-primary);
    letter-spacing: 0.01em;
    line-height: 1.2;
    margin: 0;
  }
  .ph-sub {
    font-size: 13px;
    color: var(--text-tertiary);
    margin: 6px 0 0;
    line-height: 1.5;
  }
  .ph-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  @media (max-width: 768px) {
    .ph-root {
      gap: 8px;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .ph-title { font-size: 1.25rem; }
    .ph-sub { font-size: 12px; margin-top: 4px; }
    .ph-eyebrow { font-size: 10px; margin-bottom: 4px; }
    .ph-actions { width: 100%; }
  }
`;
