"use client";

import { useMemo, useState } from "react";
import { buildApprovalText } from "@/app/lib/tasting/approvalText";

type Props = {
  clientName: string;
  manager: string;
  itemName: string;
  supply: number;
  date: string; // 'YYYY-MM-DD'
  onClose: () => void;
};

const mmdd = (s: string) => {
  const p = (s || "").slice(0, 10).split("-");
  return p.length === 3 ? `${Number(p[1])}/${Number(p[2])}` : s;
};

/** 시음주 결재 요청 문구 생성(복사·붙여넣기용). API 없이 텍스트만. */
export function TastingApprovalModal({ clientName, manager, itemName, supply, date, onClose }: Props) {
  const [dept, setDept] = useState("영업1부");
  const [user, setUser] = useState(manager || "");
  const [position, setPosition] = useState("");
  const [payDate, setPayDate] = useState(mmdd(date));
  const [qty, setQty] = useState(1);
  const [extra, setExtra] = useState("-신규 리스트 제안");
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () => buildApprovalText({ clientName, dept, user, position, payDate, items: [{ item_name: itemName, supply, qty }], extra }),
    [clientName, dept, user, position, payDate, itemName, supply, qty, extra],
  );

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>시음주 결재 문구</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginBottom: 10 }}>
          <Field label="사용부서" value={dept} onChange={setDept} />
          <Field label="사용자" value={user} onChange={setUser} />
          <Field label="직위" value={position} onChange={setPosition} placeholder="예: 과장" />
          <Field label="지급일자" value={payDate} onChange={setPayDate} placeholder="예: 6/11" />
          <label style={fieldWrap}>
            <span style={lbl}>수량</span>
            <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} style={input} />
          </label>
        </div>
        <label style={{ ...fieldWrap, marginBottom: 10 }}>
          <span style={lbl}>비고 추가문구</span>
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} style={{ ...input, resize: "vertical" }} />
        </label>

        <pre style={preBox}>{text}</pre>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={btnGhost}>닫기</button>
          <button onClick={copy} style={btnPrimary}>{copied ? "복사됨!" : "복사"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={fieldWrap}>
      <span style={lbl}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={input} />
    </label>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 12, width: "min(560px, 96vw)", maxHeight: "90vh", overflowY: "auto", padding: "18px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const lbl: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };
const input: React.CSSProperties = { fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-default)", outline: "none" };
const preBox: React.CSSProperties = { fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--surface-bg, #f6f4f2)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "12px 14px", margin: 0, fontFamily: "inherit" };
const btnGhost: React.CSSProperties = { padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border-default)", background: "#fff", color: "var(--text-secondary)" };
const btnPrimary: React.CSSProperties = { padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--action)", background: "var(--action)", color: "#fff" };
