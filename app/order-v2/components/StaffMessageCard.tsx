"use client";

import { ORDER_COLORS, ORDER_FONT } from "../constants";

type Props = {
  staffMessage: string;
  copied: boolean;
  onCopy: () => void;
};

/** 직원 메시지 카드 — pre 본문 + 복사 버튼 */
export function StaffMessageCard({ staffMessage, copied, onCopy }: Props) {
  return (
    <div
      className="order-card"
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "16px 18px",
        border: "1px solid var(--action-muted)",
        boxShadow: "0 2px 12px rgba(90,21,21,0.03)",
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
              background: "linear-gradient(180deg, var(--action), rgba(90,21,21,0.3))",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: ORDER_COLORS.text }}>
            발주 메시지
          </span>
        </div>
        <button
          onClick={onCopy}
          className="order-copy-btn"
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: copied ? "1px solid var(--status-success)" : "1px solid rgba(90,21,21,0.1)",
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
          borderRadius: 10,
          padding: "14px 16px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {staffMessage}
      </pre>
    </div>
  );
}
