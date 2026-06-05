'use client';

import type { WineRowExt } from '../types';
import { WinesTableHeader } from './WinesTableHeader';
import { WinesTableRow } from './WinesTableRow';
import { Pagination } from './Pagination';

type Props = {
  wines: WineRowExt[];
  loading: boolean;
  isMobile: boolean;
  selectedCode?: string;
  onSelect: (w: WineRowExt) => void;
  deleting: boolean;
  onDelete: (id: string, name: string) => void;
  sortBy: string;
  onSort: (col: string) => void;
  sortArrow: (col: string) => string;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
};

export function WinesList(p: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
      <WinesTableHeader
        isMobile={p.isMobile}
        sortBy={p.sortBy}
        onSort={p.onSort}
        sortArrow={p.sortArrow}
      />

      {p.loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>로딩 중...</div>
      ) : p.wines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)', fontSize: 13 }}>
          검색 결과가 없습니다.
        </div>
      ) : (
        p.wines.map(w => (
          <WinesTableRow
            key={w.item_code}
            wine={w}
            isMobile={p.isMobile}
            isSelected={p.selectedCode === w.item_code}
            deleting={p.deleting}
            onSelect={() => p.onSelect(w)}
            onDelete={p.onDelete}
          />
        ))
      )}

      <Pagination page={p.page} totalPages={p.totalPages} onChange={p.onPageChange} />
    </div>
  );
}
