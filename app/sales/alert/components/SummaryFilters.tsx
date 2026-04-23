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

export function SummaryFilters(p: Props) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
          {p.counts.out > 0 && <span style={{ color: '#dc3545', fontWeight: 600 }}>품절 {p.counts.out}</span>}
          {p.counts.low > 0 && <span style={{ color: '#e65100', fontWeight: 600 }}>부족 {p.counts.low}</span>}
          <span style={{ color: '#8a8580' }}>총 {p.counts.total}건</span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { key: 'all' as FilterType, label: '전체' },
            { key: 'out_of_stock' as FilterType, label: '품절' },
            { key: 'low_stock' as FilterType, label: '부족' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => p.onFilterChange(f.key)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: p.filter === f.key ? '#5A1515' : '#f0f0f0',
                color: p.filter === f.key ? 'white' : '#666',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, padding: '8px 12px', background: '#faf9f7', borderRadius: 8,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={p.allChecked}
            onChange={p.onToggleAll}
            style={{ width: 16, height: 16, accentColor: '#5A1515' }}
          />
          <span style={{ fontWeight: 500, color: '#2c1810' }}>
            전체 선택 {p.checkedCount > 0 && `(${p.checkedCount}개)`}
          </span>
        </label>

        {p.checkedCount > 0 && (
          <button
            onClick={p.onDismiss}
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #dc3545',
              background: 'white', color: '#dc3545',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            {p.checkedCount}개 제외
          </button>
        )}
      </div>
    </>
  );
}
