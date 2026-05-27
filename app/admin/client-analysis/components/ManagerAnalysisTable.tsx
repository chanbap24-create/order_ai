'use client';

import { memo } from 'react';
import { Section } from '@/app/components/ui';
import type { ManagerAnalysisItem } from '../types';
import { formatKrw } from '../lib/format';

const thBase: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  whiteSpace: 'nowrap',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  background: 'var(--surface-muted)',
  borderBottom: '1px solid var(--border-default)',
};
const tdBase: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
};

export const ManagerAnalysisTable = memo(function ManagerAnalysisTable({
  data,
}: {
  data: ManagerAnalysisItem[];
}) {
  if (data.length === 0) return null;

  return (
    <Section title="담당자별 분석" padding="none">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left' }}>담당자</th>
              <th style={{ ...thBase, textAlign: 'right' }}>거래처</th>
              <th style={{ ...thBase, textAlign: 'left' }}>업종별</th>
              <th style={{ ...thBase, textAlign: 'right' }}>지원률</th>
              <th style={{ ...thBase, textAlign: 'right' }}>매출</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.manager}>
                <td style={{ ...tdBase, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {m.manager}
                </td>
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'right',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {m.clientCount}
                </td>
                <td style={tdBase}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {m.bizClients.map((bc) => (
                      <span
                        key={bc.biz}
                        style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          background: 'var(--surface-muted)',
                          borderRadius: 4,
                          border: '1px solid var(--border-default)',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {bc.biz} <b style={{ color: 'var(--text-primary)' }}>{bc.count}</b>
                      </span>
                    ))}
                  </div>
                </td>
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'right',
                    fontWeight: 600,
                    color:
                      m.discountRate != null
                        ? m.discountRate > 15
                          ? '#C62828'
                          : m.discountRate > 5
                            ? '#E65100'
                            : '#2E7D32'
                        : 'var(--text-muted)',
                  }}
                >
                  {m.discountRate != null ? `${m.discountRate}%` : '-'}
                </td>
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'right',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatKrw(m.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
});
