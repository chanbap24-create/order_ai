"use client";

import { GLASS_COLORS } from "../constants";
import { monoStyle } from "./styles";

type Props = {
  staffMessage: string;
  status?: string;
  copied: boolean;
  onCopy: () => void;
};

/**
 * 직원 메시지 카드 — 헤더(상태 배지 + 복사 버튼) + 메시지 본문.
 */
export function StaffMessageCard({ staffMessage, status, copied, onCopy }: Props) {
  return (
    <div
      style={{
        background: GLASS_COLORS.surface,
        borderRadius: 16,
        border: `1px solid ${GLASS_COLORS.dividerCard}`,
        boxShadow: GLASS_COLORS.primaryShadowSubtle,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          borderBottom: `1px solid ${GLASS_COLORS.dividerCard}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: GLASS_COLORS.text }}>
            직원 메시지
          </div>
          {status === "resolved" && <StatusBadge color={GLASS_COLORS.success} label="전체 확정" />}
          {status === "needs_review_items" && <StatusBadge color="#e8a820" label="확인 필요" />}
        </div>

        <button
          onClick={onCopy}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            border: copied
              ? "1.5px solid rgba(16,185,129,0.3)"
              : `1.5px solid ${GLASS_COLORS.primaryBorder}`,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            background: copied ? "rgba(16,185,129,0.06)" : "transparent",
            color: copied ? GLASS_COLORS.success : GLASS_COLORS.primary,
            transition: "all 0.25s ease",
          }}
        >
          {copied ? "복사됨 ✓" : "복사하기"}
        </button>
      </div>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          padding: "14px 18px",
          margin: 0,
          background: "transparent",
          lineHeight: 1.7,
          ...monoStyle,
        }}
      >
        {staffMessage}
      </pre>
    </div>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        background: color,
        color: "white",
        borderRadius: 10,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
