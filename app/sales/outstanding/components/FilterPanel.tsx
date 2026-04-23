'use client';

import type { OutstandingType } from '../types';
import { cardStyle } from '../lib/format';

type Props = {
  startDate: string;
  endDate: string;
  type: OutstandingType;
  loading: boolean;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onTypeChange: (t: OutstandingType) => void;
  onSearch: () => void;
};

export function FilterPanel(p: Props) {
  const dateInput: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8,
    border: '1.5px solid rgba(90,21,21,0.08)',
    fontSize: 16, outline: 'none', background: '#faf9f7',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580' }}>시작일</label>
          <input type="date" value={p.startDate} onChange={e => p.onStartDateChange(e.target.value)} style={dateInput} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580' }}>종료일</label>
          <input type="date" value={p.endDate} onChange={e => p.onEndDateChange(e.target.value)} style={dateInput} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['wine', 'glass'] as const).map(t => (
            <button
              key={t}
              onClick={() => p.onTypeChange(t)}
              style={{
                padding: '7px 16px', borderRadius: 8,
                border: p.type === t ? '1.5px solid #5A1515' : '1.5px solid rgba(90,21,21,0.08)',
                background: p.type === t ? 'rgba(90,21,21,0.06)' : 'transparent',
                color: p.type === t ? '#5A1515' : '#8a8580',
                fontSize: 13, fontWeight: p.type === t ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {t === 'wine' ? 'Wine' : 'Glass'}
            </button>
          ))}
        </div>
        <button
          onClick={p.onSearch}
          disabled={p.loading}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: p.loading ? '#c4a0a0' : '#5A1515',
            color: 'white', fontSize: 13, fontWeight: 600,
            cursor: p.loading ? 'default' : 'pointer',
          }}
        >
          {p.loading ? '조회 중...' : '조회'}
        </button>
      </div>
    </div>
  );
}
