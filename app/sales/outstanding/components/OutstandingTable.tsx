'use client';

import { memo, useMemo, useState } from 'react';
import type { OutstandingClient, OutstandingTotals } from '../types';
import { Section } from '@/app/components/ui';
import { fmt, tdCenter, tdRight, tdStyle, tfRight, thStyle } from '../lib/format';

type Props = {
  clients: OutstandingClient[];
  totals: OutstandingTotals;
  checked: Set<string>;
  allChecked: boolean;
  onToggleAll: () => void;
  onToggleOne: (code: string) => void;
  onOpenLedger: (code: string, name: string) => void;
};

type SortKey =
  | 'client_name'
  | 'prev_balance'
  | 'period_supply'
  | 'period_tax'
  | 'period_total'
  | 'period_payment'
  | 'outstanding';
type SortDir = 'asc' | 'desc';
type SortState = { key: SortKey; dir: SortDir } | null;

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'client_name', label: '거래처명', align: 'left' },
  { key: 'prev_balance', label: '전월미수', align: 'right' },
  { key: 'period_supply', label: '판매', align: 'right' },
  { key: 'period_tax', label: '부가세', align: 'right' },
  { key: 'period_total', label: '판매계', align: 'right' },
  { key: 'period_payment', label: '입금', align: 'right' },
  { key: 'outstanding', label: '현미수', align: 'right' },
];

export const OutstandingTable = memo(function OutstandingTable({
  clients,
  totals,
  checked,
  allChecked,
  onToggleAll,
  onToggleOne,
  onOpenLedger,
}: Props) {
  const [sort, setSort] = useState<SortState>(null);

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const sortedClients = useMemo(() => {
    if (!sort) return clients;
    const arr = [...clients];
    const { key, dir } = sort;
    const factor = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv, 'ko') * factor;
      }
      return (((av as number) || 0) - ((bv as number) || 0)) * factor;
    });
    return arr;
  }, [clients, sort]);

  return (
    <Section
      title="거래처별 미수현황"
      meta={`${clients.length}개`}
      padding="none"
    >
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            minWidth: 780,
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'center', width: 40 }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                  style={{
                    width: 14,
                    height: 14,
                    accentColor: 'var(--action)',
                    cursor: 'pointer',
                    margin: 0,
                  }}
                />
              </th>
              {COLUMNS.map((col) => (
                <SortableHeader
                  key={col.key}
                  label={col.label}
                  align={col.align}
                  active={sort?.key === col.key}
                  dir={sort?.key === col.key ? sort.dir : null}
                  onClick={() => handleSort(col.key)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedClients.map((c) => {
              const isChecked = checked.has(c.client_code);
              return (
                <tr
                  key={c.client_code}
                  onClick={() => onToggleOne(c.client_code)}
                  style={{
                    background: isChecked ? 'var(--surface-active)' : 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isChecked) {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        'var(--surface-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = isChecked
                      ? 'var(--surface-active)'
                      : 'var(--surface)';
                  }}
                >
                  <td style={tdCenter}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleOne(c.client_code)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 14,
                        height: 14,
                        accentColor: 'var(--action)',
                        cursor: 'pointer',
                        margin: 0,
                      }}
                    />
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span
                      onClick={(e) => { e.stopPropagation(); onOpenLedger(c.client_code, c.client_name); }}
                      title="원장 보기"
                      style={{
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        textUnderlineOffset: 3,
                        textDecorationColor: 'var(--border-strong)',
                      }}
                    >
                      {c.client_name}
                    </span>
                  </td>
                  <td style={tdRight}>{fmt(c.prev_balance)}</td>
                  <td style={tdRight}>{fmt(c.period_supply)}</td>
                  <td style={{ ...tdRight, color: 'var(--text-tertiary)' }}>
                    {fmt(c.period_tax)}
                  </td>
                  <td style={{ ...tdRight, fontWeight: 600 }}>{fmt(c.period_total)}</td>
                  <td style={{ ...tdRight, color: 'var(--text-tertiary)' }}>
                    {fmt(c.period_payment)}
                  </td>
                  <td
                    style={{
                      ...tdRight,
                      fontWeight: 700,
                      color:
                        c.outstanding > 0
                          ? 'var(--status-danger)'
                          : c.outstanding < 0
                            ? 'var(--status-info)'
                            : 'var(--text-primary)',
                    }}
                  >
                    {fmt(c.outstanding)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                style={{
                  ...tfRight,
                  textAlign: 'left',
                  paddingLeft: 12,
                }}
                colSpan={2}
              >
                합계 {clients.length}개
              </td>
              <td style={tfRight}>{fmt(totals.prev_balance)}</td>
              <td style={tfRight}>{fmt(totals.period_supply)}</td>
              <td style={tfRight}>{fmt(totals.period_tax)}</td>
              <td style={tfRight}>{fmt(totals.period_total)}</td>
              <td style={tfRight}>{fmt(totals.period_payment)}</td>
              <td
                style={{
                  ...tfRight,
                  color: totals.outstanding > 0 ? 'var(--status-danger)' : 'var(--text-primary)',
                }}
              >
                {fmt(totals.outstanding)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Section>
  );
});

function SortableHeader({
  label,
  align,
  active,
  dir,
  onClick,
}: {
  label: string;
  align: 'left' | 'right';
  active: boolean;
  dir: SortDir | null;
  onClick: () => void;
}) {
  return (
    <th
      style={{
        ...thStyle,
        textAlign: align,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={onClick}
      title="클릭하여 정렬"
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: active ? 'var(--action)' : 'var(--text-tertiary)',
        }}
      >
        {label}
        <span
          style={{
            fontSize: 9,
            opacity: active ? 1 : 0.3,
            width: 8,
          }}
        >
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );
}
