"use client";

import { useEffect, useState } from "react";
import { formatWon } from "../lib/format";
import { useSavedQuotes } from "../hooks/useSavedQuotes";

type Props = {
  open: boolean;
  onClose: () => void;
  getManagerParam: () => string;
  hasDraftItems: boolean;
  /** 복원 완료 후: 부모가 작업 견적 재로딩 + 거래처 반영 + 견적 패널 열기 */
  onLoaded: (clientName: string, clientCode: string | null) => void;
};

const fmtDate = (s: string) => (s ? s.slice(0, 16).replace("T", " ") : "");

/** 저장된 견적(이력) 목록 모달 — 열람 / 불러와 편집 / 삭제 */
export function SavedQuotesPanel({ open, onClose, getManagerParam, hasDraftItems, onLoaded }: Props) {
  const sq = useSavedQuotes(getManagerParam);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedItems, setExpandedItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setExpandedId(null); void sq.load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          <span style={{ fontWeight: 700, fontSize: 15 }}>저장된 견적</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--gray-100)" }}>
          <input
            placeholder="거래처명으로 검색"
            value={sq.search}
            onChange={(e) => sq.setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void sq.load(); }}
            style={searchInput}
          />
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {sq.loading && <div style={empty}>불러오는 중…</div>}
          {!sq.loading && sq.items.length === 0 && (
            <div style={empty}>저장된 견적이 없습니다. (견적서를 내보내면 자동 저장됩니다)</div>
          )}
          {!sq.loading && sq.items.map((it) => (
            <div key={it.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
              <div style={rowMain}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.client_name || "(거래처 미지정)"}
                    {it.company && <span style={badge}>{it.company}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {fmtDate(it.created_at)} · {it.item_count}개 · {formatWon(Number(it.total_supply) || 0)}
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
  padding: "12px 16px", borderBottom: "1px solid var(--gray-100)",
};
const closeBtn: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: 16, cursor: "pointer", color: "var(--text-tertiary)",
};
const searchInput: React.CSSProperties = {
  width: "100%", fontSize: 16, padding: "7px 11px", borderRadius: 8,
  border: "1.5px solid var(--gray-200)", outline: "none",
};
const empty: React.CSSProperties = { padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 };
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
