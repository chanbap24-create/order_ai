"use client";

import type { InvColumnConfig, InvColumnKey } from "../types";

type Props = {
  availableColumns: InvColumnConfig[];
  visibleColumns: InvColumnKey[];
  onToggle: (key: InvColumnKey) => void;
};

/** 재고 테이블 표시 컬럼 선택 패널 (품번·품명은 고정 제외) */
export function InvColumnSettings({ availableColumns, visibleColumns, onToggle }: Props) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "14px 16px",
        background: "white",
        borderRadius: 12,
        border: "1px solid var(--gray-100)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2D2D2D" }}>
          표시 컬럼
        </span>
        <span style={{ fontSize: "0.68rem", color: "var(--neutral-100)" }}>품번·품명은 항상 표시</span>
      </div>
      <div
        className="inv-col-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}
      >
        {availableColumns
          .filter((c) => c.key !== "item_no" && c.key !== "item_name")
          .map((col) => (
            <button
              key={`${col.key}-${col.label}`}
              className={`inv-col-chip${visibleColumns.includes(col.key) ? " active" : ""}`}
              onClick={() => onToggle(col.key)}
            >
              {col.label}
            </button>
          ))}
      </div>
    </div>
  );
}
