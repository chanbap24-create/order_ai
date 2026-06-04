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
          borderRadius: 10,
          border: "1px solid rgba(90,21,21,0.15)",
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
          borderRadius: 10,
          border: "none",
          background: disabled
            ? "#d8d3ce"
            : "linear-gradient(135deg, var(--action) 0%, #7a2828 50%, var(--action) 100%)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          letterSpacing: "0.04em",
          boxShadow: disabled ? "none" : "0 4px 16px rgba(90,21,21,0.15)",
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
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid rgba(90,21,21,0.1)",
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
