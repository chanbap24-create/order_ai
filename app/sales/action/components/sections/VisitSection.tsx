"use client";

import type React from "react";
import type { VisitFilter, VisitSchedule } from "../../types";
import {
  CONTACT_TYPE_LABELS,
  VISIT_URGENCY_BG,
  VISIT_URGENCY_COLORS,
  VISIT_URGENCY_LABELS,
} from "../../constants";
import { importanceStars } from "../../lib/format";
import { SectionHeader } from "../SectionHeader";
import { DismissButton } from "../DismissButton";

type Props = {
  items: VisitSchedule[];
  filtered: VisitSchedule[];
  count: number;
  visitFilter: VisitFilter;
  setVisitFilter: (f: VisitFilter) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
};

export function VisitSection(p: Props) {
  const filters: { id: VisitFilter; label: string; count: number }[] = [
    { id: "all", label: "전체", count: p.count },
    { id: "critical", label: "긴급", count: p.items.filter((v) => v.visit_urgency === "critical").length },
    { id: "high", label: "주의", count: p.items.filter((v) => v.visit_urgency === "high").length },
    { id: "medium", label: "관찰", count: p.items.filter((v) => v.visit_urgency === "medium").length },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader
        title="방문 추천"
        titleColor="#795548"
        count={p.count}
        collapsed={p.collapsed}
        onToggle={() => p.setCollapsed(!p.collapsed)}
      />

      {!p.collapsed && (
        <>
          {p.count > 0 && (
            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => p.setVisitFilter(f.id)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    border:
                      p.visitFilter === f.id
                        ? `1.5px solid ${f.id === "all" ? "#795548" : VISIT_URGENCY_COLORS[f.id] || "#795548"}`
                        : "1px solid rgba(90,21,21,0.08)",
                    background:
                      p.visitFilter === f.id
                        ? f.id === "all"
                          ? "#EFEBE9"
                          : VISIT_URGENCY_BG[f.id] || "#EFEBE9"
                        : "white",
                    fontSize: 11,
                    fontWeight: p.visitFilter === f.id ? 600 : 400,
                    color:
                      p.visitFilter === f.id
                        ? f.id === "all"
                          ? "#795548"
                          : VISIT_URGENCY_COLORS[f.id] || "#795548"
                        : "#999",
                    cursor: "pointer",
                  }}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          )}

          {p.count === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "#bbb", fontSize: 13 }}>
              방문이 필요한 거래처가 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.filtered.map((v) => (
              <div
                key={v.client_code}
                style={{
                  background: "white",
                  borderRadius: 12,
                  borderLeft: `4px solid ${VISIT_URGENCY_COLORS[v.visit_urgency] || "#795548"}`,
                  boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
                  padding: "14px 16px",
                  position: "relative",
                }}
              >
                <DismissButton onDismiss={(e) => p.dismissItem(`visit_${v.client_code}`, e)} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                    paddingRight: 28,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: VISIT_URGENCY_BG[v.visit_urgency],
                        color: VISIT_URGENCY_COLORS[v.visit_urgency],
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {VISIT_URGENCY_LABELS[v.visit_urgency]} {v.visit_score}
                    </span>
                    {v.importance != null && v.importance >= 1 && v.importance <= 5 && (
                      <span style={{ fontSize: 12, color: "#F59E0B", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {importanceStars(v.importance)}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.client_name}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 6 }}>
                  마지막 접촉:{" "}
                  <strong style={{ color: v.days_since_contact >= 60 ? "#4E342E" : "#333" }}>
                    {v.days_since_contact}일 전
                  </strong>
                  <span style={{ color: "#bbb", marginLeft: 6 }}>({v.last_contact_date})</span>
                  <span
                    style={{
                      display: "inline-block",
                      marginLeft: 6,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "var(--surface-muted)",
                      color: "var(--text-tertiary)",
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    {CONTACT_TYPE_LABELS[v.last_contact_type] || v.last_contact_type}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 8 }}>
                  방문주기: <strong>{v.visit_cycle_days}일</strong>
                  {v.days_overdue > 0 && (
                    <span style={{ marginLeft: 8, color: "#4E342E", fontWeight: 600 }}>
                      → {v.days_overdue}일 초과
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: v.suggested_type === "visit" ? "#EFEBE9" : "#F3E5F5",
                      color: v.suggested_type === "visit" ? "#4E342E" : "#6A1B9A",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {v.suggested_type === "visit" ? "방문 권장" : "전화 권장"}
                  </span>
                  {v.importance !== null && v.importance <= 2 && (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "#FFF8E1",
                        color: "#F57F17",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {v.importance === 1 ? "VIP" : "주요거래처"}
                    </span>
                  )}
                </div>

                {v.top_items.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                    주요 품목: {v.top_items.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
