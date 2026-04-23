"use client";

import type { ExpenseItem } from "../types";
import { cardStyle } from "../styles";

type Props = {
  items: ExpenseItem[];
  onRemove: (id: string) => void;
};

export function ItemListCard({ items, onRemove }: Props) {
  if (items.length === 0) return null;

  return (
    <div style={cardStyle}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#2c1810",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>추가된 항목 ({items.length}건)</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#5A1515" }}>
          합계 {items.reduce((s, i) => s + i.amount, 0).toLocaleString()}원
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: "#faf9f7",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            <span style={{ color: "#8a8580", fontWeight: 600, minWidth: 20 }}>{idx + 1}</span>
            <span style={{ color: "#8a8580", minWidth: 80 }}>{item.date}</span>
            <span
              style={{
                background: "rgba(90,21,21,0.06)",
                color: "#5A1515",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 5,
                flexShrink: 0,
              }}
            >
              {item.account_category}
            </span>
            <span style={{ flex: 1, color: "#2c1810", fontWeight: 500 }}>
              {item.description}
              {item.note && (
                <span style={{ color: "#8a8580", fontSize: 11, marginLeft: 4 }}>
                  ({item.note})
                </span>
              )}
            </span>
            <span
              style={{
                fontWeight: 700,
                color: "#2c1810",
                minWidth: 80,
                textAlign: "right",
              }}
            >
              {item.amount.toLocaleString()}
            </span>
            <button
              onClick={() => onRemove(item.id)}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                cursor: "pointer",
                fontSize: 16,
                padding: "0 4px",
                flexShrink: 0,
              }}
              title="삭제"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
