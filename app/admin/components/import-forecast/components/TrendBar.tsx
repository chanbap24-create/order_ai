"use client";

import type React from "react";
import type { ManagerStat, TrendData } from "../types";

type Props = {
  trend: TrendData | null;
  mergedData: ManagerStat | null;
  results: ManagerStat[];
  country: string;
  wineType: string;
};

export function TrendBar(p: Props) {
  if (!p.trend || Object.keys(p.trend.items).length === 0 || !p.mergedData) return null;

  const t = p.trend.items;
  const total = t["전사"];
  const countryKey = p.country ? "country:" + p.country : null;
  const countryTrend = countryKey && t[countryKey] ? t[countryKey] : null;
  const typeKey = p.wineType ? "type:" + p.wineType : null;
  const typeTrend = typeKey && t[typeKey] ? t[typeKey] : null;

  const resultRegions = new Set<string>();
  const resultBrands = new Set<string>();
  for (const w of p.mergedData.wine_details || []) {
    if (w.region) resultRegions.add(w.region);
  }
  for (const r of p.results) {
    for (const w of r.wine_details || []) {
      for (const k of Object.keys(t)) {
        if (
          k.startsWith("brand:") &&
          w.item_name.includes(k.replace("brand:", "").substring(0, 4))
        ) {
          resultBrands.add(k);
        }
      }
    }
  }

  const topRegions = Object.keys(t)
    .filter((k) => k.startsWith("region:") && resultRegions.has(k.replace("region:", "")))
    .sort((a, b) => t[b].cur + t[b].prev - (t[a].cur + t[a].prev))
    .slice(0, 3);

  let brandKeys = [...resultBrands]
    .filter((k) => t[k])
    .sort((a, b) => t[b].cur + t[b].prev - (t[a].cur + t[a].prev))
    .slice(0, 3);
  if (brandKeys.length === 0 && countryKey) {
    brandKeys = Object.keys(t)
      .filter((k) => k.startsWith("brand:") && t[k].prev + t[k].cur > 50)
      .sort((a, b) => t[b].cur + t[b].prev - (t[a].cur + t[a].prev))
      .slice(0, 3);
  }

  const renderPct = (pct: number) => {
    const color = pct > 10 ? "var(--status-success)" : pct < -10 ? "var(--status-danger)" : "var(--text-tertiary)";
    const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
    return (
      <span style={{ fontWeight: 700, color }}>
        {arrow}
        {pct > 0 ? "+" : ""}
        {pct}%
      </span>
    );
  };

  return (
    <div
      style={{
        background: "#fafafa",
        borderRadius: 6,
        padding: "12px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 8 }}>
        트렌드 {p.trend.prevYear}→{p.trend.year}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
        {total && (
          <div style={item}>
            <span style={{ color: "var(--text-tertiary)" }}>전사</span> {renderPct(total.pct)}
            <span style={{ fontSize: 10, color: "#b0a8a0" }}>
              {total.prev.toLocaleString()}→{total.cur.toLocaleString()}
            </span>
          </div>
        )}
        {countryTrend && countryKey && (
          <div style={item}>
            <span style={{ color: "var(--text-tertiary)" }}>{countryKey.replace("country:", "")}</span>{" "}
            {renderPct(countryTrend.pct)}
          </div>
        )}
        {topRegions.map((k) => (
          <div key={k} style={item}>
            <span style={{ color: "var(--text-tertiary)" }}>
              {k.replace("region:", "").substring(0, 15)}
            </span>{" "}
            {renderPct(t[k].pct)}
          </div>
        ))}
        {typeTrend && typeKey && (
          <div style={item}>
            <span style={{ color: "var(--text-tertiary)" }}>{typeKey.replace("type:", "")}</span>{" "}
            {renderPct(typeTrend.pct)}
          </div>
        )}
        {brandKeys.slice(0, 3).map((k) => (
          <div key={k} style={item}>
            <span style={{ color: "var(--text-tertiary)" }}>{k.replace("brand:", "")}</span>{" "}
            {renderPct(t[k].pct)}
          </div>
        ))}
      </div>
    </div>
  );
}

const item: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
