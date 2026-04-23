"use client";

import { fmtFull } from "../lib/format";

type Props = {
  totalRevenue: number;
  avgDiscount: number;
};

export function SummaryCards({ totalRevenue, avgDiscount }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div className="analysis-card">
        <div style={{ fontSize: "0.72rem", color: "#a8a098", fontWeight: 500, marginBottom: 8 }}>
          총 매출
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2c1810" }}>
          {fmtFull(totalRevenue || 0)}
        </div>
      </div>
      <div className="analysis-card">
        <div style={{ fontSize: "0.72rem", color: "#a8a098", fontWeight: 500, marginBottom: 8 }}>
          평균 지원률
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2c1810" }}>
          {(avgDiscount || 0).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
