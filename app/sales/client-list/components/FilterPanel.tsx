'use client';

import type { CSSProperties } from 'react';
import type { ListType } from '../types';

const selectStyle: CSSProperties = {
  padding: '8px 12px', borderRadius: 8,
  border: '1.5px solid rgba(90,21,21,0.08)',
  fontSize: 13, background: '#faf9f7', color: '#2c1810',
  outline: 'none', cursor: 'pointer', minWidth: 0,
};

const dateStyle: CSSProperties = {
  padding: '8px 10px', borderRadius: 8,
  border: '1.5px solid rgba(90,21,21,0.08)',
  fontSize: 13, background: '#faf9f7', color: '#2c1810',
  outline: 'none', minWidth: 0, flex: '1 1 120px',
};

type Props = {
  isAdmin: boolean;
  managerList: string[];
  managerFilter: string;
  onManagerChange: (v: string) => void;
  type: ListType;
  onTypeChange: (t: ListType) => void;
  preset: string;
  onPresetChange: (v: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  businessType: string;
  onBusinessTypeChange: (v: string) => void;
  businessTypes: string[];
};

export function FilterPanel(p: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid rgba(90,21,21,0.06)',
      boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
      padding: '16px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'inline-flex', background: 'rgba(90,21,21,0.04)', borderRadius: 8, padding: 2 }}>
          {(['wine', 'glass'] as const).map(t => (
            <button
              key={t}
              onClick={() => p.onTypeChange(t)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none',
                fontSize: 12, fontWeight: p.type === t ? 700 : 500,
                background: p.type === t ? '#fff' : 'transparent',
                color: p.type === t ? '#5A1515' : '#8a8580',
                cursor: 'pointer',
                boxShadow: p.type === t ? '0 1px 3px rgba(90,21,21,0.08)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {t === 'wine' ? 'Wine' : 'Glass'}
            </button>
          ))}
        </div>

        {p.isAdmin && p.managerList.length > 0 && (
          <select value={p.managerFilter} onChange={e => p.onManagerChange(e.target.value)} style={selectStyle}>
            {p.managerList.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={p.preset} onChange={e => p.onPresetChange(e.target.value)} style={selectStyle}>
          <option value="thisMonth">이번 달</option>
          <option value="lastMonth">지난 달</option>
          <option value="last3Months">최근 3개월</option>
          <option value="thisYear">올해</option>
          <option value="lastYear">작년</option>
          <option value="custom">직접 입력</option>
        </select>

        {p.preset === 'custom' && (
          <>
            <input type="date" value={p.startDate} onChange={e => p.onStartDateChange(e.target.value)} style={dateStyle} />
            <span style={{ color: '#8a8580', fontSize: 13 }}>~</span>
            <input type="date" value={p.endDate} onChange={e => p.onEndDateChange(e.target.value)} style={dateStyle} />
          </>
        )}

        <select
          value={p.businessType}
          onChange={e => p.onBusinessTypeChange(e.target.value)}
          style={{ ...selectStyle, flex: '0 1 auto' }}
        >
          <option value="">전체 업종</option>
          {p.businessTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
        </select>
      </div>
    </div>
  );
}
