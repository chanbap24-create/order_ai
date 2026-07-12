'use client';

import { memo } from 'react';
import type { AnalysisData, CountryRow, RegionRow } from '../types';
import { TYPE_BG, TYPE_COLORS, fmt, fmtM, pct } from '../lib/format';

type Props = {
  data: AnalysisData;
  expandedCountry: string | null;
  onToggleCountry: (name: string) => void;
};

export const CountrySummary = memo(function CountrySummary({ data, expandedCountry, onToggleCountry }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.countries.map(c => {
        const expanded = expandedCountry === c.name;
        const regions = data.regions[c.name] || [];
        return (
          <CountryRowView
            key={c.name}
            country={c}
            total={data.total_qty}
            expanded={expanded}
            regions={regions}
            onToggle={() => onToggleCountry(c.name)}
          />
        );
      })}
    </div>
  );
});

const CountryRowView = memo(function CountryRowView({
  country: c, total, expanded, regions, onToggle,
}: {
  country: CountryRow;
  total: number;
  expanded: boolean;
  regions: RegionRow[];
  onToggle: () => void;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid var(--action-muted)', overflow: 'hidden',
    }}>
      <div onClick={onToggle} style={{
        padding: '12px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 65, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{c.name}</div>
        <div style={{ flex: 1, height: 22, background: '#f5f0f0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: 'flex', height: '100%' }}>
            {c.types.map(t => (
              <div
                key={t.name}
                style={{
                  width: `${pct(t.qty, c.qty)}%`, height: '100%',
                  background: TYPE_COLORS[t.name] || 'var(--gray-300)',
                  minWidth: t.qty > 0 ? 1 : 0,
                }}
                title={`${t.name} ${pct(t.qty, c.qty)}%`}
              />
            ))}
          </div>
          <span style={{
            position: 'absolute', right: 8, top: 3,
            fontSize: 11, color: 'var(--neutral-600)', fontWeight: 600,
            textShadow: '0 0 3px #fff, 0 0 3px #fff',
          }}>
            {fmt(c.qty)} ({pct(c.qty, total)}%)
          </span>
        </div>
        <div style={{ width: 65, textAlign: 'right', fontSize: 11, color: 'var(--neutral-100)', flexShrink: 0 }}>{fmtM(c.amount)}</div>
        <div style={{ width: 55, textAlign: 'right', fontSize: 10, color: '#bbb', flexShrink: 0 }}>{c.items}종</div>
        <span style={{ fontSize: 10, color: 'var(--gray-300)', flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0 10px' }}>
            {c.types.map(t => (
              <span key={t.name} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                background: TYPE_BG[t.name] || 'var(--gray-100)',
                color: TYPE_COLORS[t.name] || 'var(--neutral-400)',
                fontWeight: 600,
              }}>
                {t.name} {fmt(t.qty)} ({pct(t.qty, c.qty)}%)
              </span>
            ))}
          </div>
          {regions.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-100)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                지역별
              </div>
              {regions.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                  <div style={{ width: 110, color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {r.name}
                  </div>
                  <div style={{ flex: 1, height: 14, background: '#f5f0f0', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${pct(r.qty, c.qty)}%`, height: '100%',
                      background: '#C4A35A', borderRadius: 3, minWidth: 2,
                    }} />
                  </div>
                  <div style={{ width: 55, textAlign: 'right', fontSize: 11, color: 'var(--neutral-200)', fontWeight: 500, flexShrink: 0 }}>{fmt(r.qty)}</div>
                  <div style={{ width: 50, textAlign: 'right', fontSize: 10, color: '#bbb', flexShrink: 0 }}>{fmtM(r.amount)}</div>
                  <div style={{ width: 55, textAlign: 'right', fontSize: 10, color: 'var(--gray-400)', flexShrink: 0 }}>{fmt(r.avg_price)}원</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
});
