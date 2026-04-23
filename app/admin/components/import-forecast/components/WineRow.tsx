"use client";

import type { WineDetail, WineShipment } from "../types";
import { WineShipmentsDetail } from "./WineShipmentsDetail";

const GRID = "36px 1fr 70px 70px 70px 60px 50px 90px";

type Props = {
  w: WineDetail;
  isLast: boolean;
  isChecked: boolean;
  isExpanded: boolean;
  onToggleExclude: () => void;
  onClick: () => void;
  wineShipments: WineShipment[];
  shipLoading: boolean;
  shipShowAll: boolean;
  setShipShowAll: React.Dispatch<React.SetStateAction<boolean>>;
};

export function WineRow(p: Props) {
  const { w } = p;
  const hasStockout = w.stockout_factor > 1;

  return (
    <div
      style={{
        borderBottom: p.isLast ? "none" : "1px solid #f5f5f5",
        opacity: p.isChecked ? 0.4 : 1,
        transition: "opacity 0.15s",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          padding: "8px 20px",
          alignItems: "center",
        }}
      >
        <div>
          <input
            type="checkbox"
            checked={p.isChecked}
            onChange={p.onToggleExclude}
            style={{ width: 14, height: 14, accentColor: "#c0392b", cursor: "pointer" }}
          />
        </div>
        <div style={{ cursor: "pointer" }} onClick={p.onClick}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: p.isChecked ? "#bbb" : "#222",
              lineHeight: 1.3,
              display: "flex",
              alignItems: "center",
              gap: 6,
              textDecoration: p.isChecked ? "line-through" : "none",
            }}
          >
            {w.item_name}
            {hasStockout && !p.isChecked && (
              <span style={{ fontSize: 9, color: "#e67e22", fontWeight: 600 }}>
                ×{w.stockout_factor}
              </span>
            )}
            <span style={{ fontSize: 9, color: "#ccc" }}>{p.isExpanded ? "▲" : "▼"}</span>
          </div>
          <div style={{ fontSize: 10, color: "#bbb", marginTop: 1 }}>
            {w.item_code}
            {w.region ? ` · ${w.region}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#999" }}>
          {w.supply_price?.toLocaleString()}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#222", fontWeight: 500 }}>
            {w.avg_selling_price?.toLocaleString()}
          </div>
          {w.avg_selling_price !== w.supply_price && w.supply_price > 0 && (
            <div
              style={{
                fontSize: 10,
                color: w.avg_selling_price < w.supply_price ? "#e67e22" : "#27ae60",
              }}
            >
              {w.avg_selling_price < w.supply_price ? "" : "+"}
              {Math.round(((w.avg_selling_price - w.supply_price) / w.supply_price) * 100)}%
            </div>
          )}
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: 12,
            color: w.avg_import_cost > 0 ? "#666" : "#ddd",
          }}
        >
          {w.avg_import_cost > 0 ? w.avg_import_cost.toLocaleString() : "-"}
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }}>
          {w.avg_import_cost > 0 && w.avg_selling_price > 0 ? (
            (() => {
              const profit = w.avg_selling_price - w.avg_import_cost;
              const pct = Math.round((profit / w.avg_import_cost) * 100);
              return (
                <div
                  style={{ color: profit >= 0 ? "#27ae60" : "#c0392b", fontWeight: 500 }}
                >
                  {pct >= 0 ? "+" : ""}
                  {pct}%
                </div>
              );
            })()
          ) : (
            <span style={{ color: "#ddd" }}>-</span>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#999" }}>{w.client_count}</div>
        <div style={{ textAlign: "right" }}>
          <span
            style={{ fontSize: 14, fontWeight: 600, color: p.isChecked ? "#ccc" : "#222" }}
          >
            {w.corrected_qty.toLocaleString()}
          </span>
          {hasStockout && !p.isChecked && (
            <span
              style={{
                fontSize: 10,
                color: "#bbb",
                textDecoration: "line-through",
                marginLeft: 4,
              }}
            >
              {w.total_qty.toLocaleString()}
            </span>
          )}
          <div style={{ fontSize: 10, color: "#bbb" }}>avg {w.annual_avg_corrected}/y</div>
        </div>
      </div>

      {p.isExpanded && (
        <div
          style={{ padding: "0 20px 12px 56px", background: "#fafafa" }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <WineShipmentsDetail
            shipments={p.wineShipments}
            loading={p.shipLoading}
            shipShowAll={p.shipShowAll}
            setShipShowAll={p.setShipShowAll}
            supplyPrice={w.supply_price}
          />
        </div>
      )}
    </div>
  );
}
