"use client";

import { LedgerRow, Copy, won, mmdd, th, td, muted, badgeDone, badgePending, panel, statCard, statLabel, statValue } from "./tastingShared";

// 시음주 현황: 어느 거래처로 어떤 와인이 언제 나갔고, 발주 전환·상신 여부를 한눈에.
export default function TastingStatusView({ rows, loading }: { rows: LedgerRow[]; loading: boolean }) {
  if (loading) return <div style={muted}>불러오는 중…</div>;
  if (rows.length === 0) return <div style={muted}>해당 기간에 시음주가 없습니다.</div>;

  const total = rows.length;
  const converted = rows.filter((r) => r.converted).length;
  const submitted = rows.filter((r) => r.submitted).length;
  const amount = rows.reduce((s, r) => s + (r.supply || 0), 0);
  const rate = total ? Math.round((converted / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
        <div style={statCard}><div style={statLabel}>총 시음</div><div style={statValue}>{total}건</div></div>
        <div style={statCard}><div style={statLabel}>공급가 합계</div><div style={statValue}>{won(amount)}원</div></div>
        <div style={statCard}><div style={statLabel}>발주전환</div><div style={{ ...statValue, color: "var(--color-success, #2e7d32)" }}>{converted}건 · {rate}%</div></div>
        <div style={statCard}><div style={statLabel}>상신</div><div style={statValue}>{submitted} / {total}</div></div>
      </div>
      <div style={{ ...panel, padding: "6px 8px", overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr>
              {["출고일", "거래처", "와인", "공급가", "담당자", "발주전환", "상신"].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={td}><Copy text={mmdd(r.ship_date)} /></td>
                <td style={td}><Copy text={r.client_name} /></td>
                <td style={td}><Copy text={r.item_name} /></td>
                <td style={{ ...td, textAlign: "right" }}><Copy text={won(r.supply)} /></td>
                <td style={td}>{r.manager}</td>
                <td style={td}>
                  {r.converted
                    ? <span style={badgeDone}>전환</span>
                    : <span style={badgePending}>미전환</span>}
                </td>
                <td style={td}>
                  {r.submitted
                    ? <span style={badgeDone}>상신</span>
                    : <span style={badgePending}>미상신</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
