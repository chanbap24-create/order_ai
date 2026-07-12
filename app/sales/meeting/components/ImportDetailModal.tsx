"use client";

import type { ImportScheduleItem } from "@/app/types/wine";

type Props = {
  date: string | null;
  items: ImportScheduleItem[];
  brands: string[];
  onClose: () => void;
};

/** 특정 날짜 입항 품목 상세 팝업 */
export function ImportDetailModal(p: Props) {
  if (!p.date) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={p.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "20px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--status-warning)" }}>
              {p.date.replace(/-/g, ".")} 입항 품목
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              {p.items.length}건 · 브랜드: {p.brands.join(", ")}
            </div>
          </div>
          <button
            onClick={p.onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 22,
              color: "var(--text-muted)",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {p.items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "#FFF8E1",
                border: "1px solid #FFE0B2",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 6,
                    background: "var(--status-warning)",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {item.brand_code}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{item.item_code}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                {item.item_name_en || item.item_name_kr}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-tertiary)" }}>
                {item.vintage && <span>VT {item.vintage}</span>}
                <span>{(item.total_btls || 0).toLocaleString()} btls</span>
                {item.bl_number && <span>BL# {item.bl_number}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
