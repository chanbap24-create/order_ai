'use client';

import type { AnalysisType } from '../types';

/**
 * 까브드뱅/대유라이프 segmented toggle.
 * 다른 페이지의 SegmentedToggle 과 동일한 사양 (height 28, minWidth 90, radius 6).
 */
export function TypeToggle({
  type,
  onChange,
}: {
  type: AnalysisType;
  onChange: (t: AnalysisType) => void;
}) {
  const options: { value: AnalysisType; label: string }[] = [
    { value: 'wine', label: '까브드뱅' },
    { value: 'glass', label: '대유라이프' },
  ];

  return (
    <div style={{ display: 'flex', height: 28, marginBottom: 16 }}>
      {options.map((o, idx) => {
        const isActive = type === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              minWidth: 90,
              padding: '0 14px',
              border: '1px solid var(--border-default)',
              background: isActive ? 'var(--action)' : 'var(--surface)',
              color: isActive ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: idx === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
              borderLeftWidth: idx === 0 ? 1 : 0,
              letterSpacing: '0.02em',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
