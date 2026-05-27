"use client";

import { fmtFull } from "../lib/format";

type Props = {
  totalRevenue: number;
  avgDiscount: number;
};

/**
 * 분석 탭 요약 — ShipmentTab 의 stat row 와 동일 패턴.
 * (label + 큰 값)
 */
export function SummaryCards({ totalRevenue, avgDiscount }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <Stat label="총 매출" value={fmtFull(totalRevenue || 0)} accent />
      <Stat label="평균 지원률" value={`${(avgDiscount || 0).toFixed(1)}%`} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent ? "var(--action)" : "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
