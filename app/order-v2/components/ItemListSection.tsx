"use client";

import { ORDER_COLORS } from "../constants";

type Props = {
  count: number;
  children: React.ReactNode;
};

/** 품목 상세 헤더 + 목록 컨테이너 (children으로 OrderLineCard 나열) */
export function ItemListSection({ count, children }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: ORDER_COLORS.textMuted,
          marginBottom: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>품목 상세</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "#b8b0a8",
            padding: "1px 6px",
            background: "rgba(90,21,21,0.04)",
            borderRadius: 4,
          }}
        >
          {count}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}
