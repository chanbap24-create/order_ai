'use client';

import { memo } from 'react';
import Card from '@/app/components/ui/Card';
import type { AnalysisData } from '../types';
import { formatKrw } from '../lib/format';

export const SummaryCards = memo(function SummaryCards({ data }: { data: AnalysisData }) {
  const s = data.summary;
  const avgPerClient = s.distinctClients > 0 ? Math.round(s.totalRevenue / s.distinctClients) : 0;
  const returnRate = s.positiveRevenue > 0 ? Math.round(s.returnAmount / s.positiveRevenue * 1000) / 10 : 0;

  const discountRate = (() => {
    const matched = data.clientRanking.filter(c => c.discountRate != null && c.discountRate > 0);
    if (matched.length === 0) return null;
    const totalRev = matched.reduce((sum, c) => sum + c.revenue, 0);
    if (totalRev === 0) return null;
    return Math.round(matched.reduce((sum, c) => sum + (c.discountRate ?? 0) * c.revenue, 0) / totalRev * 10) / 10;
  })();

  const cards: Array<{ label: string; value: string; sub?: string; color: string }> = [
    { label: '총 매출', value: formatKrw(s.totalRevenue), color: '#8B1538' },
    { label: '활동 거래처', value: `${s.distinctClients.toLocaleString()}곳`, color: '#1565C0' },
    { label: '객단가', value: formatKrw(avgPerClient), sub: '거래처당 평균', color: '#2E7D32' },
    { label: '매출 집중도', value: `${s.top10Pct}%`, sub: '상위 10%', color: '#E65100' },
    { label: '재주문율', value: `${s.repeatRate}%`, sub: '2개월↑ 주문', color: '#6A1B9A' },
    { label: '반품률', value: `${returnRate}%`, sub: formatKrw(s.returnAmount), color: returnRate > 10 ? '#C62828' : '#546E7A' },
    { label: '평균 지원률', value: discountRate != null ? `${discountRate}%` : '-', sub: '가중평균', color: 'var(--color-text)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
      {cards.map((c, i) => (
        <Card key={i}>
          <div style={{ textAlign: 'center', padding: '6px 4px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 2, fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 10, color: 'var(--color-text-lighter)', marginTop: 2 }}>{c.sub}</div>}
          </div>
        </Card>
      ))}
    </div>
  );
});
