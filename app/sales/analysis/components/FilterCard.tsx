"use client";

import { useEffect, useRef } from "react";
import type { SuggestionItem } from "../types";
import { DATE_PRESETS } from "../constants";
import { computePresetRange } from "../lib/format";
import { Section } from "@/app/components/ui";
import { inputStyle, selectStyle, labelStyle, btnPrimary, btnDisabled } from "@/app/styles/controls";

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
    <div style={{ marginBottom: 12 }}>
      <Section padding="sm">
        <div
          style={{
            display: "flex",
            alignItems: "end",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {p.isAdmin && (
            <Field minWidth={110}>
              <label style={labelStyle}>담당</label>
              <select
                value={p.manager}
                onChange={(e) => p.setManager(e.target.value)}
                style={selectStyle}
              >
                <option value="">전체</option>
                {p.filters.managers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field minWidth={120}>
            <label style={labelStyle}>기간</label>
            <select
              value={p.preset}
              onChange={(e) => applyPreset(e.target.value)}
              style={selectStyle}
            >
              {DATE_PRESETS.map((ps) => (
                <option key={ps.value} value={ps.value}>
                  {ps.label}
                </option>
              ))}
            </select>
          </Field>

          <Field minWidth={140}>
            <label style={labelStyle}>시작</label>
            <input
              type="date"
              value={p.startDate}
              min={p.dateRange?.min || ""}
              max={p.endDate || p.dateRange?.max || ""}
              onChange={(e) => {
                p.setStartDate(e.target.value);
                p.setPreset("");
              }}
              style={inputStyle}
            />
          </Field>

          <Field minWidth={140}>
            <label style={labelStyle}>종료</label>
            <input
              type="date"
              value={p.endDate}
              min={p.startDate || p.dateRange?.min || ""}
              max={p.dateRange?.max || ""}
              onChange={(e) => {
                p.setEndDate(e.target.value);
                p.setPreset("");
              }}
              style={inputStyle}
            />
          </Field>

          <Field minWidth={160} flex>
            <label style={labelStyle}>거래처</label>
            <div ref={suggestRef} style={{ position: "relative" }}>
              <input
                type="text"
                value={p.clientSearch}
                onChange={(e) => p.handleClientSearch(e.target.value)}
                onFocus={() => {
                  if (p.suggestions.length > 0) p.setShowSuggestions(true);
                }}
                placeholder="검색"
                style={{ ...inputStyle, paddingRight: p.clientCode ? 28 : 12 }}
              />
              {p.clientCode && (
                <button
                  onClick={p.clearClient}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: 13,
                    padding: 2,
                    lineHeight: 1,
                  }}
                  aria-label="거래처 선택 해제"
                >
                  ×
                </button>
              )}
              {p.showSuggestions && p.suggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    zIndex: 100,
                    background: "var(--surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    maxHeight: 240,
                    overflowY: "auto",
                  }}
                >
                  {p.suggestions.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => p.selectClient(s)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: 13,
                        border: "none",
                        borderBottom: "1px solid var(--border-subtle)",
                        background: "transparent",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background =
                          "var(--surface-hover)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                      }
                    >
                      <span style={{ color: "var(--text-primary)" }}>{s.name}</span>
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontSize: 11,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {s.code}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <button
            onClick={p.onLoad}
            disabled={p.loading}
            style={p.loading ? btnDisabled(btnPrimary) : btnPrimary}
          >
            {p.loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </Section>
    </div>
  );
}

function Field({
  minWidth,
  flex,
  children,
}: {
  minWidth: number;
  flex?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: flex ? `1 1 ${minWidth}px` : `0 1 ${minWidth}px`,
        minWidth,
      }}
    >
      {children}
    </div>
  );
}
