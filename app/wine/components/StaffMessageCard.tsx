"use client";

import { WINE_COLORS } from "../constants";
import { monoStyle } from "./styles";

type Props = {
  staffMessage: string;
  status?: string;
  copied: boolean;
  onCopy: () => void;
};

/** 직원 메시지 카드 + 상태 배지 + 복사 버튼 */
export function StaffMessageCard({ staffMessage, status, copied, onCopy }: Props) {
  return (
    <div
      style={{
        background: WINE_COLORS.surface,
        borderRadius: 12,
        border: `1px solid ${WINE_COLORS.dividerCard}`,
        boxShadow: WINE_COLORS.primaryShadowSubtle,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          borderBottom: `1px solid ${WINE_COLORS.dividerCard}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: WINE_COLORS.text }}>
            직원 메시지
          </div>
          {status === "resolved" && (
            <StatusBadge color={WINE_COLORS.success} label="전체 확정" />
          )}
          {status === "needs_review_items" && (
            <StatusBadge color="var(--status-warning)" label="확인 필요" />
          )}
        </div>
        <button
          onClick={onCopy}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            border: copied
              ? "1.5px solid rgba(16,185,129,0.3)"
              : `1.5px solid ${WINE_COLORS.primaryBorder}`,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            background: copied ? "rgba(16,185,129,0.06)" : "transparent",
            color: copied ? WINE_COLORS.success : WINE_COLORS.primary,
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

/** 상태 라벨 — 채운 배경 대신 색 도트 + 색 텍스트 */
function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
