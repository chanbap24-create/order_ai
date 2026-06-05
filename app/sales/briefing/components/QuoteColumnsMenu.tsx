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
      position: 'absolute', bottom: 40, left: 0, background: '#fff',
      border: '1px solid var(--gray-200)', borderRadius: 10, padding: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300,
      width: 220, maxHeight: 280, overflowY: 'auto',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--action)', marginBottom: 6 }}>견적서 컬럼</div>
      {QUOTE_COL_OPTIONS.map(col => (
        <label key={col.key} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
          fontSize: 12, cursor: 'pointer', color: 'var(--neutral-700)',
        }}>
          <input
            type="checkbox"
            checked={quoteCols.includes(col.key)}
            onChange={() => toggle(col.key)}
            style={{ width: 13, height: 13 }}
          />
          {col.label}
        </label>
      ))}
      <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
        <button
          onClick={reset}
          style={{
            flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid var(--gray-300)',
            background: '#fff', fontSize: 10, cursor: 'pointer', color: 'var(--neutral-400)',
          }}
        >
          초기화
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '4px 0', borderRadius: 6, border: 'none',
            background: 'var(--action)', color: '#fff', fontSize: 10, cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
