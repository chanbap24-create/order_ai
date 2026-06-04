'use client';

import type { WeightConfig } from '../types';
import { WEIGHT_LABELS } from '../constants';

type Props = {
  weights: WeightConfig;
  totalWeight: number;
  onChange: (key: keyof WeightConfig, val: string) => void;
};

export function WeightsCard({ weights, totalWeight, onChange }: Props) {
  const totalColor = totalWeight === 100 ? 'var(--status-success)' : totalWeight > 90 && totalWeight < 110 ? 'var(--status-warning)' : 'var(--status-danger)';

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 16px',
      marginBottom: 16, boxShadow: '0 1px 3px rgba(90,21,21,0.06)',
      border: '1px solid rgba(90,21,21,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>추천 점수 가중치</div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: totalColor,
          padding: '4px 12px', borderRadius: 20,
          background: `${totalColor}14`,
        }}>
          합계: {totalWeight}점
        </div>
      </div>

      <div style={{
        display: 'flex', borderRadius: 8, overflow: 'hidden',
        height: 28, marginBottom: 20, border: '1px solid rgba(90,21,21,0.06)',
      }}>
        {(Object.keys(WEIGHT_LABELS) as (keyof WeightConfig)[]).map(key => {
          const w = weights[key];
          const pct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
          if (pct < 1) return null;
          return (
            <div key={key} style={{
              width: `${pct}%`,
              background: WEIGHT_LABELS[key].color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'width 0.3s',
              minWidth: pct > 5 ? undefined : 0,
            }}>
              {pct > 8 && (
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {WEIGHT_LABELS[key].label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(Object.keys(WEIGHT_LABELS) as (keyof WeightConfig)[]).map(key => {
          const info = WEIGHT_LABELS[key];
          const val = weights[key];
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: info.color, display: 'inline-block', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{info.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{info.desc}</span>
                </div>
                <input
                  type="number"
                  value={val}
                  onChange={e => onChange(key, e.target.value)}
                  min={0}
                  max={100}
                  style={{
                    width: 52, textAlign: 'center', fontSize: 14, fontWeight: 700,
                    border: '1.5px solid rgba(90,21,21,0.08)', borderRadius: 6, padding: '4px 0',
                    color: info.color, outline: 'none',
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={val}
                onChange={e => onChange(key, e.target.value)}
                style={{
                  width: '100%', height: 6,
                  accentColor: info.color,
                  cursor: 'pointer',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
