'use client';

import type { RefObject } from 'react';
import type { SearchItem, Warehouse } from '../types';
import { getQuickRanges } from '../lib/quickRanges';
import { ItemSearchInput } from './ItemSearchInput';

type Props = {
  warehouse: Warehouse;
  onWarehouseChange: (w: Warehouse) => void;
  searchRef: RefObject<HTMLDivElement | null>;
  itemSearch: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  selectedItem: SearchItem | null;
  suggestions: SearchItem[];
  showSuggestions: boolean;
  onSelectItem: (s: SearchItem) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  loading: boolean;
  onSearch: () => void;
  error: string;
};

export function FilterCard(p: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid rgba(90,21,21,0.06)',
      boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
      padding: 18, marginBottom: 16,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14 }}>
        품목별 판매현황
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          창고
        </label>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(90,21,21,0.04)', borderRadius: 8, padding: 2, width: 'fit-content' }}>
          {([['CDV', '까브드뱅 (와인)'], ['DL', '대유라이프 (글라스)']] as const).map(([w, label]) => (
            <button
              key={w}
              onClick={() => p.onWarehouseChange(w)}
              style={{
                padding: '8px 16px', borderRadius: 6, border: 'none',
                fontSize: 12, fontWeight: p.warehouse === w ? 700 : 500,
                background: p.warehouse === w ? '#fff' : 'transparent',
                color: p.warehouse === w ? '#5A1515' : '#8a8580',
                cursor: 'pointer', boxShadow: p.warehouse === w ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ItemSearchInput
        searchRef={p.searchRef}
        itemSearch={p.itemSearch}
        onSearchChange={p.onSearchChange}
        onFocus={p.onSearchFocus}
        selectedItem={p.selectedItem}
        suggestions={p.suggestions}
        showSuggestions={p.showSuggestions}
        onSelect={p.onSelectItem}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 130px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            시작일
          </label>
          <input
            type="date" value={p.startDate} onChange={e => p.setStartDate(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#faf9f7' }}
          />
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            종료일
          </label>
          <input
            type="date" value={p.endDate} onChange={e => p.setEndDate(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#faf9f7' }}
          />
        </div>
        <button
          onClick={p.onSearch} disabled={p.loading}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: p.loading ? '#c4a0a0' : '#5A1515', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: p.loading ? 'default' : 'pointer',
            whiteSpace: 'nowrap', transition: 'background 0.2s',
          }}
        >
          {p.loading ? '조회 중...' : '조회'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {getQuickRanges().map(r => (
          <button
            key={r.label}
            onClick={() => { p.setStartDate(r.start); p.setEndDate(r.end); }}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
              background: (p.startDate === r.start && p.endDate === r.end) ? 'rgba(90,21,21,0.06)' : 'transparent',
              fontSize: 11, color: '#5A1515', cursor: 'pointer', fontWeight: 500,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {p.error && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
          {p.error}
        </div>
      )}
    </div>
  );
}
