"use client";

import { WINE_COLORS } from "../constants";
import { monoStyle } from "./styles";

type Props = {
  data: unknown;
  open: boolean;
  toggleOpen: () => void;
};

/** API 응답 JSON 토글 뷰어 */
export function JsonViewer({ data, open, toggleOpen }: Props) {
  return (
    <div style={{ marginTop: 18 }}>
      <button
        onClick={toggleOpen}
        style={{
          width: "100%",
          padding: 12,
          background: WINE_COLORS.surfaceBgAlt,
          border: `1px solid ${WINE_COLORS.dividerCardLight}`,
          borderRadius: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>JSON</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${WINE_COLORS.dividerCard}`,
            background: "#0b1020",
            color: "var(--gray-200)",
            overflowX: "auto",
            marginTop: 8,
            ...monoStyle,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
