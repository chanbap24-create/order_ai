"use client";

import type {
  BulkInfo,
  LearningCurve,
  ManagerStat,
  PriceStats,
  SampleInfo,
  StockoutInfo,
} from "../types";

type Props = {
  stockoutInfo: StockoutInfo | null;
  correctionPct: number;
  isNewItem: boolean;
  learningCurve: LearningCurve | null;
  activeData: ManagerStat | null;
  bulkInfo: BulkInfo | null;
  bulkOpen: boolean;
  setBulkOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  sampleInfo: SampleInfo | null;
  priceStats: PriceStats | null;
};

export function CorrectionInfoBar(p: Props) {
  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
          fontSize: 11,
          color: "var(--neutral-400)",
        }}
      >
        {p.stockoutInfo && p.stockoutInfo.correctedWines > 0 && (
          <span style={pill}>
            품절보정 +{p.correctionPct}% · {p.stockoutInfo.correctedWines}/
            {p.stockoutInfo.totalWines}개 ×{p.stockoutInfo.avgFactor}
          </span>
        )}
        {p.isNewItem && p.learningCurve && (
          <span style={pill}>
            러닝커브 {Math.round(p.learningCurve.ratio * 100)}%
            {p.learningCurve.sampleSize > 0
              ? ` · ${p.learningCurve.sampleSize}개 기반`
              : ""}
          </span>
        )}
        {p.activeData?.wine_distribution &&
          p.activeData.wine_distribution.count >= 4 && (
            <span style={pill}>
              분포 P25 {p.activeData.wine_distribution.p25} · 중위{" "}
              {p.activeData.wine_distribution.median} · P75{" "}
              {p.activeData.wine_distribution.p75}
            </span>
          )}
        {p.bulkInfo && p.bulkInfo.excluded > 0 && (
          <span
            style={{ ...pill, cursor: "pointer" }}
            onClick={() => p.setBulkOpen((v) => !v)}
          >
            특판 {p.bulkInfo.excluded}건 {p.bulkInfo.qty.toLocaleString()}병 제외{" "}
            {p.bulkOpen ? "▲" : "▼"}
          </span>
        )}
        {p.sampleInfo && p.sampleInfo.excluded > 0 && (
          <span style={pill}>샘플 {p.sampleInfo.excluded}건 제외</span>
        )}
        {p.priceStats && p.priceStats.avg > 0 && (
          <span style={pill}>
            평균 {p.priceStats.avg.toLocaleString()}원 (
            {p.priceStats.min.toLocaleString()}~{p.priceStats.max.toLocaleString()})
          </span>
        )}
      </div>

      {p.bulkOpen && p.bulkInfo && p.bulkInfo.details.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "var(--gray-50)",
            borderRadius: 6,
            border: "1px solid var(--gray-200)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 1fr 60px 60px",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              color: "var(--gray-400)",
              marginBottom: 4,
            }}
          >
            <div>날짜</div>
            <div>거래처</div>
            <div>와인</div>
            <div style={{ textAlign: "right" }}>수량</div>
            <div style={{ textAlign: "right" }}>담당</div>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {p.bulkInfo.details.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 1fr 60px 60px",
                  gap: 4,
                  fontSize: 11,
                  color: "var(--neutral-700)",
                  padding: "3px 0",
                  borderBottom:
                    i < p.bulkInfo!.details.length - 1 ? "1px solid var(--gray-100)" : "none",
                }}
              >
                <div style={{ color: "var(--neutral-100)" }}>{d.date}</div>
                <div style={ellipsis}>{d.client}</div>
                <div style={ellipsis}>{d.wine}</div>
                <div style={{ textAlign: "right", fontWeight: 600 }}>{d.qty}병</div>
                <div style={{ textAlign: "right", color: "var(--neutral-100)" }}>{d.manager}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const pill: React.CSSProperties = {
  padding: "4px 10px",
  background: "var(--gray-50)",
  borderRadius: 4,
  border: "1px solid var(--gray-200)",
};

const ellipsis: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
