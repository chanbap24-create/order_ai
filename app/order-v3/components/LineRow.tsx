'use client';

// 발주 라인 행 — 접힘: 한 줄 요약 / 펼침: 수량·후보·직접검색·할인.
// 모바일 안전: 모든 flex 자식에 minWidth:0, 긴 품명은 말줄임, 숫자 tabular.
import type { CSSProperties, RefObject } from 'react';
import type { SearchResult } from '@/app/order-v2/types';
import type { V3Line } from '../hooks/useOrderV3Page';

const fmt = (n: number) => n.toLocaleString('ko-KR');
const DISCOUNTS = [0, 5, 10, 15, 20, 30, 40, 50];

export function LineRow({
  line, unit = '병', expanded, historySet, discount,
  isSearching, searchQuery, setSearchQuery, searchResults, searchLoading, searchRef, onOpenSearch,
  onToggle, onQty, onRemove, onSelect, onPickSearch, onDiscount,
}: {
  line: V3Line; unit?: string; expanded: boolean;
  historySet: Set<string>; discount: number;
  isSearching: boolean; searchQuery: string; setSearchQuery: (v: string) => void;
  searchResults: SearchResult[]; searchLoading: boolean;
  searchRef: RefObject<HTMLDivElement | null>;
  onOpenSearch: () => void;
  onToggle: () => void;
  onQty: (qty: number) => void;
  onRemove: () => void;
  onSelect: (cIdx: number) => void;
  onPickSearch: (w: SearchResult) => void;
  onDiscount: (rate: number) => void;
}) {
  const sel = line.selectedIdx >= 0 ? line.candidates[line.selectedIdx] : undefined;
  const unresolved = !sel;
  const v3 = line.v3;
  const searching = isSearching;
  const soldOut = !!sel && v3 && v3.picked_stock <= 0 && line.selectedIdx === 0 && (v3.reason || '').includes('품절');

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {/* 접힌 요약 — "원문 → 결과" 독해 순서. 탭 전체가 토글 */}
      <button onClick={onToggle}
        style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', padding: '12px 2px' }}>
        {/* 1줄: 원문 (손님이 보낸 그대로) + 수량 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {line.query}
          </span>
          <span style={{ flex: 'none', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {line.quantity}{unit}
          </span>
          <span style={{ flex: 'none', fontSize: 12, color: 'var(--text-tertiary)' }}>{expanded ? '▴' : '▾'}</span>
        </div>
        {/* 2줄: → 결과 (주인공) */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 4, minWidth: 0 }}>
          <span style={{ flex: 'none', fontSize: 13, color: unresolved ? 'var(--status-warning)' : 'var(--text-tertiary)' }}>→</span>
          <span style={{
            minWidth: 0, fontSize: 14.5, fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: unresolved ? 'var(--status-warning)' : 'var(--text-primary)',
          }}>
            {sel ? sel.item_name : '미확정 — 아래에서 선택하세요'}
          </span>
        </div>
        {/* 3줄: 품번·가격·뱃지 */}
        {(sel || discount > 0) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3, marginLeft: 18, minWidth: 0, flexWrap: 'wrap' }}>
            {sel && (
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                {sel.item_no}{sel.supply_price > 0 ? ` · ${fmt(sel.supply_price)}원` : ''}
              </span>
            )}
            {sel && v3?.picked_in_history && line.selectedIdx === 0 && (
              <span style={{ fontSize: 11, color: 'var(--status-info)', flex: 'none' }}>이력</span>
            )}
            {soldOut && <span style={{ fontSize: 11, color: 'var(--status-danger)', flex: 'none' }}>품절</span>}
            {v3?.reason?.includes('신빈티지') && line.selectedIdx === 0 && (
              <span style={{ fontSize: 11, color: 'var(--status-warning)', flex: 'none' }}>신빈티지 대체</span>
            )}
            {discount > 0 && (
              <span style={{ fontSize: 11, color: discount === 100 ? 'var(--promo, #7c3aed)' : 'var(--status-danger)', flex: 'none' }}>
                {discount === 100 ? '시음주' : `${discount}%↓`}
              </span>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '2px 2px 14px' }}>
          {/* 수량 + 삭제 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => onQty(line.quantity - 1)} style={qtyBtn} aria-label="수량 감소">−</button>
              <input
                value={line.quantity} inputMode="numeric"
                onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) onQty(n); }}
                style={{ width: 52, textAlign: 'center', fontSize: 16, fontWeight: 700, border: 'none', outline: 'none', padding: '9px 0', fontVariantNumeric: 'tabular-nums', background: 'var(--surface)' }}
              />
              <button onClick={() => onQty(line.quantity + 1)} style={qtyBtn} aria-label="수량 증가">＋</button>
            </div>
            <select
              value={DISCOUNTS.includes(discount) ? String(discount) : discount === 100 ? '100' : 'custom'}
              onChange={(e) => onDiscount(e.target.value === '100' ? 100 : Number(e.target.value) || 0)}
              style={{ padding: '9px 10px', fontSize: 13, borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--surface)' }}>
              {DISCOUNTS.map((d) => <option key={d} value={d}>{d === 0 ? '할인 없음' : `${d}%`}</option>)}
              <option value="100">시음주</option>
            </select>
            <button onClick={onRemove}
              style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-tertiary)', padding: '6px 4px' }}>
              행 삭제
            </button>
          </div>

          {/* 후보 */}
          {line.candidates.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>후보 선택</div>
              {line.candidates.map((c, cIdx) => {
                const active = line.selectedIdx === cIdx;
                const hasHistory = historySet.has(c.item_no.trim().toUpperCase());
                return (
                  <button key={`${c.item_no}-${cIdx}`} onClick={() => onSelect(cIdx)}
                    style={{
                      all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'baseline', gap: 7,
                      width: '100%', padding: '8px 2px', cursor: 'pointer', minWidth: 0,
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                    <i style={{
                      flex: 'none', width: 7, height: 7, borderRadius: '50%',
                      background: active ? 'var(--action)' : 'transparent',
                      border: `1.5px solid ${active ? 'var(--action)' : 'var(--border-default)'}`,
                      transform: 'translateY(-1px)',
                    }} />
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.item_name}
                    </span>
                    <span style={{ marginLeft: 'auto', flex: 'none', fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {hasHistory ? '이력 · ' : ''}{c.available_stock > 0 ? `재고 ${c.available_stock}` : '재고 0'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 직접 검색 */}
          <div ref={searching ? searchRef : undefined} style={{ marginTop: 10 }}>
            {!searching ? (
              <button onClick={onOpenSearch}
                style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, color: 'var(--action)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                직접 검색하여 변경
              </button>
            ) : (
              <div>
                <input
                  autoFocus value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="와인 이름·품번 검색"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', fontSize: 16, border: '1px solid var(--border-default)', borderRadius: 10, outline: 'none', background: 'var(--surface)' }}
                />
                {searchLoading && <div style={{ padding: '8px 2px', fontSize: 12, color: 'var(--text-muted)' }}>검색 중…</div>}
                {searchResults.map((w) => (
                  <button key={w.item_no} onClick={() => onPickSearch(w)}
                    style={{
                      all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'baseline', gap: 8,
                      width: '100%', padding: '9px 2px', cursor: 'pointer', minWidth: 0,
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                    <span style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.item_name}</span>
                    <span style={{ marginLeft: 'auto', flex: 'none', fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      재고 {w.available_stock ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const qtyBtn: CSSProperties = {
  width: 40, height: 40, border: 'none', background: 'var(--surface)', fontSize: 18,
  cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
