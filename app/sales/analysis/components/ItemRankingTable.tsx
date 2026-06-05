"use client";

import { fmt } from "../lib/format";

type ItemRow = {
  rn: number;
  code: string;
  name: string;
  revenue: number;
  discount: number;
  quantity: number;
  stock: number;
};

type Props = {
  items: ItemRow[];
  prevRanking?: Record<string, number>;
};

export function ItemRankingTable({ items, prevRanking }: Props) {
  return (
    <div className="analysis-card">
      <div className="analysis-chart-title" style={{ marginBottom: 16 }}>
        품목별 매출 순위
      </div>
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>#</th>
              <th style={{ width: 50 }}>변동</th>
              <th style={{ width: 80 }}>코드</th>
              <th>품목명</th>
              <th style={{ textAlign: "right" }}>매출</th>
              <th style={{ textAlign: "right", width: 65 }}>지원률</th>
              <th style={{ textAlign: "right", width: 50 }}>수량</th>
              <th style={{ textAlign: "right", width: 60 }}>재고</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((item, idx) => {
              const prevRank = prevRanking?.[item.code];
              let changeEl: React.ReactNode = <span style={{ color: "var(--text-muted)" }}>-</span>;
              if (prevRank) {
                const diff = prevRank - item.rn;
                if (diff > 0)
                  changeEl = (
                    <span style={{ color: "#059669", fontWeight: 600 }}>▲{diff}</span>
                  );
                else if (diff < 0)
                  changeEl = (
                    <span style={{ color: "#DC2626", fontWeight: 600 }}>▼{Math.abs(diff)}</span>
                  );
              } else if (prevRanking && !prevRank) {
                changeEl = (
                  <span style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.7rem" }}>NEW</span>
                );
              }
              return (
                <tr key={item.code || idx}>
                  <td
                    style={{
                      textAlign: "center",
                      fontWeight: 600,
                      color: item.rn <= 3 ? "var(--action)" : "var(--neutral-400)",
                    }}
                  >
                    {item.rn}
                  </td>
                  <td>{changeEl}</td>
                  <td style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.code}</td>
                  <td
                    style={{
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{fmt(item.revenue)}</td>
                  <td
                    style={{
                      textAlign: "right",
                      color: item.discount > 0 ? "#DC2626" : "var(--neutral-700)",
                    }}
                  >
                    {item.discount ? `${item.discount}%` : "-"}
                  </td>
                  <td style={{ textAlign: "right" }}>{item.quantity}</td>
                  <td
                    style={{
                      textAlign: "right",
                      color: item.stock <= 0 ? "#DC2626" : "var(--neutral-700)",
                    }}
                  >
                    {item.stock}
                  </td>
                </tr>
              );
            })}
            {(!items || items.length === 0) && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  데이터 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
