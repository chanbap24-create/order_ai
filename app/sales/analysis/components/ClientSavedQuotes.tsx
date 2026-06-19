"use client";

import { useEffect, useState } from "react";

type QuoteMeta = {
  id: number;
  company: string | null;
  item_count: number;
  total_supply: number;
  created_at: string;
};
type ConvItem = { item_code: string; name: string; quoted_qty: number; shipped_qty: number; converted: boolean };

type Props = { clientCode: string; manager: string };

const won = (n: number) => `${(Number(n) || 0).toLocaleString()}원`;
const fmtDate = (s: string) => (s ? s.slice(0, 16).replace("T", " ") : "");

/** 거래처 상세 — 이 거래처의 저장된 견적서 목록(읽기 전용) + 항목별 출고 표시 */
export function ClientSavedQuotes({ clientCode, manager }: Props) {
  const [quotes, setQuotes] = useState<QuoteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [items, setItems] = useState<ConvItem[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [summary, setSummary] = useState<any>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const url = `/api/quote/saved?client_code=${encodeURIComponent(clientCode)}` +
      (manager ? `&manager=${encodeURIComponent(manager)}` : "");
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (alive) setQuotes(d.success ? d.items : []); })
      .catch(() => { if (alive) setQuotes([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clientCode, manager]);

  const toggle = async (id: number) => {
    if (openId === id) { setOpenId(null); return; }
    const res = await fetch(`/api/quote/saved/conversion?id=${id}`);
    const d = await res.json();
    setItems(d.success && Array.isArray(d.items) ? d.items : []);
    setSummary(d.success ? d.summary : null);
    setOpenId(id);
  };

  // 저장 스냅샷에서 바로 Excel 재생성(작업 초안 미변경)
  const downloadExcel = async (q: QuoteMeta) => {
    setDownloading(q.id);
    try {
      const res = await fetch(`/api/quote/export?saved_id=${q.id}`);
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `견적서_${q.created_at.slice(0, 10).replace(/-/g, "")}.xlsx`;
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

  if (loading) return <div style={muted}>불러오는 중…</div>;
  if (quotes.length === 0) {
    return <div style={muted}>저장된 견적서가 없습니다. 인벤토리에서 견적서를 내보내면 여기에 쌓입니다.</div>;
  }

  return (
    <div>
      {quotes.map((q) => (
        <div key={q.id} style={card}>
          <div style={headerRow}>
            <button onClick={() => toggle(q.id)} style={toggleBtn}>
              <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {fmtDate(q.created_at)}
                  {q.company && <span style={badge}>{q.company}</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {q.item_count}개 · {won(q.total_supply)}
                </div>
              </div>
              <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{openId === q.id ? "▲" : "▼"}</span>
            </button>
            <button onClick={() => downloadExcel(q)} disabled={downloading === q.id} style={dlBtn}>
              {downloading === q.id ? "생성 중…" : "Excel"}
            </button>
          </div>

          {openId === q.id && (
            <div style={{ padding: "4px 14px 12px" }}>
              {summary && (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "2px 0 6px" }}>
                  출고 전환 {summary.converted}/{summary.total}종 · 수량 {summary.shipped_qty}/{summary.quoted_qty} (60일)
                </div>
              )}
              {items.map((it, i) => (
                <div key={i} style={itemRow}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.name}
                  </span>
                  <span style={{ color: "var(--text-tertiary)" }}>견적 ×{it.quoted_qty}</span>
                  <span style={{
                    minWidth: 64, textAlign: "right", fontWeight: 700,
                    color: it.converted ? "var(--color-success)" : "var(--text-muted)",
                  }}>
                    {it.converted ? `출고 ×${it.shipped_qty}` : "미출고"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const muted: React.CSSProperties = { fontSize: 13, color: "var(--text-tertiary)", padding: "20px 4px", textAlign: "center" };
const card: React.CSSProperties = {
  background: "white", border: "1px solid var(--gray-200)", borderRadius: 10, marginBottom: 10, overflow: "hidden",
};
const headerRow: React.CSSProperties = {
  display: "flex", alignItems: "stretch", gap: 0,
};
const toggleBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0,
  padding: "12px 14px", border: "none", background: "white", cursor: "pointer",
};
const dlBtn: React.CSSProperties = {
  flexShrink: 0, margin: "8px 10px", padding: "0 12px", borderRadius: 7,
  border: "1px solid var(--action)", background: "white", color: "var(--action)",
  fontSize: 12, fontWeight: 700, cursor: "pointer",
};
const badge: React.CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 6px",
  borderRadius: 6, background: "var(--border-default)", color: "var(--text-secondary)",
};
const itemRow: React.CSSProperties = {
  display: "flex", gap: 8, fontSize: 12.5, padding: "4px 0",
  borderTop: "1px dashed var(--gray-100)", color: "var(--text-secondary)",
};
