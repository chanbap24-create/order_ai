"use client";

import { ORDER_COLORS, ORDER_FONT } from "../constants";

type Props = {
  staffMessage: string;
  copied: boolean;
  onCopy: () => void;
  title?: string;
  leftAction?: React.ReactNode; // 복사 버튼 좌측 추가 액션(예: 시음주 추가)
};

/** 메시지 카드 — pre 본문 + 복사 버튼 (직원/거래처 공용, title로 구분) */
export function StaffMessageCard({ staffMessage, copied, onCopy, title = "발주 메시지", leftAction }: Props) {
  return (
    <div
      className="order-card"
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: "16px 18px",
        border: "1px solid var(--action-muted)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        marginBottom: 16,
        transition: "box-shadow 0.3s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 3,
              height: 14,
              borderRadius: 2,
              background: "var(--action)",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: ORDER_COLORS.text }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {leftAction}
          <button
            onClick={onCopy}
            className="order-copy-btn"
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: copied ? "1px solid var(--status-success)" : "1px solid var(--border-default)",
              background: copied ? ORDER_COLORS.confHigh : "#fff",
              color: copied ? "#fff" : "var(--text-tertiary)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              letterSpacing: "0.02em",
            }}
          >
            {copied ? "복사됨!" : "복사"}
          </button>
        </div>
      </div>
      <pre
        style={{
          fontSize: 13,
          color: ORDER_COLORS.text,
          lineHeight: 1.75,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          margin: 0,
          fontFamily: ORDER_FONT.base,
          background: ORDER_COLORS.surfaceBg,
          borderRadius: 12,
          padding: "14px 16px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {staffMessage}
      </pre>
    </div>
  );
}
