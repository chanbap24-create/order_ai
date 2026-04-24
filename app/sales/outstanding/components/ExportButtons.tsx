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
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={onExportSummary}
        disabled={summaryDisabled || summaryExporting}
        title="현재 화면에 보이는 요약 테이블 전체를 단일 엑셀로 저장"
        style={{
          padding: '10px 20px', borderRadius: 10, border: '1.5px solid #5A1515',
          background: (summaryDisabled || summaryExporting) ? '#f5f0f0' : '#fff',
          color: (summaryDisabled || summaryExporting) ? '#a8a098' : '#5A1515',
          fontSize: 14, fontWeight: 600,
          cursor: (summaryDisabled || summaryExporting) ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        {summaryExporting ? '생성 중...' : '현재 화면 Excel'}
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onExport('excel')}
          disabled={perClientDisabled}
          title="선택한 거래처별 개별 원장(엑셀)을 ZIP 으로 다운로드"
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: perClientDisabled ? '#d4c5c5' : '#5A1515',
            color: 'white', fontSize: 14, fontWeight: 600,
            cursor: perClientDisabled ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {exporting ? '생성 중...' : `거래처별 Excel (${checkedCount}건)`}
        </button>
        <button
          onClick={() => onExport('pdf')}
          disabled={perClientDisabled}
          title="선택한 거래처별 개별 원장(PDF)을 ZIP 으로 다운로드"
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: perClientDisabled ? '#d4c5c5' : '#C62828',
            color: 'white', fontSize: 14, fontWeight: 600,
            cursor: perClientDisabled ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          {exporting ? '생성 중...' : `거래처별 PDF (${checkedCount}건)`}
        </button>
      </div>
    </div>
  );
}
