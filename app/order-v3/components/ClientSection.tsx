'use client';

// 거래처 선택 — 검색 + 드롭다운 + 선택 배지 + 입고내역(접이식, 탭하면 라인 추가)
import type { CSSProperties, RefObject } from 'react';
import type { Client, HistoryItem } from '@/app/order-v2/types';

type ClientProps = {
  query: string; setQuery: (v: string) => void;
  results: Client[]; selected: Client | null; setSelected: (c: Client | null) => void;
  showDropdown: boolean; setShowDropdown: (v: boolean) => void;
  pick: (c: Client) => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
};
type HistoryProps = {
  historyItems: HistoryItem[]; historyLoading: boolean; historyShow: boolean; historyToggle: () => void;
};

const input16: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 16,
  border: '1px solid var(--border-default)', borderRadius: 10, background: 'var(--surface)', outline: 'none',
};

export function ClientSection({
  query, setQuery, results, selected, setSelected, showDropdown, setShowDropdown, pick, dropdownRef,
  historyItems, historyLoading, historyShow, historyToggle, onPickHistoryItem,
}: ClientProps & HistoryProps & { onPickHistoryItem: (item: HistoryItem) => void }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        {selected ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
            border: '1px solid var(--action)', borderRadius: 10, minWidth: 0,
          }}>
            <i style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.client_name}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
              {selected.client_code}
            </span>
            <button onClick={() => { setSelected(null); setQuery(''); }} aria-label="거래처 해제"
              style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 15, padding: '0 4px', flex: 'none' }}>
              ✕
            </button>
          </div>
        ) : (
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="거래처 검색 (이름·코드)"
            style={input16}
          />
        )}
        {showDropdown && !selected && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4,
            background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
          }}>
            {results.map((c) => (
              <button key={c.client_code} onClick={() => pick(c)}
                style={{
                  all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'baseline', gap: 8,
                  width: '100%', padding: '11px 14px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-subtle)', minWidth: 0,
                }}>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.client_name}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{c.client_code}</span>
                {c.matched_alias && <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 'none' }}>{c.matched_alias}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div style={{ marginTop: 8 }}>
          <button onClick={historyToggle}
            style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-tertiary)', padding: '4px 2px' }}>
            {historyShow ? '입고내역 접기 ▴' : `입고내역 보기 ▾${historyItems.length ? ` (${historyItems.length})` : ''}`}
          </button>
          {historyShow && (
            <div style={{ borderTop: '1px solid var(--border-default)', marginTop: 4, maxHeight: 260, overflowY: 'auto' }}>
              {historyLoading && <div style={{ padding: '12px 2px', fontSize: 12.5, color: 'var(--text-muted)' }}>불러오는 중…</div>}
              {!historyLoading && historyItems.slice(0, 60).map((it) => (
                <button key={it.item_no} onClick={() => onPickHistoryItem(it)}
                  title="탭하면 발주 라인으로 추가"
                  style={{
                    all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'baseline', gap: 8,
                    width: '100%', padding: '9px 2px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)', minWidth: 0,
                  }}>
                  <span style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.item_name}
                  </span>
                  <span style={{ marginLeft: 'auto', flex: 'none', fontSize: 11.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {it.buy_count}회 · {it.last_ship_date?.slice(5, 10) || ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
