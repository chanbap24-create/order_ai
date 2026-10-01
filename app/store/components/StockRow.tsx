'use client';

// 검색 결과 한 행 — "우리 N · 타매장 N · 본사 N · 입고 N" 시안 그대로.
// 색은 숫자에만: 초록=지금 팔 수 있음 · 주황=들어오는 중 · 회색=없음.
import type { StoreKey, StoreStockRow } from '@/app/lib/store/stockView';

const fmt = (n: number) => n.toLocaleString('ko-KR');

export function StockRow({ row, storeKey, onOpen }: {
  row: StoreStockRow; storeKey: StoreKey; onOpen: () => void;
}) {
  const mine = row.stores[storeKey] || 0;
  const others = row.store_total - mine;
  const soldOutEverywhere = mine <= 0 && others <= 0 && row.hq_available <= 0;

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
    <button onClick={onOpen}
      style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', padding: '13px 2px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: soldOutEverywhere ? 'var(--text-tertiary)' : 'var(--text-primary)',
        }}>
          {row.item_name}
        </span>
        {row.sale_price > 0 && (
          <span style={{ flex: 'none', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(row.sale_price)}
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
