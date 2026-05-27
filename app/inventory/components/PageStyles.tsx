"use client";

/**
 * Inventory 전역 CSS — 의미 토큰 사용.
 * 다른 페이지 chip/card 패턴과 톤 통일.
 */
export function PageStyles() {
  return (
    <style>{`
      .inv-card {
        transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        position: relative;
      }
      .inv-card::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 2px;
        background: var(--border-default);
        border-radius: 2px 0 0 2px;
        transition: background 0.15s ease;
      }
      .inv-card:hover {
        box-shadow: 0 4px 12px -4px rgba(90,21,21,0.08);
      }
      .inv-card:hover::before {
        background: var(--action);
      }

      .inv-chip {
        display: inline-flex;
        align-items: center;
        height: 28px;
        padding: 0 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
        border: 1px solid var(--border-default);
        background: var(--surface);
        color: var(--text-tertiary);
        user-select: none;
        white-space: nowrap;
        letter-spacing: 0.02em;
      }
      .inv-chip:hover { background: var(--surface-hover); }
      .inv-chip.active {
        background: var(--action);
        border-color: var(--action);
        color: var(--text-on-primary);
      }
      .inv-chip.disabled {
        opacity: 0.4;
        pointer-events: none;
      }

      .inv-col-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 0 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
        border: 1px solid var(--border-default);
        background: var(--surface);
        color: var(--text-tertiary);
        user-select: none;
        white-space: nowrap;
      }
      .inv-col-chip:hover { background: var(--surface-hover); }
      .inv-col-chip.active {
        background: var(--action);
        border-color: var(--action);
        color: var(--text-on-primary);
      }
      .inv-col-chip.locked {
        opacity: 0.4;
        pointer-events: none;
      }

      .add-btn {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid var(--action);
        background: var(--action);
        color: var(--text-on-primary);
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        transition: background 0.12s ease, transform 0.12s ease;
      }
      .add-btn:hover {
        background: var(--action-hover);
      }
      .add-btn.added {
        background: #15803d;
        border-color: #15803d;
      }

      .quote-basket-header {
        transition: background 0.15s ease;
      }
      .quote-basket-header:hover {
        background: var(--surface-hover) !important;
      }

      .quote-slide-overlay {
        animation: fadeIn 0.2s ease;
      }
      .quote-slide-panel {
        animation: slideInRight 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      @keyframes spin {
        to { transform: translateY(-50%) rotate(360deg); }
      }
      @media (max-width: 480px) {
        .inv-col-grid { grid-template-columns: repeat(2, 1fr) !important; }
      }
    `}</style>
  );
}
