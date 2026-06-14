"use client";

import { ORDER_COLORS } from "../../order-v2/constants";
import type { StockItem } from "../hooks/useStockQuery";

const n = (v: number | null | undefined) => (v == null ? 0 : Math.round(Number(v)));
const fmt = (v: number | null | undefined) => n(v).toLocaleString();

/** 가용재고 수준별 색 (0=빨강, 소량=주황, 충분=초록) */
function stockColor(avail: number, sold30: number): string {
  if (avail <= 0) return ORDER_COLORS.confLow;
  if (sold30 > 0 && avail < sold30) return "#c8862a"; // 한 달 판매량보다 적음 = 주의
  return ORDER_COLORS.confHigh;
}

export function StockResultCard({ item }: { item: StockItem }) {
  const avail = n(item.available_stock);
  const sold30 = n(item.sales_30days);
  const color = stockColor(avail, sold30);

  return (
    <div
      style={{
        background: ORDER_COLORS.surface,
        border: "1px solid var(--action-muted)",
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: ORDER_COLORS.text, flex: 1, minWidth: 200 }}>
          {item.item_name}
          <span style={{ fontSize: 12, fontWeight: 500, color: ORDER_COLORS.textMuted, marginLeft: 8 }}>{item.item_no}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{fmt(avail)}</div>
          <div style={{ fontSize: 11, color: ORDER_COLORS.textMuted }}>가용재고</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 12.5, color: ORDER_COLORS.text }}>
        <span>총재고 <b>{fmt(item.total_stock)}</b></span>
        {n(item.pending_shipment) > 0 && <span style={{ color: ORDER_COLORS.textMuted }}>출고예정 {fmt(item.pending_shipment)}</span>}
        <span style={{ color: ORDER_COLORS.textMuted }}>30일판매 {fmt(item.sales_30days)}</span>
        {n(item.supply_price) > 0 && <span style={{ color: ORDER_COLORS.textMuted }}>공급가 {fmt(item.supply_price)}</span>}
      </div>

      {item.incoming && item.incoming.length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(120,160,90,0.10)", fontSize: 12.5, color: ORDER_COLORS.confHigh, fontWeight: 600 }}>
          📦 입고예정 {item.incoming.map((x) => `${x.arrival_date} (${fmt(x.total_btls)})`).join(" · ")}
        </div>
      )}
      {avail <= 0 && (!item.incoming || item.incoming.length === 0) && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: ORDER_COLORS.confLow, fontWeight: 600 }}>
          ⚠ 재고 없음 · 입고예정 없음
        </div>
      )}
    </div>
  );
}
