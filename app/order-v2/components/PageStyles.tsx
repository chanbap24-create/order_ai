"use client";

/**
 * order-v2 전역 호버/애니메이션 CSS.
 * JSX inline style로 표현 불가능한 `:hover`, keyframes, `:focus` 선택자를 담는다.
 */
export function PageStyles() {
  return (
    <style>{`
      @keyframes orderPulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
      @keyframes orderSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes orderShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .order-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06) !important; }
      .order-btn-parse:hover:not(:disabled) {
        box-shadow: 0 6px 24px rgba(0,0,0,0.25) !important;
        transform: translateY(-1px);
      }
      .order-btn-parse:active:not(:disabled) { transform: translateY(0); }
      .order-btn-parse { transition: all 0.2s ease !important; }
      .order-client-item:hover { background: var(--surface-hover) !important; }
      .order-cand-btn:hover { background: var(--surface-hover) !important; }
      .order-search-item:hover { background: var(--surface-hover) !important; }
      .order-copy-btn:hover { border-color: var(--action) !important; color: var(--action) !important; }
      .order-preset-btn:hover { background: rgba(255,255,255,0.15) !important; }
      .order-input:focus { border-color: var(--border-strong) !important; box-shadow: 0 0 0 3px rgba(0,0,0,0.06) !important; }
      .order-line-card:hover { border-color: var(--border-default) !important; }
      .order-qty-btn:hover { background: var(--border-subtle) !important; border-color: var(--border-strong) !important; }
      .order-history-row:hover { background: var(--surface-hover) !important; }
      /* 발주 원문 vs 발주 메시지 좌우 비교 grid (모바일에서 1열로 폴백) */
      .order-compare-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        align-items: stretch;
      }
      .order-compare-grid > * { margin-bottom: 0 !important; }
      @media (max-width: 720px) {
        .order-compare-grid { grid-template-columns: 1fr; gap: 0; }
        .order-compare-grid > * { margin-bottom: 12px !important; }
      }
    `}</style>
  );
}
