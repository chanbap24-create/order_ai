'use client';

import type { WineRegion } from '../types';
import { classColor, getCountryFlag } from '../constants';

type Props = {
  regions: WineRegion[];
  onEdit: (r: WineRegion) => void;
  onDelete: (id: number) => void;
};

export function RegionTableView({ regions, onEdit, onDelete }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F5F4F2' }}>
            {['국가', '대지역', '서브리전', 'AOC/DO/AVA', '크뤼/포도밭', '등급', '품종', '비고', ''].map(h => (
              <th key={h} style={{
                padding: '8px 6px', textAlign: 'left', fontWeight: 600,
                color: '#555', borderBottom: '2px solid #E5E5E5', whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regions.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                <span style={{ marginRight: 4 }}>{getCountryFlag(r.country)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.country?.split(' ')[0]}</span>
              </td>
              <td style={{ padding: '6px', fontWeight: 500, color: 'var(--action)' }}>{r.major_region}</td>
              <td style={{ padding: '6px', color: '#444' }}>{r.sub_region || '-'}</td>
              <td style={{ padding: '6px', fontWeight: 500 }}>{r.appellation || '-'}</td>
              <td style={{ padding: '6px', color: '#8B1538' }}>{r.cru_vineyard || '-'}</td>
              <td style={{ padding: '6px' }}>
                {r.classification ? (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                    background: classColor(r.classification) + '15', color: classColor(r.classification),
                  }}>
                    {r.classification}
                  </span>
                ) : '-'}
              </td>
              <td style={{ padding: '6px', color: 'var(--text-tertiary)', fontSize: 11 }}>{r.grape_varieties || '-'}</td>
              <td style={{ padding: '6px', color: '#B8860B', fontSize: 11 }}>{r.notes || '-'}</td>
              <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                <button
                  onClick={() => onEdit(r)}
                  style={{ padding: '2px 6px', fontSize: 10, border: '1px solid #ddd', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#555', marginRight: 4 }}
                >
                  수정
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  style={{ padding: '2px 6px', fontSize: 10, border: '1px solid #fcc', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#c44' }}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
