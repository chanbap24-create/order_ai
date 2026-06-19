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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setOpenKey(null); setExpandedId(null); void sq.load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 거래처별 그룹핑(폴더). key = client_code || client_name.
  const folders = useMemo<Folder[]>(() => {
    const map = new Map<string, Folder>();
    for (const q of sq.items) {
      const key = q.client_code || q.client_name || "(미지정)";
      const name = q.client_name || "(거래처 미지정)";
      const f = map.get(key) || { key, name, quotes: [], latest: "" };
      f.quotes.push(q);
      if (q.created_at > f.latest) f.latest = q.created_at;
      map.set(key, f);
    }
    return Array.from(map.values()).sort((a, b) => b.latest.localeCompare(a.latest));
  }, [sq.items]);

  const current = folders.find((f) => f.key === openKey) || null;

  if (!open) return null;

  const toggleView = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    const full = await sq.getOne(id);
    setExpandedItems(Array.isArray(full?.items) ? full.items : []);
    setExpandedId(id);
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
              <button onClick={() => { setOpenKey(null); setExpandedId(null); }} style={backBtn}>←</button>
            )}
            <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {current ? `📁 ${current.name}` : "저장된 견적"}
            </span>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {sq.loading && <div style={empty}>불러오는 중…</div>}
          {!sq.loading && sq.items.length === 0 && (
            <div style={empty}>저장된 견적이 없습니다. (견적서를 내보내면 자동 저장됩니다)</div>
          )}

          {/* 1단계: 거래처 폴더 목록 */}
          {!sq.loading && !current && folders.map((f) => (
            <button key={f.key} onClick={() => setOpenKey(f.key)} style={folderRow}>
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

          {/* 2단계: 선택한 거래처의 견적 목록 */}
          {!sq.loading && current && current.quotes.map((it) => (
            <div key={it.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
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
                  {expandedItems.length === 0 && <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>항목 없음</div>}
                  {expandedItems.map((q, i) => (
                    <div key={i} style={viewItem}>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {q.product_name || q.korean_name || q.item_code}
                      </span>
                      <span style={{ color: "var(--text-tertiary)" }}>×{q.quantity}</span>
                      <span style={{ minWidth: 70, textAlign: "right" }}>{formatWon(Number(q.supply_price) || 0)}</span>
                    </div>
                  ))}
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
  background: "white", borderRadius: 14, width: "min(560px, 96vw)",
  maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};
const headerRow: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 16px", borderBottom: "1px solid var(--gray-100)", gap: 8,
};
const backBtn: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: 18, cursor: "pointer",
  color: "var(--text-secondary)", padding: 0, lineHeight: 1,
};
const closeBtn: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: 16, cursor: "pointer", color: "var(--text-tertiary)",
};
const empty: React.CSSProperties = { padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 };
const folderRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  padding: "12px 16px", border: "none", borderBottom: "1px solid var(--gray-100)",
  background: "white", cursor: "pointer",
};
const countPill: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
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
  display: "flex", gap: 8, fontSize: 12, padding: "3px 0",
  borderTop: "1px dashed var(--gray-100)", color: "var(--text-secondary)",
};
