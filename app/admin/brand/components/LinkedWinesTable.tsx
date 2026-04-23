"use client";

import type { LinkedWine } from "../types";

export function LinkedWinesTable({ wines }: { wines: LinkedWine[] }) {
  if (wines.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "#a8a098", padding: 12 }}>
        연결된 와인이 없습니다
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(90,21,21,0.08)" }}>
            {["품번", "와인명", "타입", "가격", "재고"].map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: i >= 3 ? "right" : "left",
                  padding: "6px 8px",
                  color: "#a8a098",
                  fontWeight: 500,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {wines.map((w) => (
            <tr key={w.item_code} style={{ borderBottom: "1px solid rgba(90,21,21,0.04)" }}>
              <td style={{ padding: "6px 8px", color: "#5A1515", fontWeight: 500 }}>
                {w.item_code}
              </td>
              <td style={{ padding: "6px 8px", color: "#2c1810" }}>{w.item_name_kr}</td>
              <td style={{ padding: "6px 8px", color: "#8a8580" }}>{w.wine_type || "-"}</td>
              <td style={{ padding: "6px 8px", color: "#2c1810", textAlign: "right" }}>
                {w.supply_price ? `${w.supply_price.toLocaleString()}원` : "-"}
              </td>
              <td
                style={{
                  padding: "6px 8px",
                  textAlign: "right",
                  color: (w.available_stock ?? 0) <= 0 ? "#dc3545" : "#2c1810",
                }}
              >
                {w.available_stock ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
