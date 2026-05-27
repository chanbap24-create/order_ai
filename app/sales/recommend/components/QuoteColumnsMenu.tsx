'use client';

import { QUOTE_COL_OPTIONS } from '../constants';

type Props = {
  quoteCols: string[];
  toggle: (key: string) => void;
  reset: () => void;
  onClose: () => void;
};

export function QuoteColumnsMenu({ quoteCols, toggle, reset, onClose }: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 44, right: 0, background: '#fff',
      border: '1px solid #e0e0e0', borderRadius: 10, padding: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300,
      width: 220, maxHeight: 320, overflowY: 'auto',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--action)', marginBottom: 8 }}>견적서 컬럼</div>
      {QUOTE_COL_OPTIONS.map(col => (
        <label key={col.key} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
          fontSize: 13, cursor: 'pointer', color: '#333',
        }}>
          <input
            type="checkbox"
            checked={quoteCols.includes(col.key)}
            onChange={() => toggle(col.key)}
            style={{ width: 14, height: 14 }}
          />
          {col.label}
        </label>
      ))}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button
          onClick={reset}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #ddd',
            background: '#fff', fontSize: 11, cursor: 'pointer', color: '#666',
          }}
        >
          초기화
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
            background: 'var(--action)', color: '#fff', fontSize: 11, cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
