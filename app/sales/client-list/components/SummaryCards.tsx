'use client';

import { fmt } from '../lib/format';

type Props = {
  totalClients: number;
  totalSupply: number;
  totalAmount: number;
};

export function SummaryCards({ totalClients, totalSupply, totalAmount }: Props) {
  const cards = [
    { label: '거래처 수', value: `${fmt(totalClients)}개`, color: '#5A1515' },
    { label: '공급가 합계', value: `${fmt(totalSupply)}원`, color: '#1a6b3c' },
    { label: '총액 합계', value: `${fmt(totalAmount)}원`, color: '#1a4d8c' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16,
    }}>
      {cards.map(card => (
        <div key={card.label} style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid rgba(90,21,21,0.06)',
          padding: '12px 14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: '#8a8580', marginBottom: 4 }}>{card.label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: card.color }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
