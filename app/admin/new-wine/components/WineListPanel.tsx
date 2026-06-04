"use client";

import { useRef } from "react";
import type { WineWithStatus } from "../types";
import { statusBadge } from "../constants";

type Props = {
  wines: WineWithStatus[];
  loading: boolean;
  selectedId: string | null;
  checkedIds: Set<string>;
  onSelect: (wine: WineWithStatus) => void;
  toggleCheck: (id: string) => void;
  toggleAllChecks: () => void;
};

export function WineListPanel(p: Props) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{
        width: 340,
        minWidth: 300,
        overflowY: "auto",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "2px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "sticky",
          top: 0,
          background: "#f9fafb",
          zIndex: 1,
        }}
      >
        <input
          type="checkbox"
          checked={p.wines.length > 0 && p.checkedIds.size === p.wines.length}
          onChange={p.toggleAllChecks}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>전체선택</span>
      </div>

      {p.loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>로딩 중...</div>
      ) : p.wines.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>
          신규 와인이 없습니다.
        </div>
      ) : (
        p.wines.map((w) => {
          const badge = statusBadge(w.wine_status);
          const isSelected = p.selectedId === w.item_code;
          return (
            <div
              key={w.item_code}
              onClick={() => p.onSelect(w)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderBottom: "1px solid #f3f4f6",
                cursor: "pointer",
                background: isSelected ? "#eff6ff" : "#fff",
                borderLeft: isSelected ? "3px solid var(--status-info)" : "3px solid transparent",
              }}
            >
              <input
                type="checkbox"
                checked={p.checkedIds.has(w.item_code)}
                onChange={(e) => {
                  e.stopPropagation();
                  p.toggleCheck(w.item_code);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
              />
              <span style={{ fontSize: 14 }}>{badge.icon}</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1e293b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {w.item_name_kr}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  {w.item_code} {w.item_name_en ? `· ${w.item_name_en}` : ""}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: badge.bg,
                  color: badge.color,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {badge.label}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
