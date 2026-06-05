"use client";

import type React from "react";
import type { UpsellSuggestion } from "../../types";
import { fmt } from "../../lib/format";
import { SectionHeader } from "../SectionHeader";
import { DismissButton } from "../DismissButton";
import { MetricChip } from "../MetricChip";

type Props = {
  items: UpsellSuggestion[];
  count: number;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
};

export function UpsellSection(p: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader
        title="업셀 추천"
        titleColor="var(--status-success)"
        count={p.count}
        collapsed={p.collapsed}
        onToggle={() => p.setCollapsed(!p.collapsed)}
      />

      {!p.collapsed && (
        <>
          {p.count === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "#bbb", fontSize: 13 }}>
              업셀 추천이 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.items.map((u, idx) => (
              <div
                key={`${u.client_code}-${u.suggested_item_no}-${idx}`}
                style={{
                  background: "white",
                  borderRadius: 12,
                  borderLeft: "4px solid var(--status-success)",
                  boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
                  padding: "14px 16px",
                  position: "relative",
                }}
              >
                <DismissButton
                  onDismiss={(e) =>
                    p.dismissItem(`upsell_${u.client_code}_${u.suggested_item_no}`, e)
                  }
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--status-success-bg)",
                      color: "var(--status-success)",
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    업셀
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
                    {u.client_name}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "40%",
                    }}
                  >
                    {u.current_item_name}
                  </span>
                  <span style={{ color: "var(--status-success)", fontWeight: 700, fontSize: 14 }}>→</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--status-success)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "50%",
                    }}
                  >
                    {u.suggested_item_name}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>
                  <span style={{ color: "var(--status-success)", fontWeight: 600 }}>+{u.price_diff_pct}%</span>
                  <span style={{ marginLeft: 4 }}>
                    ({fmt(u.current_price)}원 → {fmt(u.suggested_price)}원)
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {u.match_reason.split(" · ").map((r, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--status-success-bg)",
                        color: "var(--status-success)",
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {r}
                    </span>
                  ))}
                  <MetricChip label="재고" value={`${u.available_stock}병`} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

