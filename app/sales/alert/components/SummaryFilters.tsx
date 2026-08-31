'use client';

import type { AlertCounts, FilterType } from '../types';

type Props = {
  counts: AlertCounts;
  filter: FilterType;
  onFilterChange: (f: FilterType) => void;
  allChecked: boolean;
  onToggleAll: () => void;
  checkedCount: number;
  onDismiss: () => void;
};

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'out_of_stock', label: '품절' },
  { key: 'vintage_change', label: '빈티지 변경' },
  { key: 'low_stock', label: '부족' },
];

export function SummaryFilters(p: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        flexWrap: 'wrap',
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={p.allChecked}
          onChange={p.onToggleAll}
          style={{ width: 14, height: 14, accentColor: 'var(--action)', margin: 0 }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          전체 선택
        </span>
        {p.checkedCount > 0 && (
          <span style={{ fontSize: 12, color: 'var(--action)', fontWeight: 700 }}>
            {p.checkedCount}
          </span>
        )}
      </label>

      <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
        {p.counts.out > 0 && (
          <span style={{ color: 'var(--status-danger)', fontWeight: 700 }}>품절 {p.counts.out}</span>
        )}
        {(p.counts.vintage || 0) > 0 && (
          <span style={{ color: 'var(--status-info)', fontWeight: 700 }}>빈티지 변경 {p.counts.vintage}</span>
        )}
        {p.counts.low > 0 && (
          <span style={{ color: 'var(--status-warning)', fontWeight: 700 }}>부족 {p.counts.low}</span>
        )}
        <span style={{ color: 'var(--text-tertiary)' }}>총 {p.counts.total}건</span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {FILTERS.map((f) => {
          const isActive = p.filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => p.onFilterChange(f.key)}
              style={{
                height: 28,
                padding: '0 12px',
                borderRadius: 6,
                border: `1px solid ${isActive ? 'var(--action)' : 'var(--border-default)'}`,
                background: isActive ? 'var(--action)' : 'var(--surface)',
                color: isActive ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {p.checkedCount > 0 && (
        <button
          onClick={p.onDismiss}
          style={{
            height: 28,
            padding: '0 12px',
            borderRadius: 6,
            border: '1px solid var(--status-danger)',
            background: 'var(--surface)',
            color: 'var(--status-danger)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          제외
        </button>
      )}
    </div>
  );
}
