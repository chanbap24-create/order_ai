"use client";

import { fmt, fmtFull } from "../lib/format";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "../lib/recharts";
import { EmptyChart } from "./EmptyChart";

type PriceItem = { band: number; value: number; cnt: number };

export function PriceDistributionChart({ data }: { data?: PriceItem[] }) {
  return (
    <div className="analysis-card" style={{ marginTop: 20 }}>
      <div className="analysis-chart-title">가격대별 분포</div>
      {data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
            <XAxis
              dataKey="band"
              tickFormatter={(v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}만` : `${v}`)}
              style={{ fontSize: "0.7rem" }}
            />
            <YAxis tickFormatter={fmt} style={{ fontSize: "0.7rem" }} />
            <Tooltip
              formatter={(v: number, name: string) => [
                name === "value" ? fmtFull(v) : `${v}종`,
                name === "value" ? "매출" : "품목수",
              ]}
              labelFormatter={(v: number) => `공급가 ${(v / 10000).toFixed(0)}만원대`}
            />
            <Legend />
            <Bar dataKey="value" name="매출" fill="#9B6B8A" radius={[4, 4, 0, 0]} animationDuration={500} />
            <Bar dataKey="cnt" name="품목수" fill="#C4A882" radius={[4, 4, 0, 0]} animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </div>
  );
}
