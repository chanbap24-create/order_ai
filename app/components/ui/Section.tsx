'use client';

import type { ReactNode } from 'react';

interface SectionProps {
  /** 섹션 제목. 없으면 헤더 영역 자체가 사라짐 */
  title?: string;
  /** 제목 우측 부가 정보 (건수 등) */
  meta?: ReactNode;
  /** 제목 우측 정렬 액션 영역 */
  actions?: ReactNode;
  /** 외곽 카드 외양. false 면 background/border 없이 children 만 */
  bordered?: boolean;
  /** 콘텐츠 좌우/상하 padding */
  padding?: 'none' | 'sm' | 'md';
  children: ReactNode;
}

const PAD = { none: '0', sm: '12px 16px', md: '16px 20px' } as const;

/**
 * 페이지 안 한 영역 (필터/표/요약 등)을 동일한 규칙으로 감싸는 컨테이너.
 * 외곽선·padding·헤더 typography 가 모든 페이지에서 자동 통일.
 */
export function Section({
  title,
  meta,
  actions,
  bordered = true,
  padding = 'md',
  children,
}: SectionProps) {
  return (
    <section
      style={{
        background: bordered ? 'var(--surface)' : 'transparent',
        border: bordered ? '1px solid var(--border-default)' : 'none',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {(title || actions) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              minWidth: 0,
            }}
          >
            {title && (
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.01em',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </h2>
            )}
            {meta && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                }}
              >
                {meta}
              </span>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </header>
      )}
      <div style={{ padding: PAD[padding] }}>{children}</div>
    </section>
  );
}
