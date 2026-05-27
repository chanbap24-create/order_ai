'use client';

import type { ClientDetail } from '../types';

/**
 * AlertCard 안에 펼쳐지는 거래처 리스트.
 * 표 스타일은 alert 카드 내부용 (좁은 폭, 가벼운 톤).
 */
export function AlertClientsList({ clients }: { clients: ClientDetail[] }) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--surface-muted)',
      }}
    >
      <div
        style={{
          display: 'flex',
          padding: '8px 16px',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          fontWeight: 700,
          borderBottom: '1px solid var(--border-subtle)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ flex: 1 }}>거래처</span>
        <span style={{ width: 60, textAlign: 'right' }}>수량</span>
        <span style={{ width: 90, textAlign: 'right' }}>최근 출고</span>
      </div>
      {clients.map((c) => (
        <div
          key={c.client_code}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            fontSize: 12,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-primary)' }}>
            {c.client_name}
          </span>
          <span
            style={{
              width: 60,
              textAlign: 'right',
              fontWeight: 700,
              color: 'var(--action)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.total_qty}병
          </span>
          <span
            style={{
              width: 90,
              textAlign: 'right',
              color: 'var(--text-muted)',
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.last_date || '-'}
          </span>
        </div>
      ))}
      {clients.length === 0 && (
        <div
          style={{
            padding: '14px 16px',
            fontSize: 12,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          출고 기록이 없습니다.
        </div>
      )}
    </div>
  );
}
