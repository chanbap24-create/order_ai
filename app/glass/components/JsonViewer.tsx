"use client";

import { GLASS_COLORS } from "../constants";
import { monoStyle } from "./styles";

type Props = {
  data: unknown;
  open: boolean;
  toggleOpen: () => void;
};

/**
 * 전체 API 응답을 JSON으로 보여주는 접기/펼치기 뷰어.
 */
export function JsonViewer({ data, open, toggleOpen }: Props) {
  return (
    <div style={{ marginTop: 18 }}>
      <button
        onClick={toggleOpen}
        style={{
          width: "100%",
          padding: 12,
          background: GLASS_COLORS.surfaceBgAlt,
          border: `1px solid ${GLASS_COLORS.dividerCardLight}`,
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
            border: `1px solid ${GLASS_COLORS.dividerCard}`,
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
