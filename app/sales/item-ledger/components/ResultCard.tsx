'use client';

import type { ClientSummary, ItemRow, SearchItem, Totals, ViewMode } from '../types';
import { fmt } from '../lib/format';
import { DateView } from './DateView';
import { ClientView } from './ClientView';

type Props = {
  itemName: string;
  selectedItem: SearchItem | null;
  totals: Totals;
  rows: ItemRow[];
  clientSummary: ClientSummary[];
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
};

export function ResultCard(p: Props) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.01em',
            }}
          >
            {p.itemName}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {p.selectedItem?.item_no}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {p.totals.clients}개 거래처 · {p.rows.length}건
          </span>
        </div>

        <ViewModeToggle viewMode={p.viewMode} onChange={p.onViewModeChange} />
      </header>

      {/* 통합 stat row */}
      <div
        style={{
          display: 'flex',
          padding: '12px 16px',
          gap: 24,
          background: 'var(--surface-muted)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <Stat label="총 수량" value={fmt(p.totals.qty)} />
        <Divider />
        <Stat label="총 금액" value={fmt(p.totals.supply)} unit="원" accent />
        <Divider />
        <Stat label="거래처" value={String(p.totals.clients)} unit="개" />
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {p.viewMode === 'date' ? (
          <DateView rows={p.rows} />
        ) : (
          <ClientView summary={p.clientSummary} />
        )}
      </div>
    </div>
  );
}

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const options: { value: ViewMode; label: string }[] = [
    { value: 'date', label: '날짜별' },
    { value: 'client', label: '거래처별' },
  ];
  return (
    <div style={{ display: 'flex', height: 28 }}>
      {options.map((o, idx) => {
        const isActive = viewMode === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              minWidth: 60,
              padding: '0 12px',
              border: '1px solid var(--border-default)',
              background: isActive ? 'var(--action)' : 'var(--surface)',
              color: isActive ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: idx === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
              borderLeftWidth: idx === 0 ? 1 : 0,
              letterSpacing: '0.02em',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 3,
          fontSize: accent ? 18 : 15,
          fontWeight: 700,
          color: accent ? 'var(--action)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
            }}
          >
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 28,
        background: 'var(--border-default)',
        flexShrink: 0,
        alignSelf: 'center',
      }}
    />
  );
}
