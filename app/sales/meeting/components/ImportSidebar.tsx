"use client";

import type { ImportScheduleItem } from "@/app/types/wine";

type Props = {
  importDates: string[];
  importByDate: Record<string, { brands: string[]; items: ImportScheduleItem[] }>;
  onOpenDate: (date: string) => void;
};

/** 데스크탑 전용 입항일 사이드바 */
export function ImportSidebar(p: Props) {
  return (
    <div
      className="import-sidebar-desktop"
      style={{
        width: 180,
        flexShrink: 0,
        background: "#fff",
        borderRadius: 12,
        border: "1px solid rgba(90,21,21,0.06)",
        boxShadow: "0 1px 3px rgba(90,21,21,0.03)",
        overflow: "hidden",
        alignSelf: "flex-start",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          background: "#FFF3E0",
          borderBottom: "1px solid #FFE0B2",
          fontSize: 13,
          fontWeight: 700,
          color: "#E65100",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>입항일</span>
        {p.importDates.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 500, color: "#BF6000" }}>
            {p.importDates.length}일 /{" "}
            {Object.values(p.importByDate).reduce((a, v) => a + v.items.length, 0)}건
          </span>
        )}
      </div>
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {p.importDates.length === 0 && (
          <div style={{ padding: "16px 12px", textAlign: "center", color: "#a8a098", fontSize: 12 }}>
            현재 월 + 다음 월 기준<br />수입 일정이 없습니다.
          </div>
        )}
        {p.importDates.map((dateStr) => {
          const info = p.importByDate[dateStr];
          const d = new Date(dateStr + "T00:00:00");
          const label = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
          return (
            <div
              key={dateStr}
              onClick={() => p.onOpenDate(dateStr)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #f8f6f0",
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF8E1")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#E65100",
                  flexShrink: 0,
                  width: 40,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "#5D4037",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {info.brands.join(", ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
