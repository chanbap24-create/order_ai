"use client";

import { useState } from "react";
import { useTasting, type SelectionMode, type TastingHistoryRow } from "../hooks/useTasting";
import { TastingApprovalModal } from "./TastingApprovalModal";

type Props = {
  clientCode: string;
  clientName: string;
  clientType: string;
  manager: string;
};

const MODE_LABEL: Record<SelectionMode, string> = {
  recommend: "추천 1순위",
  manual: "수동 선택",
  monthly: "이달의 시음주",
};
const fmtDate = (s: string) => (s ? s.slice(0, 10) : "");
const won = (n: number) => (n || 0).toLocaleString();

/** 거래처 시음주 정책 + 등록 버튼 + 이력 카드 (거래처 정보 탭). */
export function ClientTastingCard({ clientCode, clientName, clientType, manager }: Props) {
  const t = useTasting(clientCode, clientType, clientName, manager);
  const [msg, setMsg] = useState<string>("");
  const [approval, setApproval] = useState<TastingHistoryRow | null>(null);

  if (t.loading || !t.policy) {
    return <div style={card}><div style={title}>시음주</div><div style={muted}>불러오는 중…</div></div>;
  }
  const p = t.policy;

  const onRegister = async () => {
    setMsg("");
    let itemNo: string | undefined;
    if (p.selection_mode === "manual") {
      const v = window.prompt("시음주로 등록할 품번을 입력하세요");
      if (!v) return;
      itemNo = v.trim();
    }
    const r = await t.register({ item_no: itemNo });
    setMsg(r.ok ? `등록됨: ${r.item?.item_name || ""}` : `실패: ${r.reason || ""}`);
  };

  const onDelete = async (h: TastingHistoryRow) => {
    if (!window.confirm(`시음주 이력을 삭제할까요?\n${fmtDate(h.created_at)} · ${h.item_name}`)) return;
    setMsg("");
    const r = await t.remove(h.id);
    setMsg(r.ok ? "삭제됨" : `실패: ${r.error || ""}`);
  };

  const usageText = t.usage
    ? `이번 달 ${t.usage.qty}/${p.monthly_qty_limit}병` +
      (p.monthly_amount_limit != null ? ` · ${won(t.usage.amount)}/${won(p.monthly_amount_limit)}원` : "")
    : "";

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={title}>시음주</div>
        <button onClick={onRegister} disabled={t.busy} style={btnPrimary}>
          {t.busy ? "등록 중…" : "시음주 등록"}
        </button>
      </div>

      {/* 정책 설정 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 8 }}>
        <label style={rowLabel}>
          <input type="checkbox" checked={p.enabled} onChange={(e) => t.savePolicy({ enabled: e.target.checked })} />
          월 자동등록 켜기
        </label>
        <label style={field}>
          <span style={fieldLabel}>선정 방식</span>
          <select
            value={p.selection_mode}
            onChange={(e) => t.savePolicy({ selection_mode: e.target.value as SelectionMode })}
            style={input}
          >
            {(["recommend", "manual", "monthly"] as SelectionMode[]).map((m) => (
              <option key={m} value={m}>{MODE_LABEL[m]}</option>
            ))}
          </select>
        </label>
        <label style={field}>
          <span style={fieldLabel}>월 병수 한도</span>
          <input
            type="number"
            defaultValue={p.monthly_qty_limit}
            onBlur={(e) => t.savePolicy({ monthly_qty_limit: Number(e.target.value) || 0 })}
            style={input}
          />
        </label>
        <label style={field}>
          <span style={fieldLabel}>월 금액 상한(원)</span>
          <input
            type="number"
            defaultValue={p.monthly_amount_limit ?? ""}
            placeholder="무제한"
            onBlur={(e) => t.savePolicy({ monthly_amount_limit: e.target.value === "" ? null : Number(e.target.value) || 0 })}
            style={input}
          />
        </label>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: msg ? 4 : 8 }}>{usageText}</div>
      {msg && <div style={{ fontSize: 12, color: msg.startsWith("실패") ? "var(--status-danger)" : "var(--color-success)", marginBottom: 8 }}>{msg}</div>}

      {/* 이력 */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 4 }}>
        시음주 이력 {t.history.length > 0 ? `(${t.history.length})` : ""}
      </div>
      {t.history.length === 0 ? (
        <div style={muted}>아직 없음</div>
      ) : (
        <div>
          {t.history.map((h) => (
            <div key={h.id} style={histRow}>
              <span style={{ color: "var(--text-tertiary)", width: 76 }}>{fmtDate(h.created_at)}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.item_name}</span>
              <span style={{ color: "var(--text-tertiary)" }}>{won(h.supply)}원</span>
              <button onClick={() => setApproval(h)} style={approvalBtn}>결재</button>
              <button onClick={() => onDelete(h)} disabled={t.busy} style={deleteBtn} title="시음주 등록 삭제">삭제</button>
            </div>
          ))}
        </div>
      )}

      {approval && (
        <TastingApprovalModal
          clientName={clientName}
          manager={manager}
          itemName={approval.item_name}
          supply={approval.supply}
          date={approval.created_at}
          onClose={() => setApproval(null)}
        />
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "white", borderRadius: 8, padding: "12px 20px",
  boxShadow: "0 2px 8px rgba(90,21,21,0.03)", marginBottom: 16,
};
const title: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--text-tertiary)" };
const rowLabel: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" };
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const fieldLabel: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };
const input: React.CSSProperties = { fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--gray-200)", outline: "none" };
const btnPrimary: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
  border: "1px solid var(--action)", background: "var(--action)", color: "white",
};
const histRow: React.CSSProperties = {
  display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0",
  borderTop: "1px dashed var(--gray-100)", color: "var(--text-secondary)",
};
const approvalBtn: React.CSSProperties = {
  padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
  border: "1px solid var(--gray-200)", background: "#fff", color: "var(--text-secondary)",
};
const deleteBtn: React.CSSProperties = {
  padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
  border: "1px solid var(--status-danger)", background: "#fff", color: "var(--status-danger)",
};
