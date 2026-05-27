"use client";

import type { ImportScheduleItem } from "@/app/types/wine";

type Props = {
  importDates: string[];
  importByDate: Record<string, { brands: string[]; items: ImportScheduleItem[] }>;
  onOpenDate: (date: string) => void;
};

/**
 * 데스크탑 전용 입항일 사이드바.
 * 주황 톤은 입항 의미를 유지하고 외곽은 다른 카드와 동일.
 */
export function ImportSidebar(p: Props) {
  const totalItems = Object.values(p.importByDate).reduce((a, v) => a + v.items.length, 0);

  return (
    <aside
      className="import-sidebar-desktop"
      style={{
        width: 200,
        flexShrink: 0,
        background: "var(--surface)",
        borderRadius: 10,
        border: "1px solid var(--border-default)",
        overflow: "hidden",
        alignSelf: "flex-start",
      }}
    >
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--surface)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#E65100",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          입항일
        </span>
        {p.importDates.length > 0 && (
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {p.importDates.length}일 · {totalItems}건
          </span>
        )}
      </header>
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {p.importDates.length === 0 && (
          <div
            style={{
              padding: "20px 16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            현재 월 + 다음 월 기준<br />
            수입 일정이 없습니다.
          </div>
        )}
        {p.importDates.map((dateStr) => {
          const info = p.importByDate[dateStr];
          const d = new Date(dateStr + "T00:00:00");
          const label = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
          return (
            <button
              key={dateStr}
              onClick={() => p.onOpenDate(dateStr)}
              style={{
                width: "100%",
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                textAlign: "left",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#E65100",
                  flexShrink: 0,
                  width: 42,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {info.brands.join(", ")}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
