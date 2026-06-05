'use client';

import type { FilterOptions } from '../types';

type Props = {
  options: FilterOptions | null;
  availableRegions: string[];
  availableSubRegions: string[];
  startDate: string; endDate: string;
  country: string; region: string; subRegion: string;
  wineType: string; brand: string;
  onStartDate: (v: string) => void;
  onEndDate: (v: string) => void;
  onCountry: (v: string) => void;
  onRegion: (v: string) => void;
  onSubRegion: (v: string) => void;
  onWineType: (v: string) => void;
  onBrand: (v: string) => void;
  loading: boolean;
  onSearch: () => void;
  quickRanges: Array<{ label: string; start: string; end: string }>;
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid var(--border-default)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  background: 'var(--surface-muted)', color: 'var(--text-primary)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  display: 'block', marginBottom: 4,
};

export function FilterPanel(p: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid var(--action-muted)',
      boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
      padding: 18, marginBottom: 16,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>판매 분석</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
        <div style={{ flex: '1 1 130px' }}>
          <label style={labelStyle}>시작일</label>
          <input type="date" value={p.startDate} onChange={e => p.onStartDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label style={labelStyle}>종료일</label>
          <input type="date" value={p.endDate} onChange={e => p.onEndDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {p.quickRanges.map(r => (
          <button
            key={r.label}
            onClick={() => { p.onStartDate(r.start); p.onEndDate(r.end); }}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
              background: p.startDate === r.start && p.endDate === r.end ? 'var(--action-muted)' : 'transparent',
              fontSize: 11, color: 'var(--action)', cursor: 'pointer', fontWeight: 500,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={labelStyle}>국가</label>
          <select value={p.country} onChange={e => p.onCountry(e.target.value)} style={inputStyle}>
            <option value="">전체</option>
            {(p.options?.countries || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label style={labelStyle}>지역</label>
          <select
            value={p.region}
            onChange={e => p.onRegion(e.target.value)}
            disabled={!p.country || p.availableRegions.length === 0}
            style={{ ...inputStyle, color: p.country ? 'var(--text-primary)' : 'var(--gray-300)' }}
          >
            <option value="">전체</option>
            {p.availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label style={labelStyle}>세부 지역</label>
          <select
            value={p.subRegion}
            onChange={e => p.onSubRegion(e.target.value)}
            disabled={!p.region || p.availableSubRegions.length === 0}
            style={{ ...inputStyle, color: p.region && p.availableSubRegions.length > 0 ? 'var(--text-primary)' : 'var(--gray-300)' }}
          >
            <option value="">전체</option>
            {p.availableSubRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>타입</label>
          <select value={p.wineType} onChange={e => p.onWineType(e.target.value)} style={inputStyle}>
            <option value="">전체</option>
            {(p.options?.types || []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>브랜드</label>
          <select value={p.brand} onChange={e => p.onBrand(e.target.value)} style={inputStyle}>
            <option value="">전체</option>
            {(p.options?.brands || []).map(b => (
              <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={p.onSearch}
        disabled={p.loading}
        style={{
          padding: '10px 28px', borderRadius: 10, border: 'none',
          background: p.loading ? '#c4a0a0' : 'var(--action)', color: '#fff',
          fontSize: 14, fontWeight: 600,
          cursor: p.loading ? 'default' : 'pointer',
        }}
      >
        {p.loading ? '분석 중...' : '조회'}
      </button>
    </div>
  );
}
