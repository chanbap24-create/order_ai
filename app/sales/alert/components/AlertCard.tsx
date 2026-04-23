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

export function AlertCard(p: Props) {
  const { alert } = p;

  return (
    <div style={{
      background: 'white', borderRadius: 12,
      border: p.isChecked
        ? '2px solid #5A1515'
        : alert.alert_type === 'out_of_stock' ? '1px solid #ffcdd2' : '1px solid #ffe0b2',
      overflow: 'hidden',
      opacity: p.isChecked ? 0.7 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={p.isChecked}
            onChange={p.onToggleCheck}
            style={{ width: 16, height: 16, accentColor: '#5A1515', flexShrink: 0 }}
          />
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: alert.alert_type === 'out_of_stock' ? '#dc3545' : '#ff9800',
            color: 'white',
          }}>
            {alert.alert_type === 'out_of_stock' ? '품절' : '재고 부족'}
          </span>
          {alert.days_remaining != null && alert.days_remaining > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: alert.days_remaining <= 7 ? '#dc3545' : alert.days_remaining <= 14 ? '#e65100' : '#ff9800',
            }}>
              약 {alert.days_remaining}일 후 소진
            </span>
          )}
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2c1810', lineHeight: 1.4 }}>
            {alert.item_name || alert.item_no}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 12, color: '#8a8580', flexWrap: 'wrap' }}>
            <span>{alert.item_no}</span>
            {alert.country && <span>{alert.country}</span>}
            {alert.supply_price > 0 && <span>{fmt(alert.supply_price)}원</span>}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: '#8a8580' }}>
              재고 <span style={{ fontWeight: 700, color: alert.current_stock <= 0 ? '#dc3545' : '#e65100' }}>
                {alert.current_stock}
              </span>병
            </span>
            <span style={{ color: '#a8a098', fontSize: 11 }}>기준 {alert.threshold}병</span>
          </div>
          <div style={{ height: 5, background: '#faf9f7', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.min((alert.current_stock / Math.max(alert.threshold, 1)) * 100, 100)}%`,
              background: alert.current_stock <= 0 ? '#dc3545' : alert.current_stock < alert.threshold * 0.3 ? '#ff5722' : '#ff9800',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={p.onToggleExpand}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#5A1515', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4, padding: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
            </svg>
            거래처 {alert.clients.length}곳 · {alert.total_shipped}병 출고
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: p.isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <button
            onClick={p.onToggleAlt}
            style={{
              padding: '5px 12px', borderRadius: 6, border: 'none',
              background: p.isAltOpen ? '#f5f5f5' : '#5A1515', color: p.isAltOpen ? '#666' : 'white',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            {p.isAltOpen ? '닫기' : '대체 추천'}
          </button>
        </div>
      </div>

      {p.isExpanded && <AlertClientsList clients={alert.clients} />}
      {p.isAltOpen && p.altPanel}
    </div>
  );
}
