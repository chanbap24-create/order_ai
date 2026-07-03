"use client";

import { useState } from "react";
import { LedgerRow, Company, Copy, won, mmdd, th, td, muted, badgeDone, badgePending, panel, statCard, statLabel, statValue, chip, POSITIONS } from "./tastingShared";

type Props = {
  rows: LedgerRow[];
  loading: boolean;
  company: Company;
  currentManager: string;
  department?: string;
  onChanged: () => void; // 상신 토글 후 재로딩
};

// 시음주 현황: 어느 거래처로 어떤 와인이 언제 나갔고, 발주 전환·상신 여부를 한눈에.
// 페이지 전환 없이 여기서 바로: 건별 [JSON 복사](결재 매크로용) + 상신 배지 클릭으로 미상신↔상신 토글.
export default function TastingStatusView({ rows, loading, company, currentManager, department, onChanged }: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (loading) return <div style={muted}>불러오는 중…</div>;
  if (rows.length === 0) return <div style={muted}>해당 기간에 시음주가 없습니다.</div>;

  const total = rows.length;
  const converted = rows.filter((r) => r.converted).length;
  const submitted = rows.filter((r) => r.submitted).length;
  const amount = rows.reduce((s, r) => s + (r.supply || 0), 0);
  const rate = total ? Math.round((converted / total) * 100) : 0;

  // 상신 토글(행 단위) — 결재 탭과 동일 PATCH 재사용.
  const toggle = async (r: LedgerRow) => {
    if (busyKey) return;
    setBusyKey(r.key);
    try {
      await fetch("/api/sales/tasting/ledger", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, keys: [r.key], submitted: !r.submitted }),
      });
      onChanged();
    } catch { /* ignore */ } finally { setBusyKey(null); }
  };

  // 그 거래처의 결재 JSON 1건(지출결의서). 같은 거래처의 여러 시음주 행은 한 문서로 묶음.
  const buildDoc = (r: LedgerRow) => {
    const groupKey = r.client_code || r.client_name || "(미지정)";
    const grp = rows.filter((x) => (x.client_code || x.client_name || "(미지정)") === groupKey);
    const name = grp[0].client_name || "(거래처 미지정)";
    const totalAmt = grp.reduce((s, x) => s + (x.supply || 0), 0);
    const title = `시음주 요청의건_${name}`;
    const payDate = mmdd(grp.map((x) => x.ship_date).sort().reverse()[0] || "");
    const note = [title, "-신규 리스트 제안", "-끝-"].join("\n");
    return {
      제목: title, 사용부서: department || "영업1부", 사용자: currentManager, 직위: POSITIONS[currentManager] || "",
      발의금액: won(totalAmt), 지급일자: payDate, 합계: won(totalAmt),
      상세내역: grp.map((x) => ({ 계정과목: "시음주", 품목: x.item_name, 금액: won(x.supply), 거래처명: name, 수량: "1" })),
      비고: note,
    };
  };

  const copyRow = async (r: LedgerRow) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildDoc(r)));
      setCopiedKey(r.key); setTimeout(() => setCopiedKey(null), 1500);
    } catch { alert("복사 실패 — 클립보드 권한을 확인하세요."); }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
        <div style={statCard}><div style={statLabel}>총 시음</div><div style={statValue}>{total}건</div></div>
        <div style={statCard}><div style={statLabel}>공급가 합계</div><div style={statValue}>{won(amount)}원</div></div>
        <div style={statCard}><div style={statLabel}>발주전환</div><div style={{ ...statValue, color: "var(--color-success, #2e7d32)" }}>{converted}건 · {rate}%</div></div>
        <div style={statCard}><div style={statLabel}>상신</div><div style={statValue}>{submitted} / {total}</div></div>
      </div>
      <div style={{ ...panel, padding: "6px 8px", overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 760 }}>
          <thead>
            <tr>
              {["출고일", "거래처", "와인", "공급가", "담당자", "발주전환", "상신", "결재복사"].map((h) => <th key={h} style={th}>{h}</th>)}
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
                  <button
                    onClick={() => toggle(r)}
                    disabled={busyKey === r.key}
                    title={r.submitted ? "클릭 시 미상신으로" : "클릭 시 상신으로"}
                    style={{ ...(r.submitted ? badgeDone : badgePending), border: "none", cursor: busyKey === r.key ? "default" : "pointer", opacity: busyKey === r.key ? 0.5 : 1 }}
                  >
                    {busyKey === r.key ? "…" : (r.submitted ? "상신" : "미상신")}
                  </button>
                </td>
                <td style={td}>
                  <button
                    onClick={() => copyRow(r)}
                    title="이 거래처 결재 JSON 복사(매크로용)"
                    style={{ ...chip, padding: "4px 10px", fontSize: 11 }}
                  >
                    {copiedKey === r.key ? "✓ 복사됨" : "📋 JSON"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
