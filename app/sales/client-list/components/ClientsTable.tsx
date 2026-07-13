'use client';

import type { ClientRow, SortKey } from '../types';
import { VENUE_MAP } from '@/app/lib/venueTypes';
import { fmt, fmtDate } from '../lib/format';
import { Section } from '@/app/components/ui';
import { tdStyle, tdRight, tdMuted, tableStyle } from '@/app/styles/table';
import { thStyle } from '@/app/styles/table';

type Props = {
  clients: ClientRow[];
  /** 발주 리듬 끊긴 거래처(견적 생성 시 윈백가 자동 적용) — 거래처명 옆 도트+텍스트 표기 */
  winbackMap?: Record<string, 'dormant' | 'risk'>;
  loading: boolean;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  sortIcon: (k: SortKey) => string;
  onRowClick?: (c: ClientRow) => void;
  // 다중 선택(추천견적 일괄 생성용). selectable 일 때만 체크박스 열 노출.
  selectable?: boolean;
  selectedCodes?: Set<string>;
  onToggleSelect?: (code: string) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
};

const COLS: Array<{ key: SortKey; label: string; align: 'left' | 'right' }> = [
  { key: 'client_name', label: '거래처명', align: 'left' },
  { key: 'business_type', label: '업종', align: 'left' },
  { key: 'venue', label: '업장유형', align: 'left' },
  { key: 'last_order_date', label: '최종발주', align: 'right' },
  { key: 'order_days', label: '발주일수', align: 'right' },
  { key: 'period_qty', label: '수량', align: 'right' },
  { key: 'period_supply', label: '공급가', align: 'right' },
  { key: 'period_total', label: '총액', align: 'right' },
];

function WinbackMark({ status }: { status: 'dormant' | 'risk' }) {
  const color = status === 'dormant' ? 'var(--status-danger)' : 'var(--status-warning)';
  return (
    <span
      title="발주 리듬이 끊긴 거래처 — 추천견적 생성 시 윈백가가 자동 적용됩니다"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, fontSize: 10.5, fontWeight: 700, color, whiteSpace: 'nowrap' }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {status === 'dormant' ? '휴면' : '이탈위험'}
    </span>
  );
}

export function ClientsTable({
  clients, winbackMap, loading, sortKey, onSort, sortIcon, onRowClick,
  selectable, selectedCodes, onToggleSelect, onToggleAll, allSelected,
}: Props) {
  if (loading) {
    return (
      <Section padding="md">
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '24px 0' }}>
          불러오는 중...
        </div>
      </Section>
    );
  }
  if (clients.length === 0) {
    return (
      <Section padding="md">
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '24px 0' }}>
          해당 기간에 거래 내역이 없습니다.
        </div>
      </Section>
    );
  }

  return (
    <Section title="거래처별 현황" meta={`${clients.length}개`} padding="none">
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ ...tableStyle, minWidth: 720 }}>
          <thead>
            <tr>
              {selectable && (
                <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={() => onToggleAll?.()}
                    title="전체 선택"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {COLS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => onSort(col.key)}
                    style={{
                      ...thStyle,
                      textAlign: col.align,
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: active ? 'var(--action)' : 'var(--text-tertiary)',
                    }}
                    title="클릭하여 정렬"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      <span style={{ fontSize: 9, opacity: active ? 1 : 0.3, width: 8 }}>
                        {sortIcon(col.key) || '↕'}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr
                key={c.client_code || c.client_name + i}
                onClick={() => onRowClick?.(c)}
                style={{ transition: 'background 0.12s ease', cursor: onRowClick ? 'pointer' : 'default' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--surface-hover)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {selectable && (
                  <td style={{ ...tdStyle, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!c.client_code && !!selectedCodes?.has(c.client_code)}
                      disabled={!c.client_code}
                      onChange={() => c.client_code && onToggleSelect?.(c.client_code)}
                      style={{ cursor: c.client_code ? 'pointer' : 'not-allowed' }}
                    />
                  </td>
                )}
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {c.client_name}
                  {c.client_code && winbackMap?.[c.client_code] && (
                    <WinbackMark status={winbackMap[c.client_code]} />
                  )}
                </td>
                {/* 뱃지 다운그레이드: 배경 필 제거 — 텍스트로만, 예외 상태(미지정)만 색 텍스트 */}
                <td style={tdStyle}>
                  {c.business_type ? (
                    <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{c.business_type}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {c.venue && VENUE_MAP[c.venue] ? (
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      {VENUE_MAP[c.venue].label}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--status-warning)' }}>
                      미지정
                    </span>
                  )}
                </td>
                <td style={{ ...tdRight, color: 'var(--text-tertiary)' }}>
                  {fmtDate(c.last_order_date)}
                </td>
                <td style={tdMuted as React.CSSProperties}>
                  <span style={{ display: 'block', textAlign: 'right' }}>{c.order_days}일</span>
                </td>
                <td style={{ ...tdRight, color: 'var(--text-tertiary)' }}>{fmt(c.period_qty)}</td>
                <td style={tdRight}>{fmt(c.period_supply)}</td>
                <td style={{ ...tdRight, fontWeight: 700, color: 'var(--action)' }}>
                  {fmt(c.period_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
