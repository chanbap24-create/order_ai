"use client";

import { useMemo, useState } from "react";
import {
  LedgerRow, Company, POSITIONS, Copy, F, won, mmdd,
  chip, chipOn, card, mut, th, td, badgeDone, badgePending, dateInput, fw, lbl, inp, muted, panel,
} from "./tastingShared";

type StatusFilter = "pending" | "submitted" | "all";

type Props = {
  rows: LedgerRow[];
  company: Company;
  currentManager: string;
  department?: string;
  onChanged: () => void;
};

// 시음주 결재: 거래처별 지출결의서 값 클릭-복사 + [JSON 복사](매크로 연동) + 상신완료 처리.
export default function TastingApprovalView({ rows, company, currentManager, department, onChanged }: Props) {
  const [dept, setDept] = useState(department || "영업1부");
  const [user, setUser] = useState(currentManager || "");
  const [position, setPosition] = useState(POSITIONS[currentManager] || "");
  const [extra, setExtra] = useState("-신규 리스트 제안");
  const [dateOverride, setDateOverride] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending"); // 기본 미상신 먼저
  const [showSettings, setShowSettings] = useState(false); // 결재정보 접기

  // 담당자/부서가 바뀌면 결재정보를 그 기준으로 리셋(effect 없이 렌더 중 조정).
  const [syncKey, setSyncKey] = useState(`${currentManager}|${department || ""}`);
  const curKey = `${currentManager}|${department || ""}`;
  if (curKey !== syncKey) {
    setSyncKey(curKey);
    setUser(currentManager || "");
    setPosition(POSITIONS[currentManager] || "");
    setDept(department || "영업1부");
  }

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: LedgerRow[] }>();
    for (const r of rows) {
      const key = r.client_code || r.client_name || "(미지정)";
      const g = map.get(key) || { name: r.client_name || "(거래처 미지정)", rows: [] };
      g.rows.push(r); map.set(key, g);
    }
    return [...map.entries()].map(([key, g]) => ({ key, ...g, allSubmitted: g.rows.every((r) => r.submitted) }));
  }, [rows]);

  // 상태 필터 + 미상신 먼저 정렬
  const visible = useMemo(() => groups
    .filter((g) => statusFilter === "all" ? true : statusFilter === "submitted" ? g.allSubmitted : !g.allSubmitted)
    .sort((a, b) => Number(a.allSubmitted) - Number(b.allSubmitted)),
  [groups, statusFilter]);
  const pendingCnt = groups.filter((g) => !g.allSubmitted).length;
  const doneCnt = groups.length - pendingCnt;

  const mark = async (keys: string[], submitted: boolean) => {
    await fetch("/api/sales/tasting/ledger", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, keys, submitted }),
    });
    onChanged();
  };

  // 실수로 등록한 시음주(등록분) 삭제. 출고분은 quoteIds가 없어 대상 아님.
  const del = async (ids?: number[]) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm("실수로 등록한 시음주입니다. 삭제할까요?")) return;
    await fetch("/api/sales/tasting/ledger", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    onChanged();
  };

  if (rows.length === 0) return <div style={muted}>해당 조건의 시음주가 없습니다.</div>;

  return (
    <div>
      {/* 결재정보(부서·사용자·직위·비고) — 설정 버튼으로 접기 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showSettings ? 10 : 12, flexWrap: "wrap" }}>
        <button onClick={() => setShowSettings((s) => !s)} style={chip}>⚙ 결재정보 {showSettings ? "닫기" : "설정"}</button>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>값을 클릭하면 복사 · 지급일자(출고일) 수정 가능 · [JSON 복사]→매크로</span>
      </div>
      {showSettings && (
        <div style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, maxWidth: 640 }}>
          <F label="사용부서" v={dept} set={setDept} /><F label="사용자" v={user} set={setUser} />
          <F label="직위" v={position} set={setPosition} />
          <label style={{ ...fw, gridColumn: "1 / -1" }}><span style={lbl}>비고 추가문구</span>
            <input value={extra} onChange={(e) => setExtra(e.target.value)} style={inp} /></label>
        </div>
      )}

      {/* 상신 상태 필터(미상신 먼저) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {([["pending", `미상신 ${pendingCnt}`], ["submitted", `상신완료 ${doneCnt}`], ["all", "전체"]] as [StatusFilter, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setStatusFilter(v)} style={statusFilter === v ? chipOn : chip}>{label}</button>
        ))}
      </div>

      {visible.length === 0
        ? <div style={muted}>{statusFilter === "pending" ? "미상신 건이 없습니다." : statusFilter === "submitted" ? "상신완료 건이 없습니다." : "해당 조건의 시음주가 없습니다."}</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        {visible.map((g) => {
          const title = `시음주 요청의건_${g.name}`;
          const total = g.rows.reduce((s, r) => s + (r.supply || 0), 0);
          const note = [title, ...extra.split("\n").map((x) => x.trim()).filter(Boolean), "-끝-"].join("\n");
          const autoShip = g.rows.map((r) => r.ship_date).sort().reverse()[0] || "";
          const shipDate = dateOverride[g.key] ?? autoShip;
          const payDate = mmdd(shipDate);
          const allSubmitted = g.allSubmitted;
          const keys = g.rows.map((r) => r.key);
          const jsonPayload = JSON.stringify({
            제목: title, 사용부서: dept, 사용자: user, 직위: position,
            발의금액: won(total), 지급일자: payDate, 합계: won(total),
            상세내역: g.rows.map((r) => ({ 계정과목: "시음주", 품목: r.item_name, 금액: won(r.supply), 거래처명: g.name, 수량: "1" })),
            비고: note,
          });
          return (
            <div key={g.key} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>제목: <Copy text={title} style={{ fontWeight: 700 }} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={allSubmitted ? badgeDone : badgePending}>{allSubmitted ? "상신완료" : "미상신"}</span>
                  <Copy text={jsonPayload} style={{ ...chip, border: "1px solid var(--gray-300)" }}>JSON 복사</Copy>
                  <button onClick={() => mark(keys, !allSubmitted)} style={chip}>{allSubmitted ? "미상신으로" : "상신완료 처리"}</button>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 8, fontSize: 13 }}>
                <span style={mut}>사용부서 <Copy text={dept} /></span>
                <span style={mut}>사용자 <Copy text={user} /></span>
                <span style={mut}>직위 <Copy text={position} /></span>
                <span style={mut}>발의금액 <Copy text={won(total)} style={{ fontWeight: 600 }} /></span>
                <span style={mut}>지급일자(출고일)
                  <input type="date" value={shipDate} onChange={(e) => setDateOverride((m) => ({ ...m, [g.key]: e.target.value }))} style={{ ...dateInput, marginLeft: 4 }} />
                  <Copy text={payDate} style={{ marginLeft: 4, fontWeight: 600 }} />
                </span>
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                <thead><tr>{["계정과목", "품목", "금액(공급가)", "거래처명", "수량", ""].map((h, i) => <th key={h || `_${i}`} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.key}>
                      <td style={td}><Copy text="시음주" /></td>
                      <td style={td}><Copy text={r.item_name} /></td>
                      <td style={{ ...td, textAlign: "right" }}><Copy text={won(r.supply)} /></td>
                      <td style={td}><Copy text={g.name} /></td>
                      <td style={{ ...td, textAlign: "right" }}><Copy text="1" /></td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {r.quoteIds && r.quoteIds.length > 0 && (
                          <button onClick={() => del(r.quoteIds)} style={delBtn} title="시음주 등록 삭제">삭제</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 8, fontSize: 13 }}>합계: <Copy text={won(total)} style={{ fontWeight: 700 }} /></div>
              <div style={{ marginTop: 6, fontSize: 13 }}>비고: <Copy text={note} style={{ color: "var(--text-secondary)" }}><span style={{ whiteSpace: "pre-wrap" }}>{note}</span></Copy></div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

const delBtn: React.CSSProperties = {
  padding: "1px 7px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
  border: "1px solid var(--status-danger)", background: "#fff", color: "var(--status-danger)",
};
