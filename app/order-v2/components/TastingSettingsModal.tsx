"use client";

import { useEffect, useState } from "react";
import type { OrderTab, SearchResult } from "../types";
import { searchWines } from "../lib/api";

const WINE_TYPES = ["레드", "화이트", "스파클링", "로제", "주정강화"];

type Settings = {
  min_stock: number;
  price_min: number | null;
  price_max: number | null;
  wine_types: string[];
};
type Candidate = { item_no: string; item_name: string; available_stock: number; supply_price: number; wine_type: string; score?: number };
const won = (n: number) => (n || 0).toLocaleString();

/** 시음주 선정 설정(필터/1픽) 모달. clientCode 있으면 후보=그 거래처 AI 추천. */
export function TastingSettingsModal({ tab, clientCode, onClose }: { tab: OrderTab; clientCode?: string; onClose: () => void }) {
  const company = tab === "DL" ? "DL" : "CDV";
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState<{ item_no: string; item_name: string; available_stock?: number | null; supply_price?: number | null } | null>(null);
  const [pickQ, setPickQ] = useState("");
  const [pickResults, setPickResults] = useState<SearchResult[]>([]);
  const [rawCandidates, setRawCandidates] = useState<Candidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/sales/tasting/settings?company=${company}`)
      .then((r) => r.json())
      .then((d) => { if (d.settings) setS(d.settings); })
      .catch(() => setS({ min_stock: 1, price_min: null, price_max: null, wine_types: [] }));
    fetch(`/api/sales/tasting/monthly-pick?company=${company}`)
      .then((r) => r.json())
      .then((d) => setPick(d.pick || null))
      .catch(() => setPick(null));
  }, [company]);

  // 후보 풀 한 번 로드(거래처 있으면 그 거래처 AI 추천, 없으면 재고). 필터는 아래서 클라이언트 적용.
  useEffect(() => {
    if (pick) { setRawCandidates([]); return; }
    const params = new URLSearchParams({ company });
    if (clientCode) params.set("client_code", clientCode);
    setCandLoading(true);
    fetch(`/api/sales/tasting/candidates?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setRawCandidates(d.candidates || []))
      .catch(() => setRawCandidates([]))
      .finally(() => setCandLoading(false));
  }, [company, clientCode, pick]);

  // 현재 필터(미저장 포함)로 클라이언트 필터링
  const WT_LEN = WINE_TYPES.length;
  const candidates = rawCandidates.filter((c) => {
    if (!s) return true;
    if (c.available_stock < (s.min_stock || 0)) return false;
    if (s.price_min != null && c.supply_price < s.price_min) return false;
    if (s.price_max != null && c.supply_price > s.price_max) return false;
    if (s.wine_types.length > 0 && s.wine_types.length < WT_LEN && !s.wine_types.includes(c.wine_type)) return false;
    return true;
  });

  const onPickSearch = async (q: string) => {
    setPickQ(q);
    if (q.trim().length < 1) { setPickResults([]); return; }
    try { setPickResults(await searchWines(q, tab)); } catch { setPickResults([]); }
  };
  const choosePick = async (itemNo: string, itemName: string) => {
    setPickQ(""); setPickResults([]);
    const res = await fetch("/api/sales/tasting/monthly-pick", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, item_no: itemNo, item_name: itemName }),
    });
    const d = await res.json();
    setPick(d.pick || { item_no: itemNo, item_name: itemName });
  };
  const clearPick = async () => {
    await fetch(`/api/sales/tasting/monthly-pick?company=${company}`, { method: "DELETE" });
    setPick(null);
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      await fetch("/api/sales/tasting/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, ...s }),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const toggleType = (t: string) =>
    setS((p) => (p ? { ...p, wine_types: p.wine_types.includes(t) ? p.wine_types.filter((x) => x !== t) : [...p.wine_types, t] } : p));

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>시음주 선정 설정 ({company})</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>
          추천 시음주를 고를 때 적용되는 필터입니다.
        </div>
        {!s ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>불러오는 중…</div>
        ) : (
          <>
            <div style={row}>
              <span style={label}>최소 가용재고(이상)</span>
              <input type="number" value={s.min_stock} onChange={(e) => setS({ ...s, min_stock: Number(e.target.value) || 0 })} style={input} />
            </div>
            <div style={row}>
              <span style={label}>공급가 범위(원)</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="number" placeholder="하한" value={s.price_min ?? ""} onChange={(e) => setS({ ...s, price_min: e.target.value === "" ? null : Number(e.target.value) || 0 })} style={{ ...input, width: 90 }} />
                <span style={{ color: "var(--text-tertiary)" }}>~</span>
                <input type="number" placeholder="상한" value={s.price_max ?? ""} onChange={(e) => setS({ ...s, price_max: e.target.value === "" ? null : Number(e.target.value) || 0 })} style={{ ...input, width: 90 }} />
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={{ ...label, marginBottom: 6 }}>와인 타입 (선택 안 하면 전체)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {WINE_TYPES.map((t) => {
                  const on = s.wine_types.includes(t);
                  return (
                    <button key={t} onClick={() => toggleType(t)} style={{
                      padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: "1px solid " + (on ? "var(--action)" : "var(--gray-300)"),
                      background: on ? "var(--action)" : "#fff", color: on ? "#fff" : "var(--text-tertiary)",
                    }}>{t}</button>
                  );
                })}
              </div>
            </div>
            {/* 이달의 시음주 = 1픽(지정 시 추천보다 최우선) */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--gray-100)" }}>
              <div style={{ ...label, marginBottom: 6, fontWeight: 600 }}>이달의 시음주 (지정 시 1픽)</div>
              {pick ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <b>{pick.item_no}</b> {pick.item_name}
                    {(pick.available_stock != null || pick.supply_price != null) && (
                      <span style={{ color: "var(--text-tertiary)" }}>
                        {pick.available_stock != null ? ` · 재고 ${pick.available_stock}` : ""}
                        {pick.supply_price != null ? ` · ${won(pick.supply_price)}원` : ""}
                      </span>
                    )}
                  </span>
                  <button onClick={clearPick} style={btnGhost}>해제</button>
                </div>
              ) : (
                <>
                  <div style={{ position: "relative", marginBottom: 8 }}>
                    <input
                      value={pickQ}
                      onChange={(e) => onPickSearch(e.target.value)}
                      placeholder="와인 검색해서 지정 (없으면 추천+필터)"
                      style={{ ...input, width: "100%", textAlign: "left" }}
                    />
                    {pickResults.length > 0 && (
                      <div style={dropdown}>
                        {pickResults.slice(0, 8).map((r) => (
                          <button key={r.item_no} onClick={() => choosePick(r.item_no, r.item_name)} style={dropItem}>
                            <b>{r.item_no}</b> {r.item_name}
                            <span style={{ color: "var(--text-tertiary)" }}>
                              {` · 재고 ${r.available_stock ?? 0}`}
                              {r.supply_price ? ` · ${won(r.supply_price)}원` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 후보군 — 거래처 있으면 AI 추천순, 없으면 재고순. 클릭해 1픽 지정 */}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                    후보 {candidates.length}종 ({clientCode ? "거래처 AI 추천순" : "재고 많은 순"})
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--gray-100)", borderRadius: 8 }}>
                    {candLoading ? (
                      <div style={{ padding: 10, fontSize: 12, color: "var(--text-tertiary)" }}>불러오는 중…</div>
                    ) : candidates.length === 0 ? (
                      <div style={{ padding: 10, fontSize: 12, color: "var(--text-tertiary)" }}>조건에 맞는 후보가 없습니다.</div>
                    ) : (
                      candidates.map((c) => (
                        <button key={c.item_no} onClick={() => choosePick(c.item_no, c.item_name)} style={candRow}>
                          {c.score != null && <span style={{ color: "var(--action)", fontWeight: 700, whiteSpace: "nowrap" }}>{Math.round(c.score)}점</span>}
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.item_name}{c.wine_type ? ` · ${c.wine_type}` : ""}
                          </span>
                          <span style={{ color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>재고 {c.available_stock}</span>
                          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{won(c.supply_price)}원</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button onClick={onClose} style={btnGhost}>취소</button>
              <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "저장 중…" : "저장"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const modal: React.CSSProperties = {
  background: "#fff", borderRadius: 14, width: "min(420px, 96vw)", padding: "18px 20px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 };
const label: React.CSSProperties = { fontSize: 13, color: "var(--text-secondary)" };
const input: React.CSSProperties = { fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--gray-200)", outline: "none", width: 90, textAlign: "right" };
const btnGhost: React.CSSProperties = { padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--gray-200)", background: "#fff", color: "var(--text-secondary)" };
const btnPrimary: React.CSSProperties = { padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--action)", background: "var(--action)", color: "#fff" };
const dropdown: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 5,
  background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 8, maxHeight: 200, overflowY: "auto",
  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
};
const dropItem: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 12,
  border: "none", borderBottom: "1px solid var(--gray-100)", background: "#fff", cursor: "pointer",
};
const candRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
  padding: "7px 10px", fontSize: 12, border: "none", borderBottom: "1px solid var(--gray-100)",
  background: "#fff", cursor: "pointer", color: "var(--text-secondary)",
};
