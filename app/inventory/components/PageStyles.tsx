"use client";

/** Inventory 전역 CSS (호버/칩/카드/슬라이드 애니메이션) */
export function PageStyles() {
  return (
    <style>{`
      .inv-card {
        transition: all 0.2s ease;
        position: relative;
      }
      .inv-card::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 2px;
        background: #E0D5D0;
        border-radius: 2px 0 0 2px;
        transition: background 0.2s ease;
      }
      .inv-card:hover {
        box-shadow: 0 4px 12px -4px rgba(90,21,21,0.10);
        transform: translateY(-1px);
      }
      .inv-card:hover::before {
        background: #5A1515;
      }
      .inv-chip {
        display: inline-flex;
        align-items: center;
        height: 28px;
        padding: 0 12px;
        border-radius: 14px;
        font-size: 0.72rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #E5E5E5;
        background: white;
        color: #666;
        user-select: none;
        white-space: nowrap;
      }
      .inv-chip.active {
        background: rgba(90,21,21,0.08);
        border-color: #5A1515;
        color: #5A1515;
      }
      .inv-chip.disabled {
        opacity: 0.4;
        pointer-events: none;
      }
      .inv-col-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 30px;
        padding: 0 12px;
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #E5E5E5;
        background: white;
        color: #666;
        user-select: none;
        white-space: nowrap;
      }
      .inv-col-chip.active {
        background: #5A1515;
        border-color: #5A1515;
        color: white;
      }
      .inv-col-chip.locked {
        opacity: 0.4;
        pointer-events: none;
      }
      .add-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: #5A1515;
        color: white;
        font-size: 18px;
        cursor: pointer;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        transition: all 0.2s ease;
      }
      .add-btn:hover {
        background: #7a2040;
        transform: scale(1.1);
      }
      .add-btn.added {
        background: #10b981;
      }
      .quote-basket-header {
        transition: background 0.2s ease;
      }
      .quote-basket-header:hover {
        background: #f5f4f2 !important;
      }
      .quote-slide-overlay {
        animation: fadeIn 0.2s ease;
      }
      .quote-slide-panel {
        animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
