'use client';

import type { StockRuleConfig } from '../types';
import { STOCK_LABELS } from '../constants';

type Props = {
  stockRules: StockRuleConfig;
  onChange: (key: keyof StockRuleConfig, val: string) => void;
};

export function StockRulesCard({ stockRules, onChange }: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 16px',
      marginBottom: 16, boxShadow: '0 1px 3px rgba(90,21,21,0.06)',
      border: '1px solid var(--action-muted)',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        추천 가능 재고 기준
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        가격대별 최소 재고가 이 기준 미만이면 추천에서 제외됩니다.
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
      }}>
        {(Object.keys(STOCK_LABELS) as (keyof StockRuleConfig)[]).map(key => {
          const info = STOCK_LABELS[key];
          const val = stockRules[key];
          const isSpecial = key === 'months_supply';
          return (
            <div key={key} style={{
              background: isSpecial ? '#faf5ff' : 'var(--gray-50)',
              borderRadius: 8, padding: '12px 14px',
              border: isSpecial ? '1px solid #e8d5f5' : '1px solid var(--action-muted)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 500 }}>
                {info.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  value={val}
                  onChange={e => onChange(key, e.target.value)}
                  min={0}
                  style={{
                    width: 70, fontSize: 16, fontWeight: 700,
                    border: '1.5px solid var(--border-default)', borderRadius: 6, padding: '6px 8px',
                    color: 'var(--text-primary)', outline: 'none', textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{info.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
