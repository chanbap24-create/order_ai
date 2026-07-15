'use client';

import { QUOTE_COL_OPTIONS } from '../constants';

type Props = {
  quoteCols: string[];
  toggle: (key: string) => void;
  move?: (key: string, dir: -1 | 1) => void; // 순서 이동(배열 순서 = 엑셀 열 순서)
  reset: () => void;
  onClose: () => void;
};

const LABEL: Record<string, string> = Object.fromEntries(QUOTE_COL_OPTIONS.map((c) => [c.key, c.label]));
const arrowBtn: React.CSSProperties = {
  width: 20, height: 20, padding: 0, border: '1px solid var(--gray-300)', borderRadius: 5,
  background: '#fff', color: 'var(--text-tertiary)', fontSize: 10, cursor: 'pointer', lineHeight: 1,
};

export function QuoteColumnsMenu({ quoteCols, toggle, move, reset, onClose }: Props) {
  const checked = quoteCols.filter((k) => LABEL[k]); // 저장된 순서 그대로 (= 엑셀 열 순서)
  const unchecked = QUOTE_COL_OPTIONS.filter((c) => !quoteCols.includes(c.key));
  return (
    <div style={{
      position: 'absolute', bottom: 44, right: 0, background: '#fff',
      border: '1px solid var(--border-default)', borderRadius: 12, padding: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300,
      width: 220, maxHeight: 320, overflowY: 'auto',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--action)', marginBottom: 2 }}>견적서 컬럼</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8 }}>위→아래 순서 = 엑셀 왼→오른쪽</div>
      {checked.map((key, i) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 13, color: 'var(--neutral-700)' }}>
          <input type="checkbox" checked onChange={() => toggle(key)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
          <span style={{ flex: 1 }}>{LABEL[key]}</span>
          {move && (
            <>
              <button onClick={() => move(key, -1)} disabled={i === 0} style={{ ...arrowBtn, opacity: i === 0 ? 0.3 : 1 }} title="위로">▲</button>
              <button onClick={() => move(key, 1)} disabled={i === checked.length - 1} style={{ ...arrowBtn, opacity: i === checked.length - 1 ? 0.3 : 1 }} title="아래로">▼</button>
            </>
          )}
        </div>
      ))}
      {unchecked.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-default)', marginTop: 6, paddingTop: 6 }}>
          {unchecked.map((col) => (
            <label key={col.key} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
              fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)',
            }}>
              <input type="checkbox" checked={false} onChange={() => toggle(col.key)} style={{ width: 14, height: 14 }} />
              {col.label}
            </label>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button
          onClick={reset}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid var(--gray-300)',
            background: '#fff', fontSize: 11, cursor: 'pointer', color: 'var(--neutral-400)',
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
