"use client";

import type React from "react";
import type { ActionSummary, SeasonRecommendation } from "../../types";
import { fmt, importanceStars } from "../../lib/format";
import { SectionHeader } from "../SectionHeader";
import { DismissButton } from "../DismissButton";

type Props = {
  items: SeasonRecommendation[];
  rawItems: SeasonRecommendation[];
  count: number;
  summary: ActionSummary;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
};

export function SeasonSection(p: Props) {
  const suffix = p.summary.season_name ? (
    <span style={{ fontSize: 11, color: "#5C6BC0", fontWeight: 500 }}>
      다음달 {p.summary.season_reco_count > 0 ? p.rawItems[0]?.target_month : ""}월 ·{" "}
      {p.summary.season_name}
      {p.rawItems[0]?.season_change ? " (시즌 전환)" : ""}
    </span>
  ) : null;

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader
        title="시즌 선제 추천"
        titleColor="var(--action)"
        count={p.count}
        collapsed={p.collapsed}
        onToggle={() => p.setCollapsed(!p.collapsed)}
        suffix={suffix}
      />

      {!p.collapsed && (
        <>
          {p.count === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "#bbb", fontSize: 13 }}>
              시즌 추천 와인이 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {p.items.slice(0, 20).map((wine, idx) => (
              <div
                key={`${wine.item_no}-${idx}`}
                style={{
                  background: "white",
                  borderRadius: 12,
                  borderLeft: `4px solid ${wine.season_change ? "#3d0e0e" : "var(--action)"}`,
                  boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
                  padding: "14px 16px",
                  position: "relative",
                }}
              >
                <DismissButton onDismiss={(e) => p.dismissItem(`season_${wine.item_no}`, e)} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(90,21,21,0.06)",
                      color: "var(--action)",
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {wine.season_name}
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
                    wine.wine_type,
                    wine.grape,
                    wine.supply_price > 0 ? `₩${fmt(wine.supply_price)}` : "",
                    `재고 ${wine.available_stock}병`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>

                {wine.matched_clients.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(90,21,21,0.06)", paddingTop: 10 }}>
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
                            color: "#444",
                            padding: "6px 8px",
                            background: ci === 0 ? "#EDE7F6" : "#FAFAFA",
                            borderRadius: 8,
                          }}
                        >
                          <span style={{ ...rankStyle, color: "var(--action)" }}>{ci + 1}.</span>
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
                              background: c.match_score >= 70 ? "rgba(90,21,21,0.06)" : "var(--surface-muted)",
                              color: c.match_score >= 70 ? "var(--action)" : "#888",
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
