"use client";

import type React from "react";
import type { ActionSummary, ReorderFilter, ReorderNudge } from "../../types";
import { importanceStars } from "../../lib/format";
import { SectionHeader } from "../SectionHeader";
import { DismissButton } from "../DismissButton";

type Props = {
  filtered: ReorderNudge[];
  count: number;
  summary: ActionSummary;
  reorderFilter: ReorderFilter;
  setReorderFilter: (f: ReorderFilter) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
};

export function ReorderSection(p: Props) {
  const filters = [
    { id: "all" as ReorderFilter, label: "전체", count: p.count, activeColor: "var(--status-info)", activeBg: "var(--status-info-bg)" },
    { id: "in_stock" as ReorderFilter, label: "재고有", count: p.summary.reorder_in_stock, activeColor: "var(--status-success)", activeBg: "var(--status-success-bg)" },
    { id: "out_of_stock" as ReorderFilter, label: "품절", count: p.summary.reorder_out_of_stock, activeColor: "#9E9E9E", activeBg: "var(--surface-muted)" },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader
        title="재주문 타이밍"
        titleColor="var(--status-info)"
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
                  onClick={() => p.setReorderFilter(f.id)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    border: p.reorderFilter === f.id ? `1.5px solid ${f.activeColor}` : "1px solid rgba(90,21,21,0.08)",
                    background: p.reorderFilter === f.id ? f.activeBg : "white",
                    fontSize: 11,
                    fontWeight: p.reorderFilter === f.id ? 600 : 400,
                    color: p.reorderFilter === f.id ? f.activeColor : "#999",
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
              재주문이 필요한 품목이 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.filtered.map((nudge, idx) => {
              const isOos = nudge.stock_status === "out_of_stock";
              const isLow = nudge.stock_status === "low_stock";
              const stockColor = isOos ? "#9E9E9E" : isLow ? "var(--status-warning)" : "var(--status-success)";
              const stockBg = isOos ? "var(--surface-muted)" : isLow ? "var(--status-warning-bg)" : "var(--status-success-bg)";
              const stockLabel = isOos ? "품절" : `재고 ${nudge.available_stock}병`;

              return (
                <div
                  key={`${nudge.client_code}-${nudge.item_no}-${idx}`}
                  style={{
                    background: isOos ? "#FAFAFA" : "white",
                    borderRadius: 12,
                    borderLeft: `4px solid ${isOos ? "#E0E0E0" : nudge.urgency === "high" ? "var(--status-info)" : "#64B5F6"}`,
                    boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
                    padding: "14px 16px",
                    opacity: isOos ? 0.65 : 1,
                    position: "relative",
                  }}
                >
                  <DismissButton onDismiss={(e) => p.dismissItem(`reorder_${nudge.client_code}_${nudge.item_no}`, e)} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, paddingRight: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isOos ? "var(--surface-muted)" : nudge.urgency === "high" ? "var(--status-info-bg)" : "#F3F8FF",
                          color: isOos ? "#9E9E9E" : nudge.urgency === "high" ? "var(--status-info)" : "#64B5F6",
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {nudge.urgency === "high" ? "긴급" : "주의"}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: isOos ? "#999" : "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {nudge.client_name}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: stockBg,
                          color: stockColor,
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {stockLabel}
                      </span>
                      {nudge.importance != null && nudge.importance >= 1 && nudge.importance <= 5 && (
                        <span style={{ fontSize: 12, color: "#F59E0B", whiteSpace: "nowrap" }}>
                          {importanceStars(nudge.importance)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: isOos ? "#999" : "#333",
                      marginBottom: 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {nudge.item_name}
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                    평균 주기: <strong>{nudge.avg_interval_days}일</strong>
                    <span style={{ margin: "0 6px", color: "#ddd" }}>|</span>
                    마지막 구매:{" "}
                    <strong style={{ color: nudge.days_since_last >= nudge.avg_interval_days * 1.5 ? "var(--status-danger)" : "var(--status-info)" }}>
                      {nudge.days_since_last}일 전
                    </strong>
                    <span style={{ color: "#bbb", marginLeft: 4 }}>({nudge.last_purchase_date})</span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--status-warning-bg)",
                        color: "var(--status-warning)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {nudge.overdue_days}일 초과
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--surface-muted)",
                        color: "var(--text-tertiary)",
                        fontSize: 11,
                      }}
                    >
                      {nudge.purchase_count}회 구매 ({nudge.total_qty}병)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
