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
type FavRow = { item_no: string; item_name: string; is_default: boolean; available_stock?: number | null; supply_price?: number | null };
const won = (n: number) => (n || 0).toLocaleString();

/** 시음주 선정 설정(필터 + 즐겨찾기) 모달. clientCode 있으면 후보=그 거래처 AI 추천. */
export function TastingSettingsModal({ tab, clientCode, onClose }: { tab: OrderTab; clientCode?: string; onClose: () => void }) {
  const company = tab === "DL" ? "DL" : "CDV";
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState<FavRow[]>([]);
  const [favQ, setFavQ] = useState("");
  const [favResults, setFavResults] = useState<SearchResult[]>([]);
  const [rawCandidates, setRawCandidates] = useState<Candidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/sales/tasting/settings?company=${company}`)
      .then((r) => r.json())
      .then((d) => { if (d.settings) setS(d.settings); })
      .catch(() => setS({ min_stock: 1, price_min: null, price_max: null, wine_types: [] }));
    fetch(`/api/sales/tasting/favorites?company=${company}`)
      .then((r) => r.json())
      .then((d) => setFavorites(d.favorites || []))
      .catch(() => setFavorites([]));
  }, [company]);

  // 후보 풀 로드(거래처 있으면 그 거래처 AI 추천순, 없으면 재고). 클릭하면 즐겨찾기에 추가.
  useEffect(() => {
    const params = new URLSearchParams({ company });
    if (clientCode) params.set("client_code", clientCode);
    setCandLoading(true);
    fetch(`/api/sales/tasting/candidates?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setRawCandidates(d.candidates || []))
      .catch(() => setRawCandidates([]))
      .finally(() => setCandLoading(false));
  }, [company, clientCode]);

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

  const onFavSearch = async (q: string) => {
    setFavQ(q);
    if (q.trim().length < 1) { setFavResults([]); return; }
    try { setFavResults(await searchWines(q, tab)); } catch { setFavResults([]); }
  };
  const addFav = async (itemNo: string, itemName: string) => {
    setFavQ(""); setFavResults([]);
    const res = await fetch("/api/sales/tasting/favorites", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, item_no: itemNo, item_name: itemName }),
    });
    const d = await res.json();
    setFavorites(d.favorites || []);
  };
  const removeFav = async (itemNo: string) => {
    const res = await fetch(`/api/sales/tasting/favorites?company=${company}&item_no=${encodeURIComponent(itemNo)}`, { method: "DELETE" });
    const d = await res.json();
    setFavorites(d.favorites || []);
  };
  const toggleDefault = async (itemNo: string, makeDefault: boolean) => {
    const res = await fetch("/api/sales/tasting/favorites", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, item_no: itemNo, is_default: makeDefault }),
    });
    const d = await res.json();
    setFavorites(d.favorites || []);
  };
  const favSet = new Set(favorites.map((f) => f.item_no));
  const hasDefault = favorites.some((f) => f.is_default);

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
            {/* 즐겨찾기 = 여러 개 등록 + 기본값 1개(선택). 기본값 있으면 우선, 없으면 AI 추천 */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--gray-100)" }}>
              <div style={{ ...label, marginBottom: 2, fontWeight: 600 }}>즐겨찾기</div>
              <div style={{ fontSize: 11, color: hasDefault ? "var(--action)" : "var(--text-muted)", marginBottom: 8 }}>
                {hasDefault ? "★ 기본값이 지정됨 — 시음주 추가 시 이 와인을 우선 사용" : "기본값 미지정 → AI 추천으로 자동 선정"}
              </div>

              {/* 검색해서 즐겨찾기 추가 */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={favQ} onChange={(e) => onFavSearch(e.target.value)}
                  placeholder="와인 검색해서 즐겨찾기 추가" style={{ ...input, width: "100%", textAlign: "left" }} />
                {favResults.length > 0 && (
                  <div style={dropdown}>
                    {favResults.slice(0, 8).map((r) => (
                      <button key={r.item_no} onClick={() => addFav(r.item_no, r.item_name)} style={dropItem} disabled={favSet.has(r.item_no)}>
                        <b>{r.item_no}</b> {r.item_name}
                        <span style={{ color: "var(--text-tertiary)" }}>
                          {` · 재고 ${r.available_stock ?? 0}`}{r.supply_price ? ` · ${won(r.supply_price)}원` : ""}{favSet.has(r.item_no) ? " · 이미 있음" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 즐겨찾기 목록 */}
              {favorites.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {favorites.map((f) => (
                    <div key={f.item_no} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 6, background: f.is_default ? "var(--action-muted, #f3e9e9)" : "transparent" }}>
                      <button onClick={() => toggleDefault(f.item_no, !f.is_default)} title={f.is_default ? "기본값 해제" : "기본값으로"}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: f.is_default ? "var(--action)" : "var(--gray-300)", padding: 0 }}>
                        {f.is_default ? "★" : "☆"}
                      </button>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                        {f.item_name}
                        <span style={{ color: "var(--text-tertiary)" }}>
                          {f.available_stock != null ? ` · 재고 ${f.available_stock}` : ""}{f.supply_price != null ? ` · ${won(f.supply_price)}원` : ""}
                        </span>
                      </span>
                      <button onClick={() => removeFav(f.item_no)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 15, padding: 0 }} title="삭제">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* 후보군 — 클릭해 즐겨찾기에 추가 */}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                후보 {candidates.length}종 ({clientCode ? "거래처 AI 추천순" : "재고 많은 순"}) · 클릭해 즐겨찾기 추가
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--gray-100)", borderRadius: 8 }}>
                {candLoading ? (
                  <div style={{ padding: 10, fontSize: 12, color: "var(--text-tertiary)" }}>불러오는 중…</div>
                ) : candidates.length === 0 ? (
                  <div style={{ padding: 10, fontSize: 12, color: "var(--text-tertiary)" }}>조건에 맞는 후보가 없습니다.</div>
                ) : (
                  candidates.map((c) => (
                    <button key={c.item_no} onClick={() => addFav(c.item_no, c.item_name)} style={candRow} disabled={favSet.has(c.item_no)}>
                      {c.score != null && <span style={{ color: "var(--action)", fontWeight: 700, whiteSpace: "nowrap" }}>{Math.round(c.score)}점</span>}
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.item_name}{c.wine_type ? ` · ${c.wine_type}` : ""}
                      </span>
                      <span style={{ color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>재고 {c.available_stock}</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{won(c.supply_price)}원</span>
                      {favSet.has(c.item_no) && <span style={{ color: "var(--action)", whiteSpace: "nowrap" }}>✓</span>}
                    </button>
                  ))
                )}
              </div>
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
