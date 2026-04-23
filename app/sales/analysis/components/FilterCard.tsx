"use client";

import { useEffect, useRef } from "react";
import type { SuggestionItem } from "../types";
import { DATE_PRESETS } from "../constants";
import { computePresetRange } from "../lib/format";

type Props = {
  isAdmin: boolean;
  filters: { managers: string[]; departments: string[] };
  dateRange: { min: string; max: string } | null;
  manager: string;
  setManager: (v: string) => void;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  preset: string;
  setPreset: (v: string) => void;
  clientSearch: string;
  clientCode: string;
  handleClientSearch: (v: string) => void;
  clearClient: () => void;
  suggestions: SuggestionItem[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  selectClient: (c: SuggestionItem) => void;
  loading: boolean;
  onLoad: () => void;
};

export function FilterCard(p: Props) {
  const suggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        p.setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [p]);

  const applyPreset = (preset: string) => {
    p.setPreset(preset);
    const r = computePresetRange(preset);
    if (r) {
      p.setStartDate(r.start);
      p.setEndDate(r.end);
    }
  };

  return (
    <div className="analysis-card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        {p.isAdmin && (
          <div style={{ flex: "1 1 100px", minWidth: 80 }}>
            <Label>담당</Label>
            <select value={p.manager} onChange={(e) => p.setManager(e.target.value)} style={SELECT}>
              <option value="">전체</option>
              {p.filters.managers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ flex: "1 1 100px", minWidth: 80 }}>
          <Label>기간</Label>
          <select value={p.preset} onChange={(e) => applyPreset(e.target.value)} style={SELECT}>
            {DATE_PRESETS.map((ps) => (
              <option key={ps.value} value={ps.value}>
                {ps.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 110px", minWidth: 100 }}>
          <Label>시작</Label>
          <input
            type="date"
            value={p.startDate}
            min={p.dateRange?.min || ""}
            max={p.endDate || p.dateRange?.max || ""}
            onChange={(e) => {
              p.setStartDate(e.target.value);
              p.setPreset("");
            }}
            style={{ ...INPUT, boxSizing: "border-box" }}
          />
        </div>
        <div style={{ flex: "1 1 110px", minWidth: 100 }}>
          <Label>종료</Label>
          <input
            type="date"
            value={p.endDate}
            min={p.startDate || p.dateRange?.min || ""}
            max={p.dateRange?.max || ""}
            onChange={(e) => {
              p.setEndDate(e.target.value);
              p.setPreset("");
            }}
            style={{ ...INPUT, boxSizing: "border-box" }}
          />
        </div>
        <div ref={suggestRef} style={{ flex: "1 1 140px", minWidth: 120, position: "relative" }}>
          <Label>거래처</Label>
          <input
            type="text"
            value={p.clientSearch}
            onChange={(e) => p.handleClientSearch(e.target.value)}
            onFocus={() => {
              if (p.suggestions.length > 0) p.setShowSuggestions(true);
            }}
            placeholder="검색..."
            style={{ ...INPUT, boxSizing: "border-box" }}
          />
          {p.clientCode && (
            <button
              onClick={p.clearClient}
              style={{
                position: "absolute",
                right: 6,
                top: 22,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#a8a098",
                fontSize: "0.85rem",
              }}
            >
              x
            </button>
          )}
          {p.showSuggestions && p.suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 100,
                background: "#fff",
                border: "1.5px solid rgba(90,21,21,0.08)",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(90,21,21,0.08)",
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {p.suggestions.map((s) => (
                <div
                  key={s.code}
                  onClick={() => p.selectClient(s)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    borderBottom: "1px solid #f0f0f0",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#faf5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <span style={{ color: "#2c1810" }}>{s.name}</span>
                  <span style={{ color: "#a8a098", fontSize: "0.72rem" }}>{s.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: "0 0 auto", background: "#F0EFED", borderRadius: 6, padding: 2 }}>
          <button
            onClick={p.onLoad}
            disabled={p.loading}
            style={{
              padding: "5px 12px",
              borderRadius: 5,
              border: "none",
              background: "white",
              color: "#5A1515",
              fontWeight: 600,
              fontSize: "0.72rem",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(90,21,21,0.05)",
              transition: "all 0.2s ease",
              opacity: p.loading ? 0.6 : 1,
            }}
          >
            {p.loading ? "조회중" : "조회"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: "0.65rem",
        fontWeight: 600,
        color: "#8a8580",
        display: "block",
        marginBottom: 3,
      }}
    >
      {children}
    </label>
  );
}

const SELECT: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1.5px solid rgba(90,21,21,0.08)",
  fontSize: 16,
  background: "#fff",
  color: "#2c1810",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1.5px solid rgba(90,21,21,0.08)",
  fontSize: 16,
  background: "#fff",
  color: "#2c1810",
};
