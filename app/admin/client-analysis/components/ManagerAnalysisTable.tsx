'use client';

import Card from '@/app/components/ui/Card';
import type { ManagerAnalysisItem } from '../types';
import { formatKrw } from '../lib/format';

export function ManagerAnalysisTable({ data }: { data: ManagerAnalysisItem[] }) {
  if (data.length === 0) return null;

  return (
    <Card>
      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 16 }}>담당자별 분석</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            {['담당자', '거래처', '업종별', '지원률', '매출'].map(h => (
              <th key={h} style={{
                padding: '8px 10px',
                textAlign: h === '담당자' || h === '업종별' ? 'left' : 'right',
                fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text-light)',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(m => (
            <tr key={m.manager} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 500 }}>{m.manager}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{m.clientCount}</td>
              <td style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {m.bizClients.map(bc => (
                    <span key={bc.biz} style={{
                      fontSize: 'var(--text-xs)', padding: '2px 6px',
                      background: 'var(--color-background)', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)', whiteSpace: 'nowrap',
                    }}>
                      {bc.biz} <b>{bc.count}</b>
                    </span>
                  ))}
                </div>
              </td>
              <td style={{
                padding: '8px 10px', textAlign: 'right', fontWeight: 600,
                color: m.discountRate != null
                  ? m.discountRate > 15 ? '#E53E3E' : m.discountRate > 5 ? '#DD6B20' : '#38A169'
                  : 'var(--color-text-lighter)',
              }}>
                {m.discountRate != null ? `${m.discountRate}%` : '-'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(m.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
