"use client";

/**
 * AnalysisTab 공통 CSS. 모든 값은 의미 토큰 사용.
 * 다른 페이지의 Section/표 와 동일한 톤·간격 유지.
 */
export function AnalysisStyles() {
  return (
    <style>{`
      .analysis-card {
        background: var(--surface);
        border: 1px solid var(--border-default);
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 12px;
      }
      .analysis-grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .analysis-chart-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 12px;
        letter-spacing: 0.01em;
      }
      .analysis-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .analysis-table th {
        background: var(--surface-muted);
        color: var(--text-tertiary);
        font-weight: 700;
        font-size: 11px;
        padding: 10px 12px;
        text-align: left;
        border-bottom: 1px solid var(--border-default);
        white-space: nowrap;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .analysis-table td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--border-subtle);
        color: var(--text-primary);
      }
      .analysis-table tbody tr:hover td {
        background: var(--surface-hover);
      }
      @media (max-width: 768px) {
        .analysis-grid2 { grid-template-columns: 1fr; }
        .analysis-card { padding: 12px 16px; }
        .analysis-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      }
    `}</style>
  );
}
