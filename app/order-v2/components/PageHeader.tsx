"use client";

import { ORDER_COLORS, ORDER_FONT } from "../constants";

/** "Order · AI Parsing" 타이틀 섹션 */
export function PageHeader() {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h1
          style={{
            fontFamily: ORDER_FONT.display,
            fontSize: 28,
            fontWeight: 600,
            color: ORDER_COLORS.textTitle,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Order
        </h1>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: ORDER_COLORS.primary,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            opacity: 0.6,
          }}
        >
          AI Parsing
        </span>
      </div>
      <div
        style={{
          width: 32,
          height: 2,
          marginTop: 10,
          background: "linear-gradient(90deg, #5A1515, rgba(90,21,21,0.15))",
          borderRadius: 1,
        }}
      />
    </div>
  );
}
