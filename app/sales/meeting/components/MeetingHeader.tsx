"use client";

import type { ViewMode } from "../types";

type Props = {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  isAdmin: boolean;
  managers: string[];
  filterManager: string;
  setFilterManager: (v: string) => void;
  rangeLabel: string;
  weekStart: Date;
  prevPeriod: () => void;
  nextPeriod: () => void;
  goToday: () => void;
};

export function MeetingHeader(p: Props) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 16,
        boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
        border: "1px solid rgba(90,21,21,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          background: "#f5f3ed",
          borderRadius: 8,
          padding: 3,
          marginBottom: 12,
          gap: 2,
        }}
      >
        {(["week", "month"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => p.setViewMode(mode)}
            style={{
              flex: 1,
              padding: "7px 0",
              borderRadius: 6,
              border: "none",
              background: p.viewMode === mode ? "#fff" : "transparent",
              color: p.viewMode === mode ? "#5A1515" : "#999",
              fontWeight: p.viewMode === mode ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: p.viewMode === mode ? "0 1px 3px rgba(90,21,21,0.05)" : "none",
              transition: "all 0.2s",
            }}
          >
            {mode === "week" ? "주간" : "월간"}
          </button>
        ))}
      </div>

      {p.isAdmin && p.managers.length > 0 && (
        <select
          value={p.filterManager}
          onChange={(e) => p.setFilterManager(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid rgba(90,21,21,0.08)",
            fontSize: 16,
            background: "#fff",
            color: p.filterManager ? "#2c1810" : "#999",
            outline: "none",
            width: "100%",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        >
          <option value="">전체 담당자</option>
          {p.managers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={p.prevPeriod}
          style={{
            background: "none",
            border: "1px solid rgba(90,21,21,0.08)",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 14,
            color: "#8a8580",
          }}
        >
          ←
        </button>
        <div style={{ textAlign: "center" }}>
          <button
            onClick={p.goToday}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 700,
              color: "#2c1810",
            }}
          >
            {p.rangeLabel}
          </button>
          {p.viewMode === "week" && (
            <div style={{ fontSize: 11, color: "#a8a098" }}>{p.weekStart.getFullYear()}</div>
          )}
        </div>
        <button
          onClick={p.nextPeriod}
          style={{
            background: "none",
            border: "1px solid rgba(90,21,21,0.08)",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 14,
            color: "#8a8580",
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
