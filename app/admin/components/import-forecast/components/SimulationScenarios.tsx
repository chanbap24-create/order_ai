"use client";

type Scenario = { label: string; value: number; color: string; icon: string };

type Props = {
  scenarios: Scenario[];
  importBottles: number;
  costPrice: number;
  sellingPrice: number;
  totalInvestment: number;
  lc: number;
};

export function SimulationScenarios(p: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${p.scenarios.length}, 1fr)`,
        gap: 10,
        marginBottom: 16,
      }}
    >
      {p.scenarios.map((s) => {
        const yr1Sales = Math.round(s.value * p.lc);
        const yr1Revenue = yr1Sales * p.sellingPrice;
        const yr1Profit = yr1Sales * (p.sellingPrice - p.costPrice);
        const sellThruPct =
          p.importBottles > 0
            ? Math.min(100, Math.round((yr1Sales / p.importBottles) * 100))
            : 0;
        const roi =
          p.totalInvestment > 0 ? Math.round((yr1Profit / p.totalInvestment) * 100) : 0;
        const monthsToSell =
          yr1Sales > 0 ? Math.round((p.importBottles / yr1Sales) * 12) : 999;

        return (
          <div
            key={s.label}
            style={{ padding: 14, borderRadius: 6, border: "1px solid var(--gray-200)" }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#222",
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{s.label}</span>
              <span style={{ fontWeight: 400, color: "#bbb" }}>{yr1Sales}병</span>
            </div>

            <div style={{ fontSize: 11, color: "#666", lineHeight: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>매출</span>
                <span style={{ color: "#222" }}>
                  {Math.round(yr1Revenue / 10000).toLocaleString()}만
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>수익</span>
                <span
                  style={{
                    color: yr1Profit >= 0 ? "var(--status-success)" : "var(--status-danger)",
                    fontWeight: 600,
                  }}
                >
                  {yr1Profit >= 0 ? "+" : ""}
                  {Math.round(yr1Profit / 10000).toLocaleString()}만
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>ROI</span>
                <span
                  style={{
                    color: roi >= 0 ? "var(--status-success)" : "var(--status-danger)",
                    fontWeight: 600,
                  }}
                >
                  {roi >= 0 ? "+" : ""}
                  {roi}%
                </span>
              </div>

              <div style={{ marginTop: 4 }}>
                <div
                  style={{
                    height: 4,
                    background: "var(--gray-100)",
                    borderRadius: 2,
                    marginTop: 3,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${sellThruPct}%`,
                      background:
                        sellThruPct >= 80
                          ? "var(--status-success)"
                          : sellThruPct >= 50
                            ? "var(--status-warning)"
                            : "var(--status-danger)",
                      borderRadius: 2,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: "#bbb",
                    marginTop: 3,
                  }}
                >
                  <span>{sellThruPct}% 소진</span>
                  <span>{monthsToSell >= 999 ? "-" : `${monthsToSell}개월`}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
