"use client";

import { useEffect, useState } from "react";
import type { AnalysisType } from "../types";

type Wine = {
  item_code: string;
  name: string;
  quoted_count: number;
  converted_count: number;
  shipped_qty: number;
  last_ship: string | null;
};
type ConvData = {
  summary: { quotes: number; wines: number; converted_wines: number; rate: number };
  wines: Wine[];
};

type Props = { clientCode: string; type: AnalysisType };

/** 거래처 상세 — 견적 → 실제 출고(60일) 전환 분석 카드 */
export function ConversionCard({ clientCode, type }: Props) {
  const [data, setData] = useState<ConvData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/quote/saved/conversion?client_code=${encodeURIComponent(clientCode)}&type=${type}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setData(d.success ? d : null); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clientCode, type]);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>견적 → 실제 출고 전환</span>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>견적 후 60일 기준</span>
      </div>

      {loading && <div style={muted}>불러오는 중…</div>}

      {!loading && (!data || data.summary.quotes === 0) && (
        <div style={muted}>저장된 견적이 없습니다. 견적서를 내보내면 전환 데이터가 쌓입니다.</div>
      )}

      {!loading && data && data.summary.quotes > 0 && (
        <>
          <div style={summaryRow}>
            <Stat label="저장 견적" value={`${data.summary.quotes}건`} />
            <Stat label="전환 와인" value={`${data.summary.converted_wines}/${data.summary.wines}종`} highlight />
            <Stat label="와인 전환율" value={`${data.summary.rate}%`} highlight />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
              <thead>
                <tr style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                  <th style={{ ...th, textAlign: "left" }}>와인</th>
                  <th style={th}>견적</th>
                  <th style={th}>출고전환</th>
                  <th style={th}>출고수량</th>
                  <th style={{ ...th, textAlign: "right" }}>최근출고</th>
                </tr>
              </thead>
              <tbody>
                {data.wines.slice(0, 40).map((w) => {
                  const converted = w.converted_count > 0;
                  return (
                    <tr key={w.item_code} style={{ borderTop: "1px solid var(--gray-100)" }}>
                      <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{w.name}</td>
                      <td style={td}>{w.quoted_count}회</td>
                      <td style={{ ...td, fontWeight: 700, color: converted ? "var(--color-success)" : "var(--text-muted)" }}>
                        {converted ? `${w.converted_count}회` : "미전환"}
                      </td>
                      <td style={td}>{w.shipped_qty || "-"}</td>
                      <td style={{ ...td, textAlign: "right", color: "var(--text-tertiary)" }}>
                        {w.last_ship || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.wines.length > 40 && (
            <div style={{ ...muted, marginTop: 6 }}>상위 40종만 표시 (총 {data.wines.length}종)</div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? "var(--action)" : "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "white", border: "1px solid var(--gray-200)", borderRadius: 12,
  padding: 16, marginBottom: 16,
};
const muted: React.CSSProperties = { fontSize: 12.5, color: "var(--text-tertiary)", padding: "8px 0" };
const summaryRow: React.CSSProperties = {
  display: "flex", gap: 12, padding: "10px 12px", marginBottom: 12,
  background: "var(--surface-muted, #f6f4f2)", borderRadius: 10,
};
const th: React.CSSProperties = { padding: "6px 8px", textAlign: "center", fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "7px 8px", textAlign: "center", whiteSpace: "nowrap" };
