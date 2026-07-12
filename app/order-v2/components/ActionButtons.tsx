"use client";

import { ORDER_COLORS } from "../constants";

type Props = {
  loading: boolean;
  orderTextTrim: boolean;
  hasResults: boolean;
  onPaste: () => void;
  onParse: () => void;
  onReset: () => void;
};

/** 붙여넣기 / 발주 분석 / 초기화 버튼 그룹 */
export function ActionButtons({
  loading,
  orderTextTrim,
  hasResults,
  onPaste,
  onParse,
  onReset,
}: Props) {
  const disabled = loading || !orderTextTrim;

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={onPaste}
        style={{
          padding: "13px 18px",
          borderRadius: 12,
          border: "1px solid var(--border-strong)",
          background: "#fff",
          fontSize: 13,
          fontWeight: 600,
          color: ORDER_COLORS.primary,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        붙여넣기
      </button>

      <button
        onClick={onParse}
        disabled={disabled}
        className="order-btn-parse"
        style={{
          flex: 1,
          padding: "13px 0",
          borderRadius: 12,
          border: "none",
          background: disabled
            ? "#d8d3ce"
            : "var(--action)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          letterSpacing: "0.04em",
          boxShadow: disabled ? "none" : "0 4px 16px rgba(0,0,0,0.15)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {loading ? <LoadingLabel /> : "발주 분석"}
      </button>

      {hasResults && (
        <button
          onClick={onReset}
          style={{
            padding: "13px 22px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid var(--border-default)",
            background: "#fff",
            color: ORDER_COLORS.textMuted,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          초기화
        </button>
      )}
    </div>
  );
}

function LoadingLabel() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 14,
          height: 14,
          border: "2px solid rgba(255,255,255,0.3)",
          borderTopColor: "#fff",
          borderRadius: "50%",
          animation: "orderShimmer 0.8s linear infinite",
          display: "inline-block",
        }}
      />
      분석 중...
    </span>
  );
}
