"use client";

/** AnalysisTab 공통 CSS — analysis-card / analysis-grid2 / analysis-table 등 */
export function AnalysisStyles() {
  return (
    <style>{`
      .analysis-card { background: #fff; border: 1px solid rgba(90,21,21,0.06); border-radius: 14px; padding: 20px; }
      .analysis-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .analysis-chart-title { font-size: 0.82rem; font-weight: 600; color: #2c1810; margin-bottom: 12px; }
      .analysis-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
      .analysis-table th { background: #faf5f5; color: #5A1515; font-weight: 600; padding: 10px 8px; text-align: left; border-bottom: 2px solid #E8E8E8; white-space: nowrap; }
      .analysis-table td { padding: 10px 8px; border-bottom: 1px solid rgba(90,21,21,0.06); }
      .analysis-table tr:hover td { background: #faf5f5; }
      @media (max-width: 768px) {
        .analysis-grid2 { grid-template-columns: 1fr; }
        .analysis-card { padding: 16px; }
        .analysis-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      }
    `}</style>
  );
}
