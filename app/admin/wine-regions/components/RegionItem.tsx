'use client';

import type { WineRegion } from '../types';
import { classColor } from '../constants';

type Props = {
  region: WineRegion;
  onEdit: (r: WineRegion) => void;
  onDelete: (id: number) => void;
};

export function RegionItem({ region: r, onEdit, onDelete }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {r.appellation && <span style={{ fontWeight: 600, color: '#2c1810' }}>{r.appellation}</span>}
          {r.cru_vineyard && <span style={{ color: '#8B1538', fontWeight: 500 }}>{r.cru_vineyard}</span>}
          {r.classification && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
              background: classColor(r.classification) + '15', color: classColor(r.classification),
              whiteSpace: 'nowrap',
            }}>
              {r.classification}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 12, color: '#8a8580' }}>
          {r.grape_varieties && <span>{r.grape_varieties}</span>}
          {r.notes && <span style={{ color: '#B8860B' }}>{r.notes}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => onEdit(r)}
          style={{ padding: '3px 8px', fontSize: 11, border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#555' }}
        >
          수정
        </button>
        <button
          onClick={() => onDelete(r.id)}
          style={{ padding: '3px 8px', fontSize: 11, border: '1px solid #fcc', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#c44' }}
        >
          삭제
        </button>
      </div>
    </div>
  );
}
