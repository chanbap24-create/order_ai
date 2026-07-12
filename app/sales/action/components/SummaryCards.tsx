"use client";

import type { ActionSummary } from "../types";

type CardDef = { label: string; count: number; color: string; bg: string };

function CardRow({ cards, minWidth }: { cards: CardDef[]; minWidth: number }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {cards.map((s) => (
        <div
          key={s.label}
          style={{
            flex: `1 1 ${minWidth}px`,
            background: s.bg,
            borderRadius: 12,
            padding: "10px 8px",
            textAlign: "center",
            minWidth,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: s.color,
              fontWeight: 600,
              marginBottom: 2,
              whiteSpace: "nowrap",
            }}
          >
            {s.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>
            {s.count}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SummaryCards({ summary }: { summary: ActionSummary }) {
  const row1: CardDef[] = [
    { label: "이탈 긴급", count: summary.critical_count, color: "var(--status-danger)", bg: "var(--status-danger-bg)" },
    { label: "이탈 주의", count: summary.high_count, color: "var(--status-warning)", bg: "var(--status-warning-bg)" },
    { label: "재주문(재고有)", count: summary.reorder_in_stock, color: "var(--status-info)", bg: "var(--status-info-bg)" },
    { label: "재주문(품절)", count: summary.reorder_out_of_stock, color: "var(--gray-400)", bg: "var(--surface-muted)" },
  ];
  const row2: CardDef[] = [
    { label: "미팅 예정", count: summary.meetings_upcoming, color: "#6A1B9A", bg: "#F3E5F5" },
    { label: "재고 부족", count: summary.stock_alerts, color: "#B71C1C", bg: "var(--status-danger-bg)" },
    { label: "업셀 추천", count: summary.upsell_count, color: "var(--status-success)", bg: "var(--status-success-bg)" },
    { label: "신규 입고", count: summary.new_arrivals_count, color: "#00838F", bg: "#E0F7FA" },
    { label: "방문 추천", count: summary.visit_total, color: "#795548", bg: "#EFEBE9" },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {row1.map((s) => (
          <div
            key={s.label}
            style={{
              flex: "1 1 70px",
              background: s.bg,
              borderRadius: 12,
              padding: "10px 8px",
              textAlign: "center",
              minWidth: 70,
            }}
          >
            <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap" }}>
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>
      <CardRow cards={row2} minWidth={80} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div
          style={{
            flex: "1 1 120px",
            background: "var(--action-muted)",
            borderRadius: 12,
            padding: "10px 8px",
            textAlign: "center",
            minWidth: 120,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--action)", fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap" }}>
            시즌 추천 {summary.season_name ? `(${summary.season_name})` : ""}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--action)" }}>
            {summary.season_reco_count}
          </div>
        </div>
      </div>
    </>
  );
}
