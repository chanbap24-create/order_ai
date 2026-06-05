"use client";

import type { ManagerStat } from "../types";

type Props = { activeData: ManagerStat };

export function ClientsTab({ activeData }: Props) {
  const clients = activeData.top_clients || [];
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "30px 1fr 90px 80px 80px",
          padding: "8px 20px",
          fontSize: 10,
          color: "#bbb",
          fontWeight: 500,
          borderBottom: "1px solid var(--gray-200)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.03em",
        }}
      >
        <div>#</div>
        <div>거래처</div>
        <div>업종</div>
        <div style={{ textAlign: "right" }}>품목</div>
        <div style={{ textAlign: "right" }}>구매</div>
      </div>
      {clients.map((c, i) => (
        <div
          key={c.client_name}
          style={{
            display: "grid",
            gridTemplateColumns: "30px 1fr 90px 80px 80px",
            padding: "8px 20px",
            borderBottom: i < clients.length - 1 ? "1px solid var(--gray-100)" : "none",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: i < 3 ? "#222" : "var(--gray-300)" }}>
            {i + 1}
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#222" }}>{c.client_name}</div>
          <div style={{ fontSize: 11, color: "#999" }}>{c.business_type || ""}</div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#999" }}>{c.item_count}</div>
          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#222" }}>
            {c.total_qty.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
