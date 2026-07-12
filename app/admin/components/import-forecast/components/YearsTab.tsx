"use client";

import type { LearningCurve, ManagerStat } from "../types";
import { YearBar } from "./YearBar";

type Props = {
  activeData: ManagerStat;
  isNewItem: boolean;
  learningCurve: LearningCurve | null;
};

export function YearsTab(p: Props) {
  const details = p.activeData.year_details || [];
  if (details.length === 0) return null;

  const singleYear = details.length === 1;
  const maxYr = Math.max(...details.map((d) => Number(d.year)));
  const getWeight = (yr: string) => {
    if (singleYear) return 1;
    const diff = maxYr - Number(yr);
    return diff === 0 ? 3 : diff === 1 ? 2 : 1;
  };
  const totalWeight = details.reduce((s, d) => s + getWeight(d.year), 0);
  const maxQ = Math.max(...details.map((y) => y.correctedQty), 1);
  const maxPerItem = Math.max(...details.map((y) => y.qtyPerItemCorrected), 1);

  return (
    <div style={{ padding: "20px 20px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--neutral-100)", marginBottom: 12 }}>
        연도별 판매량
      </div>
      {details.map((yd) => {
        const hasDiff = yd.correctedQty !== yd.qty;
        return (
          <YearBar
            key={yd.year}
            year={yd.year}
            pct={Math.round((yd.correctedQty / maxQ) * 100)}
            weight={getWeight(yd.year)}
            singleYear={singleYear}
            label={
              <>
                {yd.correctedQty.toLocaleString()}
                {hasDiff && (
                  <span style={{ fontSize: 10, opacity: 0.6 }}>
                    {" "}({yd.qty.toLocaleString()})
                  </span>
                )}
              </>
            }
            rightText={`${yd.items}와인 · ${yd.clients}거래처`}
          />
        );
      })}

      <div style={{ height: 1, background: "var(--gray-200)", margin: "20px 0" }} />

      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--neutral-100)", marginBottom: 12 }}>
        와인당 판매량
      </div>
      {details.map((yd) => {
        const w = getWeight(yd.year);
        return (
          <YearBar
            key={yd.year}
            year={yd.year}
            pct={Math.round((yd.qtyPerItemCorrected / maxPerItem) * 100)}
            weight={w}
            singleYear={singleYear}
            label={
              <>
                {yd.correctedQty.toLocaleString()} ÷{" "}
                {p.isNewItem ? `(${yd.items}+1)` : yd.items} = {yd.qtyPerItemCorrected}
              </>
            }
            rightText={
              !singleYear ? (
                <>
                  {yd.qtyPerItemCorrected}×{w} ={" "}
                  <strong style={{ color: "var(--neutral-800)" }}>{yd.qtyPerItemCorrected * w}</strong>
                </>
              ) : undefined
            }
          />
        );
      })}

      <div
        style={{
          marginTop: 20,
          padding: "16px 18px",
          background: "var(--gray-50)",
          borderRadius: 6,
          border: "1px solid var(--border-default)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--neutral-800)", marginBottom: 10 }}>
          {singleYear ? "기대값" : "가중 평균"}
        </div>

        <div style={{ fontSize: 12, color: "var(--neutral-400)", lineHeight: 1.8, marginBottom: 12 }}>
          <div>
            판매량 {p.activeData.avg_annual_qty_corrected.toLocaleString()}병 ·{" "}
            {p.activeData.avg_items}개 와인
          </div>
          {p.isNewItem ? (
            <div>
              {p.activeData.avg_annual_qty_corrected.toLocaleString()} ÷ ({p.activeData.avg_items}
              +1) = <strong style={{ color: "var(--neutral-800)" }}>{p.activeData.qty_per_item}병</strong>
            </div>
          ) : (
            <div>
              {p.activeData.avg_annual_qty_corrected.toLocaleString()} ÷ {p.activeData.avg_items} ={" "}
              <strong style={{ color: "var(--neutral-800)" }}>{p.activeData.qty_per_item}병</strong>
            </div>
          )}
        </div>

        {!singleYear && (
          <div
            style={{
              fontSize: 12,
              color: "var(--neutral-700)",
              lineHeight: 2,
              fontFamily: "'SF Mono', 'Consolas', monospace",
              marginBottom: 8,
            }}
          >
            <div>
              ({details.map((yd) => `${yd.qtyPerItemCorrected}×${getWeight(yd.year)}`).join(" + ")})
              ÷ {totalWeight}
            </div>
            <div>
              ={" "}
              {details.reduce((s, yd) => s + yd.qtyPerItemCorrected * getWeight(yd.year), 0)} ÷{" "}
              {totalWeight}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: "var(--neutral-900)" }}>
            {p.activeData.qty_per_item}
          </span>
          <span style={{ fontSize: 13, color: "var(--neutral-100)" }}>병/년</span>
          {Math.abs(p.activeData.qty_per_item - p.activeData.qty_per_item_raw) >= 5 && (
            <span style={{ fontSize: 11, color: "var(--status-warning)" }}>
              보정 전 {p.activeData.qty_per_item_raw}
            </span>
          )}
        </div>

        {p.isNewItem && p.learningCurve && p.activeData.qty_per_item_year1 !== null && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "#f0f7ff",
              borderRadius: 4,
              border: "1px solid #d6e8f7",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--neutral-700)" }}>
              1년차: {p.activeData.qty_per_item} × {Math.round(p.learningCurve.ratio * 100)}% ={" "}
              <strong>{p.activeData.qty_per_item_year1}병</strong>
            </div>
            {p.learningCurve.sampleSize > 0 && (
              <div style={{ fontSize: 10, color: "var(--neutral-100)", marginTop: 4 }}>
                {p.learningCurve.details
                  .slice(0, 3)
                  .map((d) => `${d.name.substring(0, 8)}… ${Math.round(d.ratio * 100)}%`)
                  .join(", ")}{" "}
                등 {p.learningCurve.sampleSize}개
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 10, color: "#bbb" }}>
          <Legend color="var(--action)" text="최근 ×3" />
          <Legend color="#b87333" text="직전 ×2" />
          <Legend color="var(--gray-300)" text="나머지 ×1" />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span>
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 2,
          background: color,
          marginRight: 4,
          verticalAlign: "middle",
        }}
      />
      {text}
    </span>
  );
}
