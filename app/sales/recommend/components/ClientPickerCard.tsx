'use client';

import type { RefObject } from 'react';
import type { ClientOption } from '../types';
import { IMPORTANCE_LABELS } from '../constants';

type Props = {
  isAdmin: boolean;
  managers: string[];
  filterManager: string;
  onFilterManagerChange: (v: string) => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  clientSearch: string;
  onSearchChange: (v: string) => void;
  onFocus: () => void;
  selectedClient: ClientOption | null;
  onClear: () => void;
  showDropdown: boolean;
  clientOptions: ClientOption[];
  clientLoading: boolean;
  onSelect: (c: ClientOption) => void;
  loading: boolean;
  onGenerate: () => void;
};

export function ClientPickerCard(p: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 16px',
      marginBottom: 16, boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
      border: '1px solid rgba(90,21,21,0.06)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
        거래처 선택
      </div>

      {p.isAdmin && p.managers.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <select
            value={p.filterManager}
            onChange={e => p.onFilterManagerChange(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: '1.5px solid rgba(90,21,21,0.08)',
              fontSize: 16, background: '#fff', color: p.filterManager ? 'var(--text-primary)' : '#999',
              outline: 'none', width: '100%', boxSizing: 'border-box',
            }}
          >
            <option value="">담당자 선택</option>
            {p.managers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      <div ref={p.dropdownRef} style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="거래처명 또는 코드로 검색..."
          value={p.clientSearch}
          onChange={e => p.onSearchChange(e.target.value)}
          onFocus={p.onFocus}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
            boxSizing: 'border-box', background: p.selectedClient ? 'var(--surface-muted)' : '#fff',
          }}
        />
        {p.selectedClient && (
          <div style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: IMPORTANCE_LABELS[p.selectedClient.importance || 3]?.color || '#6c757d',
              color: '#fff',
            }}>
              {IMPORTANCE_LABELS[p.selectedClient.importance || 3]?.label || '일반'}
            </span>
            <button
              onClick={p.onClear}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', padding: 0 }}
            >
              ×
            </button>
          </div>
        )}
        {p.showDropdown && p.clientOptions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#fff', border: '1.5px solid rgba(90,21,21,0.08)',
            borderRadius: '0 0 8px 8px', maxHeight: 240, overflowY: 'auto',
            zIndex: 100, boxShadow: '0 4px 12px rgba(90,21,21,0.08)',
          }}>
            {p.clientOptions.map(c => (
              <div
                key={c.client_code}
                onClick={() => p.onSelect(c)}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(90,21,21,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{c.client_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {c.client_code}{c.manager && ` · ${c.manager}`}{c.business_type && ` · ${c.business_type}`}
                  </div>
                </div>
                {c.importance && (
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 8,
                    background: IMPORTANCE_LABELS[c.importance]?.color || '#6c757d',
                    color: '#fff',
                  }}>
                    {IMPORTANCE_LABELS[c.importance]?.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {p.showDropdown && p.clientSearch && p.clientOptions.length === 0 && !p.clientLoading && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#fff', border: '1.5px solid rgba(90,21,21,0.08)',
            borderRadius: '0 0 8px 8px', padding: '16px', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 13, zIndex: 100,
          }}>
            검색 결과가 없습니다
          </div>
        )}
      </div>

      {p.selectedClient && (
        <button
          onClick={p.onGenerate}
          disabled={p.loading}
          style={{
            width: '100%', marginTop: 12, padding: '12px', borderRadius: 8, border: 'none',
            background: p.loading ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: p.loading ? 'default' : 'pointer',
          }}
        >
          {p.loading ? '분석 중...' : `${p.selectedClient.client_name} AI 추천 생성`}
        </button>
      )}
    </div>
  );
}
