"use client";

import type { ImportScheduleItem } from "@/app/types/wine";

type Props = {
  visible: boolean;
  importDates: string[];
  importByDate: Record<string, { brands: string[]; items: ImportScheduleItem[] }>;
  onClose: () => void;
  onOpenDate: (date: string) => void;
};

/** 모바일 입항일 슬라이드 패널 */
export function ImportMobilePanel(p: Props) {
  if (!p.visible) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      <div
        onClick={p.onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.4)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 260,
          background: "#fff",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s ease-out",
        }}
      >
        <div
          style={{
            padding: "16px",
            background: "#FFF3E0",
            borderBottom: "1px solid #FFE0B2",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "#E65100" }}>입항일</span>
          <button
            onClick={p.onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#a8a098",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {p.importDates.map((dateStr) => {
            const info = p.importByDate[dateStr];
            const d = new Date(dateStr + "T00:00:00");
            const label = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
            return (
              <div
                key={dateStr}
                onClick={() => p.onOpenDate(dateStr)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f8f6f0",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#E65100",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
                <span style={{ fontSize: 13, color: "#5D4037", fontWeight: 500 }}>
                  {info.brands.join(", ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
