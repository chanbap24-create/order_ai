"use client";

import type { ClientRankItem, ClientRankStats, SelectedRankClient } from "../types";
import { IMPORTANCE_LABELS } from "../constants";
import { fmt } from "../lib/format";

type Props = {
  clients: ClientRankItem[];
  stats: Record<string, ClientRankStats>;
  loading: boolean;
  onSelectClient: (c: SelectedRankClient) => void;
};

export function ClientRankingTable({ clients, stats, loading, onSelectClient }: Props) {
  const sorted = [...clients]
    .map((c) => ({ ...c, st: stats[c.client_code] }))
    .sort((a, b) => (b.st?.totalSales || 0) - (a.st?.totalSales || 0))
    .slice(0, 30);

  return (
    <div className="analysis-card" style={{ marginTop: 20 }}>
      <div className="analysis-chart-title" style={{ marginBottom: 16 }}>
        거래처 매출 순위
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
          거래처 데이터 로딩 중...
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
          데이터 없음
        </div>
      ) : (
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: "center" }}>#</th>
                <th style={{ width: 64, whiteSpace: "nowrap" }}>등급</th>
                <th>거래처명</th>
                <th style={{ width: 72, whiteSpace: "nowrap" }}>담당</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>매출</th>
                <th style={{ textAlign: "right", width: 56, whiteSpace: "nowrap" }}>건수</th>
                <th style={{ textAlign: "right", width: 72, whiteSpace: "nowrap" }}>전기비</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, idx) => {
                const imp = IMPORTANCE_LABELS[c.importance] || IMPORTANCE_LABELS[3];
                const cr = c.st?.changeRate ?? 0;
                return (
                  <tr
                    key={c.client_code}
                    onClick={() =>
                      onSelectClient({
                        client_code: c.client_code,
                        client_name: c.client_name,
                        importance: c.importance,
                        manager: c.manager,
                        business_type: c.business_type,
                      })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 600,
                        color: idx < 3 ? "var(--action)" : "var(--neutral-400)",
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: imp.color,
                          background: imp.color + "14",
                          border: `1px solid color-mix(in srgb, ${imp.color} 15%, transparent)`,
                          whiteSpace: "nowrap",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {imp.label}
                      </span>
                    </td>
                    <td
                      style={{
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.client_name}
                    </td>
                    <td style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{c.manager || "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>
                      {c.st ? fmt(c.st.totalSales) : "-"}
                    </td>
                    <td style={{ textAlign: "right" }}>{c.st?.orderCount || 0}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        color: cr > 0 ? "#059669" : cr < 0 ? "#DC2626" : "var(--neutral-100)",
                      }}
                    >
                      {cr !== 0 ? `${cr > 0 ? "+" : ""}${cr}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
