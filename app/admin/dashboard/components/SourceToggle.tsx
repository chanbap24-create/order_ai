'use client';

import type { SourceMode } from '../types';

type Props = {
  source: SourceMode;
  onChange: (s: SourceMode) => void;
};

/**
 * 분석 소스 segmented toggle (전체 / 까브드뱅 / 대유라이프).
 * 다른 페이지 segmented control 과 동일 사양.
 */
export function SourceToggle({ source, onChange }: Props) {
  const options: { value: SourceMode; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'cdv', label: '까브드뱅' },
    { value: 'dl', label: '대유라이프' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        분석 소스
      </span>
      <div style={{ display: 'flex', height: 28 }}>
        {options.map((o, idx) => {
          const isActive = source === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              style={{
                minWidth: 70,
                padding: '0 14px',
                border: '1px solid var(--border-default)',
                background: isActive ? 'var(--action)' : 'var(--surface)',
                color: isActive ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius:
                  idx === 0
                    ? '6px 0 0 6px'
                    : idx === options.length - 1
                      ? '0 6px 6px 0'
                      : 0,
                borderLeftWidth: idx === 0 ? 1 : 0,
                letterSpacing: '0.02em',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
