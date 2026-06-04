"use client";

import { useState } from "react";

type BrandVelocity = {
  brand: string;
  country: string;
  items: number;
  total: number;
  monthlyAvg: number;
  spanMonths: number;
  avgPrice: number;
  m1: number;
  m3: number;
  m6: number;
  m12: number;
  pattern: string;
  months5c: number;
  months10c: number;
  months20c: number;
};

type Props = { startYear: string; endYear: string };

export function BrandVelocitySection({ startYear, endYear }: Props) {
  const [brands, setBrands] = useState<BrandVelocity[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] =
    useState<"total" | "monthlyAvg" | "avgPrice" | "items">("total");
  const [filterPrice, setFilterPrice] = useState("all");
  const [lastPeriod, setLastPeriod] = useState("");

  const loadBrands = async () => {
    const period = `${startYear}-${endYear}`;
    if (brands.length > 0 && lastPeriod === period) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    setLastPeriod(period);
    try {
      const res = await fetch(
        `/api/forecast/brands?startYear=${startYear}&endYear=${endYear}`,
      );
      const data = await res.json();
      setBrands(data.brands || []);
      setOpen(true);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  };

  const filtered = brands
    .filter((b) => {
      if (filterPrice === "all") return true;
      if (filterPrice === "~2만") return b.avgPrice > 0 && b.avgPrice < 20000;
      if (filterPrice === "2~5만") return b.avgPrice >= 20000 && b.avgPrice < 50000;
      if (filterPrice === "5~10만") return b.avgPrice >= 50000 && b.avgPrice < 100000;
      if (filterPrice === "10만~") return b.avgPrice >= 100000;
      return true;
    })
    .sort(
      (a, b) =>
        (b as unknown as Record<string, number>)[sortKey] -
        (a as unknown as Record<string, number>)[sortKey],
    );

  const patternColor: Record<string, string> = {
    초반집중: "#e74c3c",
    꾸준: "#27ae60",
    후반가속: "#3498db",
  };

  const gridCols = "1fr 50px 55px 70px 65px 55px 55px 55px 60px";

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={loadBrands}
        style={{
          width: "100%",
          padding: "12px 20px",
          background: "#fff",
          borderRadius: 6,
          border: "1px solid #e0e0e0",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", textAlign: "left" }}>
          브랜드 소진 분석
        </div>
        <span style={{ fontSize: 11, color: "#bbb" }}>
          {loading ? "..." : open ? "▲" : "▼"}
        </span>
      </button>

      {open && brands.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: "0 0 6px 6px",
            border: "1px solid #e0e0e0",
            borderTop: "none",
            padding: "12px 0",
          }}
        >
          <div
            style={{
              padding: "0 20px 10px",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
              fontSize: 11,
            }}
          >
            {["all", "~2만", "2~5만", "5~10만", "10만~"].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPrice(p)}
                style={{
                  padding: "2px 8px",
                  fontSize: 10,
                  borderRadius: 3,
                  border: filterPrice === p ? "1px solid #111" : "1px solid #e0e0e0",
                  cursor: "pointer",
                  fontWeight: filterPrice === p ? 600 : 400,
                  background: filterPrice === p ? "#111" : "#fff",
                  color: filterPrice === p ? "#fff" : "#999",
                }}
              >
                {p === "all" ? "전체" : p}
              </button>
            ))}
            <span style={{ color: "#ddd" }}>|</span>
            {(
              [
                ["total", "총판매"],
                ["monthlyAvg", "월평균"],
                ["avgPrice", "가격"],
                ["items", "품목"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                style={{
                  padding: "2px 8px",
                  fontSize: 10,
                  borderRadius: 3,
                  border: sortKey === k ? "1px solid #111" : "1px solid #e0e0e0",
                  cursor: "pointer",
                  fontWeight: sortKey === k ? 600 : 400,
                  background: sortKey === k ? "#111" : "#fff",
                  color: sortKey === k ? "#fff" : "#999",
                }}
              >
                {l}
              </button>
            ))}
            <span style={{ color: "#ccc", marginLeft: "auto" }}>{filtered.length}</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridCols,
              padding: "6px 20px",
              fontSize: 10,
              color: "#bbb",
              fontWeight: 500,
              borderBottom: "1px solid #eee",
            }}
          >
            <div>브랜드</div>
            <div style={{ textAlign: "right" }}>품목</div>
            <div style={{ textAlign: "right" }}>가격</div>
            <div style={{ textAlign: "right" }}>총판매</div>
            <div style={{ textAlign: "right" }}>월평균</div>
            <div style={{ textAlign: "center" }}>5cs</div>
            <div style={{ textAlign: "center" }}>10cs</div>
            <div style={{ textAlign: "center" }}>20cs</div>
            <div style={{ textAlign: "center" }}>패턴</div>
          </div>

          {filtered.map((b) => (
            <div key={b.brand} style={{ borderBottom: "1px solid #f5f5f5" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: gridCols,
                  padding: "8px 20px",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#222" }}>
                    {b.brand}
                  </div>
                  <div style={{ fontSize: 10, color: "#ccc" }}>{b.country}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: "#999" }}>
                  {b.items}
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: "#999" }}>
                  {b.avgPrice > 0 ? (b.avgPrice / 1000).toFixed(0) + "k" : "-"}
                </div>
                <div
                  style={{ textAlign: "right", fontSize: 12, fontWeight: 600, color: "#222" }}
                >
                  {b.total.toLocaleString()}
                </div>
                <div
                  style={{ textAlign: "right", fontSize: 11, fontWeight: 500, color: "#555" }}
                >
                  {b.monthlyAvg.toLocaleString()}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    color: b.months5c <= 1 ? "var(--status-success)" : "#999",
                  }}
                >
                  {b.months5c}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    color:
                      b.months10c <= 3
                        ? "var(--status-success)"
                        : b.months10c <= 6
                          ? "var(--status-warning)"
                          : "var(--status-danger)",
                  }}
                >
                  {b.months10c}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    color:
                      b.months20c <= 6
                        ? "var(--status-success)"
                        : b.months20c <= 12
                          ? "var(--status-warning)"
                          : "var(--status-danger)",
                  }}
                >
                  {b.months20c}
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 10, color: patternColor[b.pattern] || "#999" }}>
                    {b.pattern}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
