'use client';

type Props = {
  checkedCount: number;
  exporting: boolean;
  onExport: (format: 'excel' | 'pdf') => void;
};

export function ExportButtons({ checkedCount, exporting, onExport }: Props) {
  const disabled = checkedCount === 0 || exporting;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <button
        onClick={() => onExport('excel')}
        disabled={disabled}
        style={{
          padding: '10px 20px', borderRadius: 10, border: 'none',
          background: disabled ? '#d4c5c5' : '#5A1515',
          color: 'white', fontSize: 14, fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        {exporting ? '생성 중...' : `Excel (${checkedCount}건)`}
      </button>
      <button
        onClick={() => onExport('pdf')}
        disabled={disabled}
        style={{
          padding: '10px 20px', borderRadius: 10, border: 'none',
          background: disabled ? '#d4c5c5' : '#C62828',
          color: 'white', fontSize: 14, fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        {exporting ? '생성 중...' : `PDF (${checkedCount}건)`}
      </button>
    </div>
  );
}
