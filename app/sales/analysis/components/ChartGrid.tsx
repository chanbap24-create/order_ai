"use client";

import { Cell } from "recharts";
import { PALETTE } from "../constants";
import { fmt, fmtFull } from "../lib/format";
import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "../lib/recharts";
import { EmptyChart } from "./EmptyChart";

type ChartItem = { name: string; value: number };

type Props = {
  byCountry?: ChartItem[];
  byRegion?: ChartItem[];
  byType?: ChartItem[];
  byGrape?: ChartItem[];
};

export function ChartGrid(p: Props) {
  return (
    <div className="analysis-grid2" style={{ marginBottom: 20 }}>
      <PieCard title="국가별 매출" data={p.byCountry} />
      <RegionBarCard title="지역별 매출 (TOP 10)" data={p.byRegion} labelWidth={75} marginLeft={80} />
      <PieCard title="타입별 매출" data={p.byType} />
      <RegionBarCard title="품종별 매출 (TOP 10)" data={p.byGrape} labelWidth={95} marginLeft={100} />
    </div>
  );
}

function PieCard({ title, data }: { title: string; data?: ChartItem[] }) {
  return (
    <div className="analysis-card">
      <div className="analysis-chart-title">{title}</div>
      {data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              animationDuration={500}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              style={{ fontSize: "0.7rem" }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmtFull(v)} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </div>
  );
}

function RegionBarCard({
  title,
  data,
  labelWidth,
  marginLeft,
}: {
  title: string;
  data?: ChartItem[];
  labelWidth: number;
  marginLeft: number;
}) {
  return (
    <div className="analysis-card">
      <div className="analysis-chart-title">{title}</div>
      {data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ left: marginLeft, right: 10, top: 0, bottom: 0 }}>
            <XAxis type="number" tickFormatter={fmt} style={{ fontSize: "0.7rem" }} />
            <YAxis type="category" dataKey="name" width={labelWidth} style={{ fontSize: "0.68rem" }} />
            <Tooltip formatter={(v: number) => fmtFull(v)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={500}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </div>
  );
}
