"use client";

import type React from "react";
import type { StockDepletion } from "../../types";
import { fmt } from "../../lib/format";
import { SectionHeader } from "../SectionHeader";
import { DismissButton } from "../DismissButton";
import { MetricChip, chipGrid } from "../MetricChip";

type Props = {
  items: StockDepletion[];
  count: number;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
};

export function StockSection(p: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader
        title="재고 소진 위험"
        titleColor="#B71C1C"
        count={p.count}
        collapsed={p.collapsed}
        onToggle={() => p.setCollapsed(!p.collapsed)}
      />

      {!p.collapsed && (
        <>
          {p.count === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "#bbb", fontSize: 13 }}>
              재고 소진 위험 품목이 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.items.map((sd, idx) => {
              const isOos = sd.alert_type === "out_of_stock";

              return (
                <div
                  key={`${sd.item_no}-${idx}`}
                  style={{
                    background: isOos ? "var(--gray-50)" : "white",
                    borderRadius: 12,
                    borderLeft: `4px solid ${isOos ? "#B71C1C" : "var(--status-warning)"}`,
                    boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
                    padding: "14px 16px",
                    position: "relative",
                  }}
                >
                  <DismissButton onDismiss={(e) => p.dismissItem(`stock_${sd.item_no}`, e)} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, paddingRight: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isOos ? "var(--status-danger-bg)" : "var(--status-warning-bg)",
                          color: isOos ? "#B71C1C" : "var(--status-warning)",
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {isOos ? "품절" : "재고부족"}
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
                        {sd.item_name}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>
                    현재 재고:{" "}
                    <strong style={{ color: isOos ? "#B71C1C" : "var(--status-warning)" }}>{sd.current_stock}병</strong>
                    <span style={{ margin: "0 6px", color: "var(--gray-300)" }}>|</span>
                    임계치: {sd.threshold}병
                    {sd.days_remaining !== null && (
                      <>
                        <span style={{ margin: "0 6px", color: "var(--gray-300)" }}>|</span>
                        잔여:{" "}
                        <strong style={{ color: sd.days_remaining < 14 ? "#B71C1C" : "var(--status-warning)" }}>
                          {sd.days_remaining}일
                        </strong>
                      </>
                    )}
                  </div>

                  <div style={{ ...chipGrid, marginTop: 6 }}>
                    <MetricChip label="12개월 출고" value={`${sd.total_shipped}병`} />
                    <MetricChip label="공급가" value={`${fmt(sd.supply_price)}원`} />
                  </div>
                  {sd.affected_clients.length > 0 && (
                    <div style={{ marginTop: 6 }}>
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
                        영향 거래처 {sd.affected_clients.length}곳
                      </span>
                    </div>
                  )}

                  {sd.affected_clients.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                      {sd.affected_clients.map((c) => c.client_name).join(", ")}
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
