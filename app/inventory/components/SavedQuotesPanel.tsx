"use client";

import { useEffect, useMemo, useState } from "react";
import { formatWon } from "../lib/format";
import { useSavedQuotes, type SavedQuoteMeta } from "../hooks/useSavedQuotes";

type Props = {
  open: boolean;
  onClose: () => void;
  getManagerParam: () => string;
  hasDraftItems: boolean;
  /** 복원 완료 후: 부모가 작업 견적 재로딩 + 거래처 반영 + 견적 패널 열기 */
  onLoaded: (clientName: string, clientCode: string | null) => void;
};

type Folder = { key: string; name: string; quotes: SavedQuoteMeta[]; latest: string };

const fmtDate = (s: string) => (s ? s.slice(0, 16).replace("T", " ") : "");

/** 저장된 견적(이력) — 거래처별 폴더로 보기 → 폴더 열면 해당 거래처 견적 목록 */
export function SavedQuotesPanel({ open, onClose, getManagerParam, hasDraftItems, onLoaded }: Props) {
  const sq = useSavedQuotes(getManagerParam);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedItems, setExpandedItems] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedSummary, setExpandedSummary] = useState<any>(null);
  // 열람 시 스냅샷 항목(가격 포함) — 전환 항목과 같은 순서로 zip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedSnap, setExpandedSnap] = useState<any[]>([]);
  // 저장 견적의 표시 컬럼 — 가격 항목은 견적서에 포함된 컬럼만 노출
  const [expandedCols, setExpandedCols] = useState<string[] | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientConv, setClientConv] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) { setOpenKey(null); setExpandedId(null); setClientConv(null); setSearch(""); void sq.load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 거래처별 그룹핑(폴더). key = 거래처명 우선(옛 저장본은 client_code 없이 저장돼
  // 코드로 묶으면 같은 거래처가 둘로 쪼개짐 → 이름으로 묶어 한 폴더로 합침).
  const folders = useMemo<Folder[]>(() => {
    const map = new Map<string, Folder>();
    for (const q of sq.items) {
      const key = q.client_name || q.client_code || "(미지정)";
      const name = q.client_name || "(거래처 미지정)";
      const f = map.get(key) || { key, name, quotes: [], latest: "" };
      f.quotes.push(q);
      if (q.created_at > f.latest) f.latest = q.created_at;
      map.set(key, f);
    }
    // 폴더 내 견적은 최신순 정렬
    for (const f of map.values()) f.quotes.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return Array.from(map.values()).sort((a, b) => b.latest.localeCompare(a.latest));
  }, [sq.items]);

  const current = folders.find((f) => f.key === openKey) || null;

  // 거래처 검색(폴더 목록 필터) — 이름/코드 부분일치
  const q = search.trim().toLowerCase();
  const filteredFolders = q
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(q) ||
        f.quotes.some((x) => (x.client_code || "").toLowerCase().includes(q)))
    : folders;

  if (!open) return null;

  const openFolder = async (f: Folder) => {
    setOpenKey(f.key);
    setExpandedId(null);
    setClientConv(null);
    const code = f.quotes.find((q) => q.client_code)?.client_code;
    if (code) {
      const conv = await sq.clientConversion(code);
      setClientConv(conv);
    }
  };

  const goBack = () => { setOpenKey(null); setExpandedId(null); setClientConv(null); };

  const toggleView = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    const [conv, snap] = await Promise.all([sq.quoteConversion(id), sq.getOne(id)]);
    setExpandedItems(Array.isArray(conv?.items) ? conv.items : []);
    setExpandedSummary(conv?.summary || null);
    setExpandedSnap(Array.isArray(snap?.items) ? snap.items : []);
    setExpandedCols(Array.isArray(snap?.columns) ? snap.columns : null);
    setExpandedId(id);
  };

  // 저장 스냅샷에서 바로 Excel 재생성(작업 초안 미변경)
  const downloadExcel = async (id: number, createdAt: string) => {
    setDownloading(id);
    try {
      const res = await fetch(`/api/quote/export?saved_id=${id}`);
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `견적서_${createdAt.slice(0, 10).replace(/-/g, "")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setDownloading(null);
    }
  };

  const handleLoad = async (id: number) => {
    if (hasDraftItems && !confirm("현재 작업 중인 견적이 교체됩니다. 불러올까요?")) return;
    setBusy(true);
    const r = await sq.restore(id);
    setBusy(false);
    if (r) { onLoaded(r.client_name, r.client_code); onClose(); }
    else alert("불러오기에 실패했습니다.");
  };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <div style={headerRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {current && (
              <button onClick={goBack} style={backBtn}>←</button>
            )}
            <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {current ? `📁 ${current.name}` : "저장된 견적"}
            </span>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* 거래처 검색(폴더 목록에서만) */}
        {!current && !sq.loading && sq.items.length > 0 && (
          <div style={{ padding: "0 4px 8px" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="거래처명 검색…"
              autoFocus
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--gray-300)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
        )}

        <div style={{ overflowY: "auto", flex: 1 }}>
          {sq.loading && <div style={empty}>불러오는 중…</div>}
          {!sq.loading && sq.items.length === 0 && (
            <div style={empty}>저장된 견적이 없습니다. (견적서를 내보내면 자동 저장됩니다)</div>
          )}

          {/* 1단계: 거래처 폴더 목록 */}
          {!sq.loading && !current && q && filteredFolders.length === 0 && (
            <div style={empty}>&ldquo;{search.trim()}&rdquo;와 일치하는 거래처가 없습니다.</div>
          )}
          {!sq.loading && !current && filteredFolders.map((f) => (
            <button key={f.key} onClick={() => openFolder(f)} style={folderRow}>
              <span style={{ fontSize: 20 }}>📁</span>
              <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  최근 {fmtDate(f.latest)}
                </div>
              </div>
              <span style={countPill}>{f.quotes.length}</span>
              <span style={{ color: "var(--text-tertiary)", fontSize: 16 }}>›</span>
            </button>
          ))}

          {/* 2단계 상단: 이 거래처 전환 요약(견적→실제 출고, 60일 기준) */}
          {!sq.loading && current && clientConv?.summary && (
            <div style={convBanner}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                견적 → 실제 출고 (60일)
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                견적 {clientConv.summary.quotes}건 · 전환 와인{" "}
                <b style={{ color: "var(--color-success)" }}>
                  {clientConv.summary.converted_wines}/{clientConv.summary.wines}종
                </b>{" "}
                ({clientConv.summary.rate}%)
              </div>
              {clientConv.wines?.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {clientConv.wines.slice(0, 6).filter((w: { converted_count: number }) => w.converted_count > 0)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((w: any) => (
                      <span key={w.item_code} style={convChip} title={`견적 ${w.quoted_count}회 중 ${w.converted_count}회 출고`}>
                        {w.name} ✓{w.converted_count}/{w.quoted_count}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* 2단계: 선택한 거래처의 견적 목록 */}
          {!sq.loading && current && current.quotes.map((it) => (
            <div key={it.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
              <div style={rowMain}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {fmtDate(it.created_at)}
                    {it.company && <span style={badge}>{it.company}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {it.item_count}개 · {formatWon(Number(it.total_supply) || 0)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button style={btnGhost} onClick={() => toggleView(it.id)}>
                    {expandedId === it.id ? "접기" : "열람"}
                  </button>
                  <button style={btnGhost} disabled={downloading === it.id} onClick={() => downloadExcel(it.id, it.created_at)}>
                    {downloading === it.id ? "생성 중…" : "Excel"}
                  </button>
                  <button style={btnPrimary} disabled={busy} onClick={() => handleLoad(it.id)}>
                    불러오기
                  </button>
                  <button style={btnDanger} onClick={() => { if (confirm("이 저장 견적을 삭제할까요?")) void sq.remove(it.id); }}>
                    삭제
                  </button>
                </div>
              </div>
              {expandedId === it.id && (
                <div style={{ padding: "0 16px 12px 16px" }}>
                  {expandedSummary && (
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "2px 0 6px" }}>
                      출고 전환 {expandedSummary.converted}/{expandedSummary.total}종 · 수량 {expandedSummary.shipped_qty}/{expandedSummary.quoted_qty}
                    </div>
                  )}
                  {expandedItems.length === 0 && <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>항목 없음</div>}
                  {expandedItems.map((q, i) => {
                    const s = expandedSnap[i] || {};
                    const supply = Number(s.supply_price) || 0;
                    const rate = Number(s.discount_rate) || 0;
                    const stored = Number(s.discounted_price) || 0;
                    const disc = stored > 0 ? stored : Math.round(supply * (1 - rate));
                    const retailDisc = Math.round((Number(s.retail_price) || 0) * (1 - rate));
                    // 견적서에 포함된 컬럼만 노출(컬럼 정보 없으면 할인율·할인공급가 기본 표시)
                    const showCol = (k: string) => (expandedCols ? expandedCols.includes(k) : k !== "retail_discounted_price");
                    const parts: string[] = [];
                    if (showCol("discount_rate") && rate > 0) parts.push(`할인 ${Math.round(rate * 100)}%`);
                    if (showCol("discounted_price")) parts.push(`할인공급가 ${formatWon(disc)}`);
                    if (showCol("retail_discounted_price")) parts.push(`할인판매가 ${formatWon(retailDisc)}`);
                    return (
                      <div key={i} style={viewItem}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {q.name}
                          </div>
                          {parts.length > 0 && <div style={priceLine}>{parts.join(" · ")}</div>}
                        </div>
                        <span style={{ color: "var(--text-tertiary)" }}>견적 ×{q.quoted_qty}</span>
                        <span style={{
                          minWidth: 64, textAlign: "right", fontWeight: 700,
                          color: q.converted ? "var(--color-success)" : "var(--text-tertiary)",
                        }}>
                          {q.converted ? `출고 ×${q.shipped_qty}` : "미출고"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
};
const modal: React.CSSProperties = {
  background: "white", borderRadius: 12, width: "min(560px, 96vw)",
  maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};
const headerRow: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 16px", borderBottom: "1px solid var(--border-default)", gap: 8,
};
const backBtn: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: 18, cursor: "pointer",
  color: "var(--text-secondary)", padding: 0, lineHeight: 1,
};
const closeBtn: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: 16, cursor: "pointer", color: "var(--text-tertiary)",
};
const empty: React.CSSProperties = { padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 };
const convBanner: React.CSSProperties = {
  margin: "10px 16px", padding: "10px 12px", borderRadius: 12,
  background: "var(--border-subtle, #f6f4f2)", border: "1px solid var(--border-default)",
};
const convChip: React.CSSProperties = {
  fontSize: 10.5, padding: "2px 7px", borderRadius: 8,
  background: "white", border: "1px solid var(--border-default)", color: "var(--text-secondary)",
};
const folderRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  padding: "12px 16px", border: "none", borderBottom: "1px solid var(--border-default)",
  background: "white", cursor: "pointer",
};
const countPill: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
  background: "var(--border-default)", color: "var(--text-secondary)",
};
const rowMain: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "10px 16px" };
const badge: React.CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 6px",
  borderRadius: 6, background: "var(--border-default)", color: "var(--text-secondary)",
};
const btnBase: React.CSSProperties = {
  padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid",
};
const btnGhost: React.CSSProperties = { ...btnBase, borderColor: "var(--gray-200)", background: "white", color: "var(--text-secondary)" };
const btnPrimary: React.CSSProperties = { ...btnBase, borderColor: "var(--action)", background: "var(--action)", color: "white" };
const btnDanger: React.CSSProperties = { ...btnBase, borderColor: "var(--status-danger)", background: "white", color: "var(--status-danger)" };
const viewItem: React.CSSProperties = {
  display: "flex", gap: 8, fontSize: 12, padding: "5px 0", alignItems: "flex-start",
  borderTop: "1px dashed var(--gray-100)", color: "var(--text-secondary)",
};
const priceLine: React.CSSProperties = {
  fontSize: 11, color: "var(--text-tertiary)", marginTop: 1,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
