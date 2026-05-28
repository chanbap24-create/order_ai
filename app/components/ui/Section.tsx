'use client';

import type { ReactNode } from 'react';

interface SectionProps {
  /** 섹션 제목 */
  title?: string;
  /** 제목 우측 부가 정보 (건수 등) */
  meta?: ReactNode;
  /** 제목 우측 정렬 액션 영역 */
  actions?: ReactNode;
  /** 외곽 카드 외양. false 면 background/border 없이 children 만 */
  bordered?: boolean;
  /** 콘텐츠 좌우/상하 padding */
  padding?: 'none' | 'sm' | 'md';
  /** 내부 dropdown/autocomplete 등이 섹션 경계를 넘어가야 할 때 true (기본 false: overflow hidden) */
  overflowVisible?: boolean;
  children: ReactNode;
}

/**
 * 페이지 안 한 영역 (필터/표/요약 등)을 동일한 규칙으로 감싸는 컨테이너.
 * 외곽선·padding·헤더 typography 가 모든 페이지에서 자동 통일.
 * 모바일(<=768px)에서 padding 축소.
 */
export function Section({
  title,
  meta,
  actions,
  bordered = true,
  padding = 'md',
  overflowVisible = false,
  children,
}: SectionProps) {
  return (
    <>
      <style>{SECTION_STYLES}</style>
      <section
        className={`sec-root${bordered ? ' bordered' : ''} pad-${padding}${overflowVisible ? ' overflow-visible' : ''}`}
      >
        {(title || actions) && (
          <header className="sec-header">
            <div className="sec-titlewrap">
              {title && <h2 className="sec-title">{title}</h2>}
              {meta && <span className="sec-meta">{meta}</span>}
            </div>
            {actions && <div className="sec-actions">{actions}</div>}
          </header>
        )}
        <div className="sec-body">{children}</div>
      </section>
    </>
  );
}

const SECTION_STYLES = `
  .sec-root {
    background: transparent;
    border-radius: 10px;
    overflow: hidden;
  }
  .sec-root.overflow-visible { overflow: visible; }
  .sec-root.bordered {
    background: var(--surface);
    border: 1px solid var(--border-default);
  }
  .sec-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface);
  }
  .sec-titlewrap {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  .sec-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.01em;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sec-meta {
    font-size: 12px;
    color: var(--text-tertiary);
    font-weight: 500;
  }
  .sec-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .pad-none .sec-body { padding: 0; }
  .pad-sm .sec-body { padding: 12px 16px; }
  .pad-md .sec-body { padding: 16px 20px; }

  @media (max-width: 768px) {
    .sec-header { padding: 10px 12px; }
    .sec-title { font-size: 12px; }
    .sec-meta { font-size: 11px; }
    .pad-sm .sec-body { padding: 10px 12px; }
    .pad-md .sec-body { padding: 12px 14px; }
  }
`;
