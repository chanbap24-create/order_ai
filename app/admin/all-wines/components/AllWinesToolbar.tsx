'use client';

import type { CountryOption } from '../types';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  country: string;
  onCountryChange: (v: string) => void;
  countries: CountryOption[];
  hideZero: boolean;
  onToggleHideZero: () => void;
  total: number;
  checkedCount: number;
  deleting: boolean;
  onBatchDelete: () => void;
  exporting: boolean;
  onExport: () => void;
};

export function AllWinesToolbar(p: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16, width: 220 }}
          placeholder="품번/품명/영문명/국가 검색..."
          value={p.search}
          onChange={e => p.onSearchChange(e.target.value)}
        />
        <select
          style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff' }}
          value={p.country}
          onChange={e => p.onCountryChange(e.target.value)}
        >
          <option value="">전체 국가</option>
          {p.countries.map(c => (
            <option key={c.name} value={c.name}>{c.name} ({c.cnt})</option>
          ))}
        </select>
        <button
          onClick={p.onToggleHideZero}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: p.hideZero ? '1px solid var(--color-primary-light)' : '1px solid #d1d5db',
            background: p.hideZero ? 'var(--color-primary-light)' : '#fff',
            color: p.hideZero ? '#fff' : '#6b7280',
            transition: 'all 0.15s',
          }}
        >
          재고 있는 것만
        </button>
        <span style={{ fontSize: 13, color: '#6b7280' }}>총 {p.total}개</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={p.onBatchDelete}
          disabled={p.deleting || p.checkedCount === 0}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer',
            background: p.checkedCount === 0 ? '#e5e7eb' : 'var(--status-danger)', color: '#fff', fontWeight: 600,
            opacity: p.checkedCount === 0 ? 0.5 : 1,
          }}
        >
          {p.deleting ? '삭제 중...' : `선택 삭제 (${p.checkedCount})`}
        </button>
        <button
          disabled={p.exporting}
          onClick={p.onExport}
          style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #059669', fontSize: 12, fontWeight: 600,
            cursor: p.exporting ? 'wait' : 'pointer', background: '#ecfdf5', color: '#059669',
            opacity: p.exporting ? 0.6 : 1,
          }}
        >
          {p.exporting ? '...' : 'Excel'}
        </button>
      </div>
    </div>
  );
}
