"use client";

import { useEffect, useState } from "react";
import type { LearningCurve, ManagerStat, PriceStats } from "../types";
import { SimulationScenarios } from "./SimulationScenarios";

type Props = {
  mergedData: ManagerStat | null;
  results: ManagerStat[];
  isNewItem: boolean;
  learningCurve: LearningCurve | null;
  priceStats: PriceStats | null;
};

export function SimulationCard({ mergedData, isNewItem, priceStats }: Props) {
  const [simOpen, setSimOpen] = useState(false);
  const [importCases, setImportCases] = useState(10);
  const [bottlesPerCase, setBottlesPerCase] = useState(12);

  const avgImportCost = (() => {
    const details = mergedData?.wine_details || [];
    const withCost = details.filter((w) => w.avg_import_cost > 0);
    if (withCost.length > 0)
      return Math.round(withCost.reduce((s, w) => s + w.avg_import_cost, 0) / withCost.length);
    return priceStats?.avg || 50000;
  })();
  const [costPrice, setCostPrice] = useState(avgImportCost);
  const [marginPct, setMarginPct] = useState(20);

  useEffect(() => {
    if (avgImportCost > 0) setCostPrice(avgImportCost);
  }, [avgImportCost]);

  if (!mergedData || !mergedData.wine_details?.length) return null;

  const baseQty = isNewItem
    ? mergedData.qty_per_item_year1 ?? mergedData.qty_per_item
    : mergedData.qty_per_item;
  if (!baseQty || baseQty <= 0) return null;

  const wines = (mergedData.wine_details || [])
    .map((w) => ({
      name: w.item_name,
      annual: w.annual_avg_corrected,
      price: w.avg_selling_price,
    }))
    .filter((w) => w.annual >= 6)
    .sort((a, b) => a.annual - b.annual);

  const scenarios = [
    { label: "보수적", value: Math.round(baseQty * 0.6), color: "#95a5a6", icon: "▽" },
    { label: "기본", value: baseQty, color: "var(--action)", icon: "■" },
    { label: "낙관적", value: Math.round(baseQty * 1.5), color: "#27ae60", icon: "△" },
  ];

  const importBottles = importCases * bottlesPerCase;
  const totalInvestment = importBottles * costPrice;
  const sellingPrice = Math.round(costPrice * (1 + marginPct / 100));

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid var(--gray-200)",
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setSimOpen(!simOpen)}
        style={{
          padding: "12px 24px",
          borderBottom: simOpen ? "1px solid var(--gray-200)" : "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-800)" }}>투자 시뮬레이션</div>
        <span style={{ fontSize: 11, color: "var(--neutral-100)" }}>{simOpen ? "▲" : "▼"}</span>
      </div>

      {simOpen && (
        <>
          {/* 입력 */}
          <div
            style={{
              padding: "14px 24px",
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              borderBottom: "1px solid var(--gray-200)",
            }}
          >
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={labelS}>수입량</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={importCases}
                  onChange={(e) => setImportCases(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--action)" }}
                />
                <input
                  type="number"
                  value={importCases}
                  onChange={(e) => setImportCases(Math.max(1, Number(e.target.value) || 1))}
                  style={numInput}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                {[6, 12].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBottlesPerCase(n)}
                    style={{
                      padding: "2px 8px",
                      fontSize: 10,
                      fontWeight: 500,
                      border: `1px solid ${bottlesPerCase === n ? "var(--neutral-900)" : "var(--gray-200)"}`,
                      borderRadius: 3,
                      background: bottlesPerCase === n ? "var(--neutral-900)" : "#fff",
                      color: bottlesPerCase === n ? "#fff" : "var(--neutral-100)",
                      cursor: "pointer",
                    }}
                  >
                    {n}병
                  </button>
                ))}
                <span style={{ fontSize: 10, color: "#bbb", marginLeft: 4 }}>
                  {importBottles.toLocaleString()}병 ·{" "}
                  {Math.round(totalInvestment / 10000).toLocaleString()}만원
                </span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={labelS}>수입원가</div>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
                style={textInput}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={labelS}>마진율</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range"
                  min={5}
                  max={200}
                  value={marginPct}
                  onChange={(e) => setMarginPct(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--action)" }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-800)", minWidth: 36 }}>
                  {marginPct}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
                판매가 {sellingPrice.toLocaleString()}원
              </div>
            </div>
          </div>

          {/* 시나리오 */}
          <div style={{ padding: "14px 24px" }}>
            <SimulationScenarios
              scenarios={scenarios}
              importBottles={importBottles}
              costPrice={costPrice}
              sellingPrice={sellingPrice}
              totalInvestment={totalInvestment}
              lc={1}
            />

            {wines.length > 0 && (
              <div style={{ borderTop: "1px solid var(--gray-200)", paddingTop: 10 }}>
                <div style={{ fontSize: 10, color: "#bbb", marginBottom: 6 }}>
                  기대값 {baseQty}병/년 · {wines.length}개 와인 기반
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {wines.map((w, i) => (
                    <span
                      key={i}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 3,
                        fontSize: 10,
                        background: "var(--gray-100)",
                        color: "var(--neutral-500)",
                      }}
                    >
                      {w.name.substring(0, 15)}
                      {w.name.length > 15 ? "…" : ""} <strong>{w.annual}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const labelS: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--neutral-200)",
  marginBottom: 4,
};

const numInput: React.CSSProperties = {
  width: 48,
  padding: "3px 4px",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "center",
  border: "1px solid var(--gray-200)",
  borderRadius: 4,
  color: "var(--neutral-800)",
};

const textInput: React.CSSProperties = {
  width: "100%",
  padding: "5px 10px",
  fontSize: 13,
  border: "1px solid var(--gray-200)",
  borderRadius: 4,
  color: "var(--neutral-800)",
};
