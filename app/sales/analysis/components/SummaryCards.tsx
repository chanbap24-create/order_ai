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
  // 스탯 스트립 — 박스 없이 상하 헤어라인 + 세로 구분 (브리핑·미수·거래처와 동일 문법)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderTop: "1px solid var(--border-default)",
        borderBottom: "1px solid var(--border-default)",
        marginBottom: 16,
      }}
    >
      <Stat label="총 매출" value={fmtFull(totalRevenue || 0)} />
      <Stat label="평균 지원률" value={`${(avgDiscount || 0).toFixed(1)}%`} divider />
    </div>
  );
}

function Stat({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "14px 18px",
        borderLeft: divider ? "1px solid var(--border-default)" : "none",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
