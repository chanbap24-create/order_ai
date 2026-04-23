'use client';

import type { ClientSummary, ItemRow, SearchItem, Totals, ViewMode } from '../types';
import { fmt } from '../lib/format';
import { DateView } from './DateView';
import { ClientView } from './ClientView';

type Props = {
  itemName: string;
  selectedItem: SearchItem | null;
  totals: Totals;
  rows: ItemRow[];
  clientSummary: ClientSummary[];
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
};

export function ResultCard(p: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid rgba(90,21,21,0.06)',
      boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '2px solid #5A1515',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#2c1810' }}>{p.itemName}</span>
          <span style={{ fontSize: 12, color: '#8a8580', marginLeft: 8 }}>{p.selectedItem?.item_no}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#8a8580' }}>
            {p.totals.clients}개 거래처 · {p.rows.length}건
          </span>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(90,21,21,0.04)', borderRadius: 6, padding: 2 }}>
            {([['date', '날짜별'], ['client', '거래처별']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => p.onViewModeChange(m)}
                style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none',
                  fontSize: 11, fontWeight: p.viewMode === m ? 700 : 500,
                  background: p.viewMode === m ? '#fff' : 'transparent',
                  color: p.viewMode === m ? '#5A1515' : '#8a8580',
                  cursor: 'pointer', boxShadow: p.viewMode === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(90,21,21,0.08)' }}>
        {[
          { label: '총 수량', value: fmt(p.totals.qty), unit: '' },
          { label: '총 금액', value: fmt(p.totals.supply), unit: '원' },
          { label: '거래처 수', value: String(p.totals.clients), unit: '개' },
        ].map((card, i) => (
          <div key={i} style={{
            flex: 1, padding: '12px 16px', textAlign: 'center',
            borderRight: i < 2 ? '1px solid rgba(90,21,21,0.06)' : 'none',
          }}>
            <div style={{ fontSize: 10, color: '#8a8580', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {card.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#5A1515', marginTop: 2 }}>
              {card.value}
              <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8580' }}>{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {p.viewMode === 'date'
          ? <DateView rows={p.rows} />
          : <ClientView summary={p.clientSummary} />}
      </div>
    </div>
  );
}
