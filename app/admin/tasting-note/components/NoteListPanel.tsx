"use client";

import { useRef } from "react";
import type { TastingWineRow } from "../types";
import { noteBadge, verificationBadge } from "../constants";

type Props = {
  wines: TastingWineRow[];
  loading: boolean;
  ghIndex: Record<string, boolean>;
  selectedId: string | null;
  checkedIds: Set<string>;
  onSelect: (wine: TastingWineRow) => void;
  toggleCheck: (id: string) => void;
  toggleAllChecks: () => void;
};

export function NoteListPanel(p: Props) {
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
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
          전체선택 ({p.wines.length})
        </span>
      </div>

      {p.loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>로딩 중...</div>
      ) : p.wines.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>
          해당하는 와인이 없습니다.
        </div>
      ) : (
        p.wines.map((w) => {
          const badge = noteBadge(w, p.ghIndex);
          const isSelected = p.selectedId === w.item_code;
          const totalStock = (w.inv_available || 0) + (w.inv_bonded || 0);
          const vb = verificationBadge(w.verification_status);

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
                borderLeft: isSelected ? "3px solid #2563eb" : "3px solid transparent",
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
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2, display: "flex", gap: 6 }}>
                  <span>
                    재고{" "}
                    <b style={{ color: (w.inv_available || 0) > 0 ? "#16a34a" : "#d1d5db" }}>
                      {w.inv_available ?? 0}
                    </b>
                  </span>
                  <span>
                    보세{" "}
                    <b style={{ color: (w.inv_bonded || 0) > 0 ? "#0ea5e9" : "#d1d5db" }}>
                      {w.inv_bonded ?? 0}
                    </b>
                  </span>
                  <span>
                    합계 <b style={{ color: totalStock > 0 ? "#1e293b" : "#d1d5db" }}>{totalStock}</b>
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                {vb && (
                  <span
                    title={vb.title}
                    style={{
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 8,
                      background: vb.bg,
                      color: vb.color,
                      fontWeight: 700,
                      lineHeight: "16px",
                    }}
                  >
                    {vb.label}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: badge.bg,
                    color: badge.color,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
