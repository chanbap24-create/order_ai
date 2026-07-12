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
 * 재고 알림 행 — KREAM 리스트 문법(박스·좌측막대 대신 헤어라인 행).
 * 상태는 도트 + 색 텍스트/숫자로만: 품절=빨강, 재고 부족=주황.
 */
export function AlertCard(p: Props) {
  const { alert } = p;
  const isOut = alert.alert_type === 'out_of_stock';
  const accentColor = isOut ? 'var(--status-danger)' : 'var(--status-warning)';

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        opacity: p.isChecked ? 0.5 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 2px' }}>
        <input
          type="checkbox"
          checked={p.isChecked}
          onChange={p.onToggleCheck}
          style={{ width: 14, height: 14, accentColor: 'var(--action)', flexShrink: 0, margin: '3px 0 0' }}
        />

        {/* 본문: 상태 + 품목명 + 메타 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: accentColor, flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />
              {isOut ? '품절' : '재고 부족'}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {alert.item_name || alert.item_no}
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
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 3,
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

          {/* 하단 액션 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={p.onToggleExpand}
              style={{
                height: 26,
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
                height: 26,
                padding: '0 12px',
                borderRadius: 6,
                border: `1px solid ${p.isAltOpen ? 'var(--border-default)' : 'var(--action)'}`,
                background: p.isAltOpen ? 'var(--surface)' : 'var(--action)',
                color: p.isAltOpen ? 'var(--text-tertiary)' : 'var(--text-on-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {p.isAltOpen ? '닫기' : '대체 추천'}
            </button>
          </div>
        </div>

        {/* 우측: 재고 숫자 (숫자가 상태를 말한다) */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: accentColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
            {alert.current_stock}
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>병</span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
            기준 {alert.threshold}병
          </div>
        </div>
      </div>

      {p.isExpanded && <AlertClientsList clients={alert.clients} />}
      {p.isAltOpen && p.altPanel}
    </div>
  );
}
