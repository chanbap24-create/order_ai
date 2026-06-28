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
  minStock: { u20k: number; u50k: number; u100k: number; u200k: number; over: number };
  onMinStockChange: (key: 'u20k' | 'u50k' | 'u100k' | 'u200k' | 'over', v: number) => void;
  onSaveMinStock: () => void;
  savingPref: boolean;
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
          style={{ padding: '7px 12px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 16, width: 220 }}
          placeholder="품번/품명/영문명/국가 검색..."
          value={p.search}
          onChange={e => p.onSearchChange(e.target.value)}
        />
        <select
          style={{ padding: '7px 10px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 13, background: '#fff' }}
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
            border: p.hideZero ? '1px solid var(--color-primary-light)' : '1px solid var(--gray-300)',
            background: p.hideZero ? 'var(--color-primary-light)' : '#fff',
            color: p.hideZero ? '#fff' : 'var(--gray-500)',
            transition: 'all 0.15s',
          }}
        >
          재고 있는 것만
        </button>
        {/* 가격대(공급가)별 최소 가용재고 — 미만이면 숨김(0=무필터) */}
        <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 4 }}>가격대별 최소재고</span>
        {([['u20k', '~2만'], ['u50k', '~5만'], ['u100k', '~10만'], ['u200k', '~20만'], ['over', '20만+']] as const).map(([k, label]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--gray-500)' }}>
            {label}
            <input
              type="number" min={0} placeholder="0"
              value={p.minStock[k] || ''}
              onChange={e => p.onMinStockChange(k, Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{ width: 46, padding: '5px 6px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
            />
          </label>
        ))}
        <button
          onClick={p.onSaveMinStock}
          disabled={p.savingPref}
          title="현재 가격대별 최소재고 설정을 계정에 저장"
          style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: p.savingPref ? 'wait' : 'pointer',
            border: '1px solid var(--color-primary-light)', background: '#fff', color: 'var(--color-primary-light)',
          }}
        >
          {p.savingPref ? '저장 중...' : '설정 저장'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>총 {p.total}개</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={p.onBatchDelete}
          disabled={p.deleting || p.checkedCount === 0}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer',
            background: p.checkedCount === 0 ? 'var(--gray-200)' : 'var(--status-danger)', color: '#fff', fontWeight: 600,
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
