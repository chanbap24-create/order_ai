'use client';

/**
 * 날짜 범위 프리셋 버튼 그룹. 현재 선택된 범위와 일치하는 프리셋은 하이라이트.
 *
 * Props:
 *  - startDate/endDate: 현재 선택값 (YYYY-MM-DD)
 *  - onChange({ startDate, endDate }): 프리셋 클릭 시 호출
 *  - compact?: true 면 폰트/패딩 축소 (좁은 툴바 대응)
 */

import { PRESETS, matchPreset, type DateRange } from '@/app/lib/dateRangePresets';

type Props = {
  startDate: string;
  endDate: string;
  onChange: (range: DateRange) => void;
  compact?: boolean;
};

export function DateRangePresets({ startDate, endDate, onChange, compact = false }: Props) {
  const active = matchPreset({ startDate, endDate });

  const baseBtn: React.CSSProperties = {
    height: compact ? 26 : 30,
    padding: compact ? '0 8px' : '0 10px',
    fontSize: compact ? 11 : 12,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-card)',
    color: 'var(--color-text-light)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  };
  const activeBtn: React.CSSProperties = {
    ...baseBtn,
    background: '#8B1538',
    color: '#fff',
    borderColor: '#8B1538',
    fontWeight: 600,
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.fn())}
          style={active === p.id ? activeBtn : baseBtn}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
