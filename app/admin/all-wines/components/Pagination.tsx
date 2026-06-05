'use client';

type Props = {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
};

export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: 8, padding: 12,
      borderTop: '1px solid var(--gray-200)', position: 'sticky', bottom: 0, background: '#fff',
    }}>
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        style={{
          padding: '6px 12px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13,
          cursor: page > 1 ? 'pointer' : 'default', background: '#fff', opacity: page <= 1 ? 0.4 : 1,
        }}
      >
        ◀ 이전
      </button>
      <span style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: '32px' }}>
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        style={{
          padding: '6px 12px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13,
          cursor: page < totalPages ? 'pointer' : 'default', background: '#fff', opacity: page >= totalPages ? 0.4 : 1,
        }}
      >
        다음 ▶
      </button>
    </div>
  );
}
