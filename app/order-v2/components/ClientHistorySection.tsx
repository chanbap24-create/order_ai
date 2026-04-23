"use client";

import { ORDER_COLORS } from "../constants";
import { fmt } from "../lib/format";
import type { HistoryItem, OrderTab } from "../types";

type Props = {
  tab: OrderTab;
  items: HistoryItem[];
  loading: boolean;
  loaded: boolean;
  show: boolean;
  showOld: boolean;
  setShowOld: (v: boolean | ((p: boolean) => boolean)) => void;
  toggle: () => void;
};

/** 거래처 입고내역 (최근 1년 + 1년 이전 접기/펼치기) */
export function ClientHistorySection({
  tab,
  items,
  loading,
  loaded,
  show,
  showOld,
  setShowOld,
  toggle,
}: Props) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);
  const recentItems = items.filter((h) => (h.last_ship_date || "") >= cutoff);
  const oldItems = items.filter((h) => (h.last_ship_date || "") < cutoff);

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 0",
        }}
      >
        <ChevronArrow open={show} />
        <span style={{ fontSize: 12, fontWeight: 600, color: ORDER_COLORS.primary }}>
          입고내역
        </span>
        {loaded && (
          <span
            style={{
              fontSize: 10,
              color: ORDER_COLORS.textMuted,
              fontWeight: 500,
              padding: "1px 6px",
              background: "rgba(90,21,21,0.04)",
              borderRadius: 4,
            }}
          >
            {items.length}
          </span>
        )}
      </button>

      {show && (
        <div
          style={{
            marginTop: 6,
            border: "1px solid rgba(90,21,21,0.06)",
            borderRadius: 10,
            background: ORDER_COLORS.surfaceBg,
            overflow: "hidden",
            animation: "orderSlideIn 0.2s ease",
          }}
        >
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: ORDER_COLORS.textMuted }}>
              <span style={{ animation: "orderPulse 1.2s ease-in-out infinite" }}>
                불러오는 중...
              </span>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#b8b0a8" }}>
              입고내역이 없습니다
            </div>
          ) : (
            <>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {recentItems.length > 0 ? (
                  <HistoryTable tab={tab} items={recentItems} />
                ) : (
                  <div style={{ padding: 14, textAlign: "center", fontSize: 12, color: "#b8b0a8" }}>
                    최근 1년 내 입고내역 없음
                  </div>
                )}
              </div>

              {oldItems.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(90,21,21,0.06)" }}>
                  <button
                    onClick={() => setShowOld((v: boolean) => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      width: "100%",
                      padding: "9px 12px",
                      background: "rgba(90,21,21,0.02)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <ChevronArrow open={showOld} />
                    <span style={{ fontSize: 11, color: ORDER_COLORS.textMuted }}>
                      1년 이전 ({oldItems.length}건)
                    </span>
                  </button>
                  {showOld && (
                    <div style={{ maxHeight: 250, overflowY: "auto" }}>
                      <HistoryTable tab={tab} items={oldItems} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronArrow({ open }: { open: boolean }) {
  return (
    <span
      style={{
        fontSize: 8,
        color: ORDER_COLORS.textMuted,
        display: "inline-block",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
      }}
    >
      ▶
    </span>
  );
}

function HistoryTable({ tab, items }: { tab: OrderTab; items: HistoryItem[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid rgba(90,21,21,0.06)" }}>
          <Th align="left">품명</Th>
          <Th align="right">공급가</Th>
          {tab === "CDV" && <Th align="right">횟수</Th>}
          <Th align="right">최근입고</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((h, i) => (
          <tr
            key={i}
            className="order-history-row"
            style={{
              borderBottom: "1px solid rgba(90,21,21,0.03)",
              transition: "background 0.15s ease",
            }}
          >
            <td style={{ padding: "7px 12px", color: ORDER_COLORS.text }}>
              <div style={{ fontWeight: 500, lineHeight: 1.3, fontSize: 12 }}>{h.item_name}</div>
              <div style={{ fontSize: 10, color: "#b8b0a8", fontFamily: "'DM Sans', monospace" }}>
                {h.item_no}
              </div>
            </td>
            <td
              style={{
                padding: "7px 8px",
                textAlign: "right",
                color: ORDER_COLORS.text,
                whiteSpace: "nowrap",
                fontSize: 12,
              }}
            >
              {h.supply_price ? fmt(h.supply_price) : "-"}
            </td>
            {tab === "CDV" && (
              <td
                style={{
                  padding: "7px 8px",
                  textAlign: "right",
                  color: ORDER_COLORS.primary,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {h.buy_count || "-"}
              </td>
            )}
            <td
              style={{
                padding: "7px 12px",
                textAlign: "right",
                color: "#b8b0a8",
                whiteSpace: "nowrap",
                fontSize: 11,
              }}
            >
              {h.last_ship_date ? h.last_ship_date.slice(0, 10) : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children, align }: { children: React.ReactNode; align: "left" | "right" }) {
  return (
    <th
      style={{
        padding: "8px 12px",
        textAlign: align,
        fontWeight: 600,
        color: ORDER_COLORS.textMuted,
        fontSize: 10,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}
