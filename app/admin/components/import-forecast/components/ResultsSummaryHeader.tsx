"use client";

type Props = {
  isNewItem: boolean;
  country: string;
  regionLabel: string;
  wineType: string;
  priceMin: string;
  priceMax: string;
  startYear: string;
  endYear: string;
  matchedItems: number;
  allMatchedItems: number;
  displayTotal: number;
  totalCases: number;
  totalClients: number;
  totalCorrected: number;
};

export function ResultsSummaryHeader(p: Props) {
  return (
    <div
      style={{
        background: "#111",
        borderRadius: 8,
        padding: "24px 28px",
        marginBottom: 16,
        color: "#fff",
      }}
    >
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
        {p.isNewItem ? "신규" : "기존"} · {p.country}
        {p.regionLabel ? ` ${p.regionLabel}` : ""}
        {p.wineType ? ` ${p.wineType}` : ""} · {Number(p.priceMin).toLocaleString()}~
        {Number(p.priceMax).toLocaleString()}원 · {p.startYear}~{p.endYear} · {p.matchedItems}개 와인
        {p.allMatchedItems > p.matchedItems
          ? ` (${p.allMatchedItems - p.matchedItems} 제외)`
          : ""}
      </div>
      <div style={{ display: "flex", gap: 48, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {p.displayTotal.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
            {p.isNewItem ? "1년차 예상" : "병/년"}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {p.totalCases}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
            케이스
          </div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2 }}>
            {p.totalClients}
            <span style={{ fontSize: 13, opacity: 0.5 }}> 거래처</span>
          </div>
        </div>
        {p.isNewItem && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2 }}>
              {p.totalCorrected.toLocaleString()}
              <span style={{ fontSize: 13, opacity: 0.5 }}> 2년차~</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
