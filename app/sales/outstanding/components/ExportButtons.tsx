'use client';

type Props = {
  checkedCount: number;
  exporting: boolean;
  onExport: (format: 'excel' | 'pdf') => void;
  /** 현재 화면(요약 테이블) 단일 엑셀 다운로드 */
  onExportSummary: () => void;
  summaryExporting: boolean;
  summaryDisabled: boolean;
};

const btnBase: React.CSSProperties = {
  height: 34,
  padding: '0 16px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 6,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  transition: 'background 0.12s ease, color 0.12s ease',
  letterSpacing: '0.01em',
  whiteSpace: 'nowrap',
};

export function ExportButtons({
  checkedCount,
  exporting,
  onExport,
  onExportSummary,
  summaryExporting,
  summaryDisabled,
}: Props) {
  const perClientDisabled = checkedCount === 0 || exporting;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={onExportSummary}
        disabled={summaryDisabled || summaryExporting}
        title="현재 화면 요약 테이블 단일 엑셀 다운로드"
        style={{
          ...btnBase,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: (summaryDisabled || summaryExporting) ? 'var(--text-muted)' : 'var(--action)',
          cursor: (summaryDisabled || summaryExporting) ? 'default' : 'pointer',
        }}
      >
        <Icon name="grid" />
        {summaryExporting ? '생성 중...' : '현재 화면 Excel'}
      </button>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onExport('excel')}
          disabled={perClientDisabled}
          title="선택 거래처 개별 Excel ZIP"
          style={{
            ...btnBase,
            border: '1px solid var(--action)',
            background: perClientDisabled ? 'var(--action-muted)' : 'var(--action)',
            color: perClientDisabled ? 'var(--text-muted)' : 'var(--text-on-primary)',
            cursor: perClientDisabled ? 'default' : 'pointer',
          }}
        >
          <Icon name="download" />
          {exporting ? '생성 중...' : `Excel · ${checkedCount}`}
        </button>
        <button
          onClick={() => onExport('pdf')}
          disabled={perClientDisabled}
          title="선택 거래처 개별 PDF ZIP"
          style={{
            ...btnBase,
            border: '1px solid var(--border-default)',
            background: 'var(--surface)',
            color: perClientDisabled ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: perClientDisabled ? 'default' : 'pointer',
          }}
        >
          <Icon name="file" />
          {exporting ? '생성 중...' : `PDF · ${checkedCount}`}
        </button>
      </div>
    </div>
  );
}

function Icon({ name }: { name: 'grid' | 'download' | 'file' }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'grid') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    );
  }
  if (name === 'download') {
    return (
      <svg {...common}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
