"use client";

import type React from "react";
import type { NewArrivalMatch } from "../../types";
import { fmt, importanceStars } from "../../lib/format";
import { SectionHeader } from "../SectionHeader";
import { DismissButton } from "../DismissButton";

type Props = {
  items: NewArrivalMatch[];
  count: number;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
};

export function NewArrivalSection(p: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader
        title="신규 입고 매칭"
        titleColor="#00838F"
        count={p.count}
        collapsed={p.collapsed}
        onToggle={() => p.setCollapsed(!p.collapsed)}
      />

      {!p.collapsed && (
        <>
          {p.count === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "#bbb", fontSize: 13 }}>
              신규 입고 와인이 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {p.items.map((wine, idx) => (
              <div
                key={`${wine.item_no}-${idx}`}
                style={{
                  background: "white",
                  borderRadius: 12,
                  borderLeft: "4px solid #00838F",
                  boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
                  padding: "14px 16px",
                  position: "relative",
                }}
              >
                <DismissButton onDismiss={(e) => p.dismissItem(`arrival_${wine.item_no}`, e)} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "#E0F7FA",
                      color: "#00838F",
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    NEW
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
                    {wine.item_name}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>
                  {[
                    wine.country,
                    wine.grape,
                    wine.wine_type,
                    wine.supply_price > 0 ? `₩${fmt(wine.supply_price)}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>

                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                  재고: <strong style={{ color: "#00838F" }}>{wine.available_stock}병</strong>
                  {wine.incoming_stock > 0 && (
                    <>
                      <span style={{ margin: "0 6px", color: "var(--gray-300)" }}>|</span>
                      입고예정:{" "}
                      <strong style={{ color: "#00838F" }}>{wine.incoming_stock}병</strong>
                    </>
                  )}
                </div>

                {wine.matched_clients.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--action-muted)", paddingTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 8 }}>
                      추천 거래처
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {wine.matched_clients.map((c, ci) => (
                        <div
                          key={c.client_code}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            color: "var(--neutral-600)",
                            padding: "6px 8px",
                            background: ci === 0 ? "#F0FAFB" : "var(--gray-50)",
                            borderRadius: 8,
                          }}
                        >
                          <span style={{ ...rankStyle, color: "#00838F" }}>{ci + 1}.</span>
                          {c.importance != null && c.importance >= 1 && c.importance <= 5 && (
                            <span style={{ fontSize: 11, color: "#F59E0B", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {importanceStars(c.importance)}
                            </span>
                          )}
                          <span style={nameStyle}>{c.client_name}</span>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: c.match_score >= 60 ? "#E0F7FA" : "var(--surface-muted)",
                              color: c.match_score >= 60 ? "#00838F" : "var(--neutral-200)",
                              fontSize: 11,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {c.match_score}점
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--text-muted)",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {c.match_reasons.join("·")}
                          </span>
                        </div>
                      ))}
                    </div>
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

const rankStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 13,
  minWidth: 18,
  textAlign: "center",
  flexShrink: 0,
};

const nameStyle: React.CSSProperties = {
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};
