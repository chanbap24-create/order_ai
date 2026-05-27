'use client';

import type { CSSProperties, ReactNode } from 'react';

type Gap = 4 | 8 | 12 | 16 | 20 | 24 | 32;

interface StackProps {
  direction?: 'vertical' | 'horizontal';
  gap?: Gap;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
  fullWidth?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

const ALIGN_MAP: Record<NonNullable<StackProps['align']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};
const JUSTIFY_MAP: Record<NonNullable<StackProps['justify']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

/**
 * 모든 수직/수평 간격은 Stack 으로. gap 은 8px grid 의 배수만 허용.
 * Stack 안에 들어간 자식은 자동으로 일정한 리듬을 갖는다.
 */
export function Stack({
  direction = 'vertical',
  gap = 16,
  align,
  justify,
  wrap,
  fullWidth,
  style,
  children,
}: StackProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        gap,
        alignItems: align ? ALIGN_MAP[align] : undefined,
        justifyContent: justify ? JUSTIFY_MAP[justify] : undefined,
        flexWrap: wrap ? 'wrap' : undefined,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
