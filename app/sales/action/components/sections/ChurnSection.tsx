"use client";

import type React from "react";
import type { ActionItem, ActionSummary, ChurnFilter } from "../../types";
import { RISK_BG, RISK_COLORS, RISK_LABELS } from "../../constants";
import { fmt, importanceStars } from "../../lib/format";
import { SectionHeader } from "../SectionHeader";
import { DismissButton } from "../DismissButton";

type Props = {
  items: ActionItem[];
  filtered: ActionItem[];
  count: number;
  summary: ActionSummary;
  churnFilter: ChurnFilter;
  setChurnFilter: (f: ChurnFilter) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  expandedClient: string | null;
  recentOrders: Record<string, any[]>;
  loadingOrders: string | null;
  onCardClick: (clientCode: string) => void;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
};

export function ChurnSection(p: Props) {
  const filters: { id: ChurnFilter; label: string; count: number }[] = [
    { id: "all", label: "전체", count: p.count },
    { id: "critical", label: "긴급", count: p.summary.critical_count },
    { id: "high", label: "주의", count: p.summary.high_count },
    { id: "medium", label: "관찰", count: p.summary.medium_count },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader
        title="이탈 위험 거래처"
        titleColor="var(--status-danger)"
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
                  onClick={() => p.setChurnFilter(f.id)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    border:
                      p.churnFilter === f.id
                        ? `1.5px solid ${f.id === "all" ? "var(--action)" : RISK_COLORS[f.id] || "var(--action)"}`
                        : "1px solid rgba(90,21,21,0.08)",
                    background:
                      p.churnFilter === f.id
                        ? f.id === "all"
                          ? "#faf5f5"
                          : RISK_BG[f.id] || "#faf5f5"
                        : "white",
                    fontSize: 11,
                    fontWeight: p.churnFilter === f.id ? 600 : 400,
                    color:
                      p.churnFilter === f.id
                        ? f.id === "all"
                          ? "var(--action)"
                          : RISK_COLORS[f.id] || "var(--action)"
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
              이탈 위험 거래처가 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.filtered.map((item) => {
              const isExpanded = p.expandedClient === item.client_code;
              const orders = p.recentOrders[item.client_code];
              return (
                <div
                  key={item.client_code}
                  onClick={() => p.onCardClick(item.client_code)}
                  style={{
                    background: "white",
                    borderRadius: 12,
                    borderLeft: `4px solid ${RISK_COLORS[item.risk_level]}`,
                    boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
                    padding: "14px 16px",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s",
                    position: "relative",
                  }}
                >
                  <DismissButton
                    onDismiss={(e) => p.dismissItem(`churn_${item.client_code}`, e)}
                  />
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
                          background: RISK_BG[item.risk_level],
                          color: RISK_COLORS[item.risk_level],
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {RISK_LABELS[item.risk_level]} {item.risk_score}
                      </span>
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
                        {item.client_name}
                      </span>
                    </div>
                    {item.importance != null && item.importance >= 1 && item.importance <= 5 && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#F59E0B",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          marginLeft: 8,
                        }}
                      >
                        {importanceStars(item.importance)}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 6 }}>
                    마지막 구매:{" "}
                    <strong style={{ color: item.days_since_last >= 60 ? "var(--status-danger)" : "#333" }}>
                      {item.days_since_last}일 전
                    </strong>
                    <span style={{ color: "#bbb", marginLeft: 6 }}>({item.last_purchase_date})</span>
                  </div>

                  <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 8 }}>
                    매출 추이: {fmt(item.prev_revenue)} → {fmt(item.recent_revenue)}
                    {item.revenue_change_pct !== 0 && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: item.revenue_change_pct < 0 ? "var(--status-danger)" : "var(--status-success)",
                          fontWeight: 600,
                        }}
                      >
                        ({item.revenue_change_pct > 0 ? "▲" : "▼"} {Math.abs(item.revenue_change_pct)}%)
                      </span>
                    )}
                  </div>

                  {item.risk_factors.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {item.risk_factors.map((f, i) => (
                        <span
                          key={i}
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "var(--surface-muted)",
                            color: "var(--text-tertiary)",
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.top_items.length > 0 && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      주요 품목: {item.top_items.join(", ")}
                    </div>
                  )}

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid rgba(90,21,21,0.06)",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 8 }}>
                        최근 주문 내역
                      </div>
                      {p.loadingOrders === item.client_code && (
                        <div style={{ fontSize: 12, color: "#bbb", padding: "8px 0" }}>
                          로딩 중...
                        </div>
                      )}
                      {orders && orders.length === 0 && (
                        <div style={{ fontSize: 12, color: "#bbb", padding: "8px 0" }}>
                          최근 주문 내역이 없습니다.
                        </div>
                      )}
                      {orders && orders.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {orders.map((o: any, idx: number) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: 12,
                                color: "#555",
                                padding: "4px 0",
                                borderBottom:
                                  idx < orders.length - 1
                                    ? "1px solid rgba(90,21,21,0.06)"
                                    : "none",
                              }}
                            >
                              <span
                                style={{
                                  flex: 1,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {o.item_name || o.item_no}
                              </span>
                              <span
                                style={{
                                  marginLeft: 8,
                                  color: "var(--text-muted)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {o.quantity || "-"}병
                              </span>
                              <span
                                style={{
                                  marginLeft: 8,
                                  color: "var(--text-muted)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {o.ship_date?.slice(0, 10) || ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
