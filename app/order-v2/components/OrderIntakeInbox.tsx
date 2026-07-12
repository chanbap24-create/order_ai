"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntakeResult } from "../lib/api";

type IntakeItem = {
  id: number; tab: string; client_hint: string | null;
  order_text: string | null; created_at: string;
  result?: IntakeResult;
};

type Props = { onLoad: (r: IntakeResult) => void };

const hhmm = (s: string) => { const d = s.slice(11, 16); return d || s.slice(0, 10); };

/** iOS 단축어로 들어온 발주 수신함 — 탭하면 편집기로 로드, 처리 완료 표시. */
export function OrderIntakeInbox({ onLoad }: Props) {
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [token, setToken] = useState<string>("");
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/order-v2/intake", { credentials: "include" });
      const j = await r.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const r = await fetch("/api/order-v2/intake", { credentials: "include" });
        const j = await r.json();
        if (alive) setItems(Array.isArray(j.items) ? j.items : []);
      } catch { /* ignore */ }
    };
    void run();
    const t = setInterval(() => void run(), 30000); // 30초마다 새 수신 확인
    return () => { alive = false; clearInterval(t); };
  }, []);

  // 단축어로 열린 경우(?shortcut=1): 방금 인식한 최신 발주를 바로 편집기에 로드.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("shortcut") !== "1") return;
    let alive = true;
    const auto = async () => {
      // 단축어 POST 직후라 저장이 반영될 시간을 살짝 대기
      for (let i = 0; i < 6 && alive; i++) {
        const r = await fetch("/api/order-v2/intake", { credentials: "include" });
        const j = await r.json();
        const latest = (j.items || [])[0] as IntakeItem | undefined;
        if (latest?.result) {
          onLoad(latest.result);
          await fetch("/api/order-v2/intake", {
            method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: latest.id, status: "done" }),
          });
          setItems((prev) => prev.filter((x) => x.id !== latest.id));
          break;
        }
        await new Promise((res) => setTimeout(res, 1000)); // 1초 후 재시도(최대 6초)
      }
      if (alive) window.history.replaceState({}, "", window.location.pathname);
    };
    void auto();
    return () => { alive = false; };
  }, [onLoad]);

  const pick = async (it: IntakeItem) => {
    if (it.result) onLoad(it.result);
    await fetch("/api/order-v2/intake", {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: it.id, status: "done" }),
    });
    setItems((prev) => prev.filter((x) => x.id !== it.id));
  };

  const dismiss = async (id: number) => {
    await fetch("/api/order-v2/intake", {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const openSetup = async () => {
    setShowSetup((s) => !s);
    if (!token) {
      try { const r = await fetch("/api/order-v2/intake/token", { credentials: "include" }); const j = await r.json(); setToken(j.token || ""); } catch { /* ignore */ }
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          📥 단축어 수신함 {items.length > 0 && <span style={{ color: "var(--action)" }}>{items.length}</span>}
        </span>
        <button onClick={load} style={chip}>새로고침</button>
        <button onClick={openSetup} style={chip}>⚙ 단축어 연결</button>
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={row}>
              <button onClick={() => pick(it)} style={{ ...pickBtn, flex: 1 }}>
                <b>{it.client_hint || "거래처 미상"}</b>
                <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 11 }}>{hhmm(it.created_at)}</span>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {(it.order_text || "").split("\n").filter(Boolean).slice(0, 2).join(" · ")}
                </div>
              </button>
              <button onClick={() => dismiss(it.id)} title="무시" style={{ ...chip, color: "var(--text-tertiary)" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {showSetup && (
        <div style={setup}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>iOS 단축어 연결</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            내 토큰 (단축어에 붙여넣기):
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <code style={{ flex: 1, fontSize: 11, background: "#fff", border: "1px solid var(--gray-300)", borderRadius: 6, padding: "6px 8px", wordBreak: "break-all" }}>{token || "…"}</code>
              <button onClick={() => { if (token) { void navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 1500); } }} style={chip}>{copied ? "✓" : "복사"}</button>
            </div>
            <div style={{ marginTop: 8 }}>
              단축어 동작 <b>3단계</b>:<br />
              <b>①</b> 최근 사진 가져오기(개수 1)<br />
              <b>②</b> URL의 콘텐츠 가져오기 — <b>POST</b><br />
              &nbsp;&nbsp;· URL: <code style={codeInline}>{origin}/api/order-v2/intake</code><br />
              &nbsp;&nbsp;· 헤더: <code style={codeInline}>x-shortcut-token: (위 토큰)</code><br />
              &nbsp;&nbsp;· 본문 <b>양식(Form)</b>: <code style={codeInline}>image</code>=사진(파일), <code style={codeInline}>tab</code>=CDV<br />
              <b>③</b> URL 열기(Open URLs) — <code style={codeInline}>{origin}/order-v2?shortcut=1</code>
              <div style={{ marginTop: 4, color: "var(--text-tertiary)" }}>③이 있어야 발주 화면이 열리고 결과가 자동으로 뜹니다.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const chip: React.CSSProperties = { padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid var(--gray-300)", background: "#fff", color: "var(--text-secondary)" };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const pickBtn: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--gray-300)", background: "#fff", cursor: "pointer", fontSize: 13, minWidth: 0 };
const setup: React.CSSProperties = { marginTop: 8, padding: 10, background: "var(--surface-muted, #f7f4f2)", borderRadius: 8, border: "1px solid var(--border-default)" };
const codeInline: React.CSSProperties = { fontSize: 11, background: "#fff", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--border-default)" };
