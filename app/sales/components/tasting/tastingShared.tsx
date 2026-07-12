"use client";

import { useState } from "react";

// 시음주 현황/결재 공용 타입·헬퍼·스타일.
export type LedgerRow = {
  key: string;
  ship_date: string;
  client_code: string;
  client_name: string;
  item_no: string;
  item_name: string;
  supply: number;
  manager: string;
  converted: boolean;
  submitted: boolean;
  quoteIds?: number[]; // 등록분(saved_quotes) id — 있으면 삭제 가능(출고분은 없음)
};

export type Company = "CDV" | "DL";

// 담당자별 직위 (요청 매핑).
export const POSITIONS: Record<string, string> = {
  "조성재": "차장", "성창우": "부장", "김기범": "과장", "김효직": "차장", "유병우": "대표",
};

export const won = (n: number) => (n || 0).toLocaleString();
export const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const mmdd = (s: string) => { const p = (s || "").slice(0, 10).split("-"); return p.length === 3 ? `${Number(p[1])}/${Number(p[2])}` : s; };

export function preset(kind: "week" | "month" | "lastMonth"): { start: string; end: string } {
  const n = kstNow();
  if (kind === "week") { const s = new Date(n); s.setUTCDate(s.getUTCDate() - 6); return { start: iso(s), end: iso(n) }; }
  if (kind === "lastMonth") {
    const y = n.getUTCFullYear(), m = n.getUTCMonth();
    return { start: iso(new Date(Date.UTC(y, m - 1, 1))), end: iso(new Date(Date.UTC(y, m, 0))) };
  }
  return { start: `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-01`, end: iso(n) };
}

/** 클릭하면 그 값을 복사(별도 버튼 없이). */
export function Copy({ text, children, style }: { text: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  const [done, setDone] = useState(false);
  return (
    <span
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 900); }); }}
      title="클릭해 복사"
      style={{ cursor: "pointer", borderRadius: 4, padding: "1px 4px", background: done ? "var(--action-muted, #efe3e3)" : "transparent", transition: "background 0.15s", ...style }}
    >
      {children ?? text}{done && <span style={{ color: "var(--action)" }}> ✓</span>}
    </span>
  );
}

export function F({ label, v, set }: { label: string; v: string; set: (s: string) => void }) {
  return <label style={fw}><span style={lbl}>{label}</span><input value={v} onChange={(e) => set(e.target.value)} style={inp} /></label>;
}

export const chip: React.CSSProperties = { padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--gray-300)", background: "#fff", color: "var(--text-secondary)" };
export const chipPrimary: React.CSSProperties = { ...chip, border: "1px solid var(--action)", background: "var(--action)", color: "#fff" };
export const chipOn: React.CSSProperties = { ...chip, border: "1px solid var(--action)", background: "var(--action)", color: "#fff" };
export const badgeDone: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--color-success, var(--status-success))", color: "#fff" };
export const badgePending: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--border-default, #e7e3df)", color: "var(--text-secondary)" };
export const dateInput: React.CSSProperties = { fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-default)", outline: "none" };
export const fw: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
export const inp: React.CSSProperties = { fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-default)", outline: "none" };
export const lbl: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };
export const mut: React.CSSProperties = { color: "var(--text-secondary)" };
export const muted: React.CSSProperties = { padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 };
export const card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border-default)" };
export const panel: React.CSSProperties = { background: "var(--surface, #fff)", border: "1px solid var(--border-default, #e7e3df)", borderRadius: 12, padding: "14px 18px", marginBottom: 12 };
export const statCard: React.CSSProperties = { background: "var(--surface, #fff)", border: "1px solid var(--border-default, #e7e3df)", borderRadius: 12, padding: "16px 18px" };
export const statLabel: React.CSSProperties = { fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 };
export const statValue: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: "var(--text-primary)" };
export const pageTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "var(--text-primary)" };
export const th: React.CSSProperties = { padding: "6px 8px", borderBottom: "2px solid var(--gray-200)", color: "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap", textAlign: "left" };
export const td: React.CSSProperties = { padding: "5px 8px", borderBottom: "1px solid var(--border-default)", whiteSpace: "nowrap" };
