"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TastingStatusView from "./tasting/TastingStatusView";
import TastingApprovalView from "./tasting/TastingApprovalView";
import { LedgerRow, Company, preset, chip, chipOn, chipPrimary, dateInput, panel, pageTitle } from "./tasting/tastingShared";

type Props = { currentManager: string; isAdmin: boolean; department?: string };
type SubTab = "status" | "approval";

// 시음주 탭 컨테이너: 실제 출고내역 기반. [현황]/[결재] 서브탭 + 법인·기간·담당자 필터.
export default function TastingApprovalTab({ currentManager, isAdmin, department }: Props) {
  const [sub, setSub] = useState<SubTab>("status");
  const [company, setCompany] = useState<Company>("CDV");
  const [range, setRange] = useState(preset("month"));
  const [manager, setManager] = useState<string>(""); // "" = 전체
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ company, start: range.start, end: range.end });
      const res = await fetch(`/api/sales/tasting/ledger?${params.toString()}`);
      const d = await res.json();
      setRows(Array.isArray(d.rows) ? d.rows : []);
    } catch { setRows([]); } finally { setLoading(false); }
  }, [company, range]);

  useEffect(() => { void load(); }, [load]);

  const managerList = useMemo(() => [...new Set(rows.map((r) => r.manager).filter(Boolean))].sort(), [rows]);
  const shown = useMemo(() => (manager ? rows.filter((r) => r.manager === manager) : rows), [rows, manager]);
  // 결재는 담당자별 문서라 기본을 로그인 사용자로. 전체면 로그인 사용자 것만.
  const approvalManager = manager || currentManager;
  const approvalRows = useMemo(() => rows.filter((r) => r.manager === approvalManager), [rows, approvalManager]);

  return (
    <div style={{ padding: "8px 4px 40px" }}>
      {/* 헤더: 제목 + 법인 토글 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={pageTitle}>{currentManager} 담당 시음주</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setCompany("CDV")} style={company === "CDV" ? chipOn : chip}>까브드뱅</button>
          <button onClick={() => setCompany("DL")} style={company === "DL" ? chipOn : chip}>대유라이프</button>
        </div>
      </div>

      {/* 필터 카드 */}
      <div style={panel}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button onClick={() => setRange(preset("week"))} style={chip}>이번주</button>
          <button onClick={() => setRange(preset("month"))} style={chip}>이번달</button>
          <button onClick={() => setRange(preset("lastMonth"))} style={chip}>지난달</button>
          <input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} style={dateInput} />
          <span style={{ color: "var(--text-tertiary)" }}>~</span>
          <input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} style={dateInput} />
          {isAdmin && (
            <select value={manager} onChange={(e) => setManager(e.target.value)} style={dateInput}>
              <option value="">담당자 전체</option>
              {managerList.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <button onClick={load} style={chipPrimary}>조회</button>
        </div>
      </div>

      {/* 서브탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setSub("status")} style={sub === "status" ? chipOn : chip}>현황</button>
        <button onClick={() => setSub("approval")} style={sub === "approval" ? chipOn : chip}>결재</button>
      </div>

      {sub === "status"
        ? <TastingStatusView rows={shown} loading={loading} company={company} currentManager={approvalManager} department={department} onChanged={load} />
        : <TastingApprovalView rows={approvalRows} company={company} currentManager={approvalManager} department={department} onChanged={load} />}
    </div>
  );
}
