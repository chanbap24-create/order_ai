'use client';

import type { AlertItem } from '../types';
import { fmt } from '../lib/format';
import { AlertClientsList } from './AlertClientsList';

type Props = {
  alert: AlertItem;
  isChecked: boolean;
  onToggleCheck: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAltOpen: boolean;
  onToggleAlt: () => void;
  altPanel?: React.ReactNode;
};

/**
 * 재고 알림 카드 — 품절은 빨강 좌측 막대, 부족은 주황 좌측 막대.
 * 카드 외곽 / radius / hover 모두 의미 토큰.
 */
export function AlertCard(p: Props) {
  const { alert } = p;
  const isOut = alert.alert_type === 'out_of_stock';
  const accentColor = isOut ? 'var(--status-danger)' : 'var(--status-warning)';
  const stockPct = Math.min((alert.current_stock / Math.max(alert.threshold, 1)) * 100, 100);

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border-default)',
        borderLeft: `3px solid ${accentColor}`,
        overflow: 'hidden',
        opacity: p.isChecked ? 0.6 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <div style={{ padding: '14px 16px' }}>
        {/* 상단: 체크박스 + 타입 라벨 + D-day */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={p.isChecked}
            onChange={p.onToggleCheck}
            style={{ width: 14, height: 14, accentColor: 'var(--action)', flexShrink: 0, margin: 0 }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: accentColor,
              color: 'var(--text-on-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {isOut ? '품절' : '재고 부족'}
          </span>
          {alert.days_remaining != null && alert.days_remaining > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color:
                  alert.days_remaining <= 7
                    ? 'var(--status-danger)'
                    : alert.days_remaining <= 14
                      ? 'var(--status-warning)'
                      : 'var(--text-tertiary)',
              }}
            >
              약 {alert.days_remaining}일 후 소진
            </span>
          )}
        </div>

        {/* 품목명 + 메타 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {alert.item_name || alert.item_no}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 4,
              fontSize: 11,
              color: 'var(--text-tertiary)',
              flexWrap: 'wrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{alert.item_no}</span>
            {alert.country && <span>{alert.country}</span>}
            {alert.supply_price > 0 && <span>{fmt(alert.supply_price)}원</span>}
          </div>
        </div>

        {/* 재고 progress */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            <span style={{ color: 'var(--text-tertiary)' }}>
              재고{' '}
              <span style={{ fontWeight: 700, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>
                {alert.current_stock}
              </span>
              병
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              기준 {alert.threshold}병
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: 'var(--surface-muted)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${stockPct}%`,
                background: accentColor,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* 하단 액션 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={p.onToggleExpand}
            style={{
              height: 28,
              padding: '0 10px',
              border: '1px solid var(--border-default)',
              background: 'var(--surface)',
              color: 'var(--text-tertiary)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            거래처 {alert.clients.length}곳 · {alert.total_shipped}병
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: p.isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <button
            onClick={p.onToggleAlt}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 6,
              border: `1px solid ${p.isAltOpen ? 'var(--border-default)' : 'var(--action)'}`,
              background: p.isAltOpen ? 'var(--surface)' : 'var(--action)',
              color: p.isAltOpen ? 'var(--text-tertiary)' : 'var(--text-on-primary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {p.isAltOpen ? '닫기' : '대체 추천'}
          </button>
        </div>
      </div>

      {p.isExpanded && <AlertClientsList clients={alert.clients} />}
      {p.isAltOpen && p.altPanel}
    </div>
  );
}
