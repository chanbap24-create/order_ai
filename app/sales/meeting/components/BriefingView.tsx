"use client";

import type { BriefingData } from "../types";
import { TAG_COLORS } from "../constants";
import { fmt } from "../lib/format";

type Props = {
  briefing: BriefingData;
  selectedRecs: Set<string>;
  toggleRec: (itemNo: string) => void;
};

export function BriefingView({ briefing, selectedRecs, toggleRec }: Props) {
  return (
    <>
      {/* 거래처 매출 요약 */}
      <div style={{ background: "#f8f6f0", borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
          거래처 매출 요약
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
          <Stat label="총 구매" value={`${briefing.client_summary.total_purchases}건`} />
          <Stat label="평균 단가" value={`${fmt(briefing.client_summary.avg_price)}원`} />
          <Stat label="최근 주문" value={briefing.client_summary.last_order_date || "-"} />
          <Stat
            label="추세"
            value={
              briefing.client_summary.trend === "up"
                ? "상승"
                : briefing.client_summary.trend === "down"
                  ? "하락"
                  : "유지"
            }
            valueColor={
              briefing.client_summary.trend === "up"
                ? "#2E7D32"
                : briefing.client_summary.trend === "down"
                  ? "#c62828"
                  : "#666"
            }
          />
        </div>
        {(briefing.client_summary.top_countries.length > 0 ||
          briefing.client_summary.top_grapes.length > 0) && (
          <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {briefing.client_summary.top_types.map((t) => (
              <TagChip key={t} text={t} bg="#e0f2f1" color="#00897B" />
            ))}
            {briefing.client_summary.top_countries.map((c) => (
              <TagChip key={c} text={c} bg="#ede7f6" color="#7B1FA2" />
            ))}
            {briefing.client_summary.top_grapes.map((g) => (
              <TagChip key={g} text={g} bg="#fce4ec" color="#c2185b" />
            ))}
          </div>
        )}
      </div>

      {/* 최근 주문 */}
      {briefing.recent_orders.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
            border: "1px solid rgba(90,21,21,0.06)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
            최근 주문 내역
          </div>
          {briefing.recent_orders.map((o, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom:
                  i < briefing.recent_orders.length - 1 ? "1px solid #f5f3ed" : "none",
                fontSize: 12,
              }}
            >
              <span
                style={{
                  color: "var(--text-primary)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {o.item_name}
              </span>
              <span style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }}>
                {o.quantity}개 · {o.ship_date?.slice(5)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 추천 와인 */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>추천 와인 {briefing.recommendations.length}개</span>
        <span style={{ fontSize: 11, color: "var(--action)", fontWeight: 500 }}>
          {selectedRecs.size}개 선택
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {briefing.recommendations.map((r) => {
          const isSelected = selectedRecs.has(r.item_no);
          return (
            <div
              key={r.item_no}
              onClick={() => toggleRec(r.item_no)}
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: "10px 12px",
                border: isSelected ? "2px solid var(--action)" : "1px solid rgba(90,21,21,0.06)",
                cursor: "pointer",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  flexShrink: 0,
                  border: isSelected ? "2px solid var(--action)" : "2px solid #ddd",
                  background: isSelected ? "var(--action)" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>
                  <span
                    style={{
                      color: r.score >= 20 ? "#c62828" : "#888",
                      marginRight: 6,
                      fontSize: 11,
                    }}
                  >
                    {r.score}점
                  </span>
                  {r.item_name}
                </div>
                {(r.country || r.grape) && (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>
                    {[r.country, r.region, r.grape].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {r.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 6,
                        background: `${TAG_COLORS[tag] || "#999"}18`,
                        color: TAG_COLORS[tag] || "#999",
                        fontWeight: 600,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                  {r.price ? fmt(r.price) + "원" : "-"}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>재고 {r.stock}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  valueColor = "var(--text-primary)",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: valueColor }}>{value}</div>
    </div>
  );
}

function TagChip({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 8,
        background: bg,
        color,
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}
