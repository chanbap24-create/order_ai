'use client';

import { memo } from 'react';
import type { AnalysisData } from '../types';
import { fmt, fmtM, pct } from '../lib/format';

export const KpiCards = memo(function KpiCards({ data }: { data: AnalysisData }) {
  const cards = [
    { label: '총 판매량', value: fmt(data.total_qty) + '병', sub: '일 ' + fmt(data.daily_avg) + '병' },
    {
      label: '총 금액',
      value: fmtM(data.total_amount) + '원',
      sub: '월 ' + fmtM(Math.round(data.total_amount / Math.max(1, data.monthly.length))),
    },
    {
      label: '품목 수',
      value: fmt(data.total_items) + '종',
      sub: '월 평균 ' + fmt(data.monthly_avg) + '병',
    },
    {
      label: '평균 단가',
      value: data.total_qty > 0 ? fmt(Math.round(data.total_amount / data.total_qty)) + '원' : '-',
      sub: data.countries[0]
        ? data.countries[0].name + ' ' + pct(data.countries[0].qty, data.total_qty) + '%'
        : '',
    },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 10, marginBottom: 16,
    }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid rgba(90,21,21,0.06)',
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {card.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{card.value}</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
});
