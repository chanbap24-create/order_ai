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
          color: "var(--text-primary)",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>추가된 항목 ({items.length}건)</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--action)" }}>
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
              background: "var(--surface-muted)",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--text-tertiary)", fontWeight: 600, minWidth: 20 }}>{idx + 1}</span>
            <span style={{ color: "var(--text-tertiary)", minWidth: 80 }}>{item.date}</span>
            <span
              style={{
                background: "var(--action-muted)",
                color: "var(--action)",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 5,
                flexShrink: 0,
              }}
            >
              {item.account_category}
            </span>
            <span style={{ flex: 1, color: "var(--text-primary)", fontWeight: 500 }}>
              {item.description}
              {item.note && (
                <span style={{ color: "var(--text-tertiary)", fontSize: 11, marginLeft: 4 }}>
                  ({item.note})
                </span>
              )}
            </span>
            <span
              style={{
                fontWeight: 700,
                color: "var(--text-primary)",
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
                color: "var(--status-danger)",
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
