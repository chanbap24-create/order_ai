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
 * 제목/부제목/액션의 정렬·간격·typography 가 자동으로 통일된다.
 * Breadcrumb 는 다음 단계에서 추가 예정.
 */
export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 16,
        paddingBottom: 16,
        marginBottom: 20,
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <p
            style={{
              fontSize: 11,
              color: 'var(--action)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 600,
              margin: '0 0 6px',
            }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '1.5rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-tertiary)',
              margin: '6px 0 0',
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {actions}
        </div>
      )}
    </header>
  );
}
