'use client';

// 검색 결과 한 행 — "우리 N · 타매장 N · 본사 N · 입고 N" 시안 그대로.
// 색은 숫자에만: 초록=지금 팔 수 있음 · 주황=들어오는 중 · 회색=없음.
// 탭=상세 바텀시트, 꾹(0.5초)=테이스팅 노트 바로 열기.
import { useRef } from 'react';
import type { StoreKey, StoreStockRow } from '@/app/lib/store/types';

const fmt = (n: number) => n.toLocaleString('ko-KR');
const LONG_PRESS_MS = 500;

export function StockRow({ row, storeKey, onOpen, onLongPress, onAdd }: {
  row: StoreStockRow; storeKey: StoreKey; onOpen: () => void;
  onLongPress?: (() => void) | null; // 테이스팅 노트 (있는 품목만)
  onAdd?: () => void;                // 정산에 바로 담기 (POS 빠른 흐름)
}) {
  const mine = row.stores[storeKey] || 0;
  const others = row.store_total - mine;
  const soldOutEverywhere = mine <= 0 && others <= 0 && row.hq_available <= 0;

  // 롱프레스 — 발화 후의 클릭(손 뗄 때)은 무시, 10px 이상 움직이면 취소(스크롤 중)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    origin.current = null;
  };
  const start = (e: React.PointerEvent) => {
    fired.current = false;
    if (!onLongPress) return;
    origin.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      fired.current = true;
      try { navigator.vibrate?.(10); } catch { /* ignore */ }
      onLongPress();
    }, LONG_PRESS_MS);
  };
  const move = (e: React.PointerEvent) => {
    if (!origin.current) return;
    if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 10) cancel();
  };

  const cell = (label: string, n: number, kind: 'ok' | 'zero' | 'warn', extra?: string) => (
    <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--text-tertiary)' }}>
      {label}
      <b style={{
        marginLeft: 3, fontWeight: 700,
        color: kind === 'ok' ? 'var(--status-success)' : kind === 'warn' ? 'var(--status-warning)' : 'var(--neutral-400, #c2c4c9)',
      }}>{fmt(n)}</b>
      {extra && <span style={{ marginLeft: 2, fontSize: 10.5 }}>{extra}</span>}
    </span>
  );

  return (
    <button
      onClick={() => { if (fired.current) { fired.current = false; return; } onOpen(); }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onPointerMove={move}
      onContextMenu={(e) => { if (onLongPress) e.preventDefault(); }}
      style={{
        all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer',
        padding: '13px 2px', borderBottom: '1px solid var(--border-subtle)',
        // 롱프레스 시 iOS 텍스트 선택/콜아웃 억제
        WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
      } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: soldOutEverywhere ? 'var(--text-tertiary)' : 'var(--text-primary)',
        }}>
          {row.item_name}
        </span>
        {row.sale_price > 0 && (
          <span style={{ flex: 'none', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {row.discount_rate > 0 && (
              <span style={{ marginRight: 6, fontSize: 11.5, fontWeight: 400, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
                {fmt(row.retail_price)}
              </span>
            )}
            {fmt(row.sale_price)}
          </span>
        )}
        {onAdd && (
          <span role="button" aria-label="정산에 담기"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              flex: 'none', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-default)',
              fontSize: 17, lineHeight: 1, color: 'var(--text-primary)', cursor: 'pointer',
            }}>
            +
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {cell('우리', mine, mine > 0 ? 'ok' : 'zero')}
        {cell('타매장', others, others > 0 ? 'ok' : 'zero')}
        {cell('본사', row.hq_available, row.hq_available > 0 ? 'ok' : 'zero')}
        {(row.arrival_btls > 0 || row.incoming > 0) &&
          cell('입고', row.arrival_btls || row.incoming, 'warn',
            row.arrival_date ? `·${row.arrival_date.slice(5, 7)}/${row.arrival_date.slice(8, 10)}` : undefined)}
      </div>
    </button>
  );
}
