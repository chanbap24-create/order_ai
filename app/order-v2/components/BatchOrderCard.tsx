"use client";

import { useState } from "react";
import { ORDER_COLORS } from "../constants";
import { buildBatchMessage } from "../lib/batchMessage";
import { CandidateList } from "./CandidateList";
import type { BatchOrder, BatchStatus, Client, OrderTab } from "../types";

const STATUS_META: Record<BatchStatus, { label: string; color: string }> = {
  extracting: { label: "📷 분석 중", color: ORDER_COLORS.textMuted },
  parsing: { label: "⏳ 파싱 중", color: ORDER_COLORS.textMuted },
  ready: { label: "✅ 자신 있음", color: ORDER_COLORS.confHigh },
  needs_client: { label: "⚠️ 거래처 확인", color: ORDER_COLORS.confLow },
  needs_review: { label: "⚠️ 품목 확인", color: ORDER_COLORS.confLow },
  error: { label: "❌ 실패", color: ORDER_COLORS.confNone },
};

type Props = {
  order: BatchOrder;
  tab: OrderTab;
  onSelectCandidate: (lineIdx: number, candIdx: number) => void;
  onSetQty: (lineIdx: number, qty: number) => void;
  onSetClient: (client: Client) => void;
  onRemove: () => void;
};

export function BatchOrderCard({ order, tab, onSelectCandidate, onSetQty, onSetClient, onRemove }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const meta = STATUS_META[order.status];
  const busy = order.status === "extracting" || order.status === "parsing";

  const copy = () => {
    navigator.clipboard.writeText(buildBatchMessage(order, tab));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ border: "1px solid var(--action-muted)", borderRadius: 12, background: "#fff", overflow: "hidden", marginBottom: 10 }}>
      {/* 헤더: 거래처 + 상태 + 삭제 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: ORDER_COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {order.client?.client_name || order.clientHint || order.fileName}
          </div>
          {!order.client && order.clientHint && (
            <div style={{ fontSize: 11, color: ORDER_COLORS.confLow }}>거래처 미확정 · 힌트: {order.clientHint}</div>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>
        <button onClick={onRemove} style={{ border: "none", background: "transparent", color: ORDER_COLORS.textMuted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
      </div>

      {busy && <div style={{ padding: "12px 14px", fontSize: 13, color: ORDER_COLORS.textMuted }}>{meta.label}…</div>}

      {order.status === "error" && (
        <div style={{ padding: "12px 14px", fontSize: 13, color: ORDER_COLORS.confNone }}>{order.error || "처리 실패"}</div>
      )}

      {!busy && order.status !== "error" && (
        <>
          {/* 거래처 미확정 → 후보 빠른선택 */}
          {!order.client && order.clientOptions.length > 0 && (
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {order.clientOptions.slice(0, 6).map((c) => (
                <button key={c.client_code} onClick={() => onSetClient(c)}
                  style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--surface)", color: "var(--action)", cursor: "pointer" }}>
                  {c.client_name}
                </button>
              ))}
            </div>
          )}

          {/* 발주 라인 */}
          <div style={{ padding: "4px 0" }}>
            {order.orderLines.map((ol, lineIdx) => {
              const sel = ol.selectedIdx >= 0 ? ol.candidates[ol.selectedIdx] : undefined;
              const isOpen = expanded === lineIdx;
              const low = !sel || sel.confidence < 0.7;
              return (
                <div key={lineIdx} style={{ borderTop: lineIdx > 0 ? "1px solid var(--border-subtle)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px" }}>
                    <button onClick={() => setExpanded(isOpen ? null : lineIdx)}
                      style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: low ? ORDER_COLORS.confLow : ORDER_COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sel ? sel.item_name : `(매칭 없음) ${ol.query}`}
                      </div>
                      <div style={{ fontSize: 10, color: "#b8b0a8" }}>
                        원문: {ol.query}{sel ? ` · ${Math.round(sel.confidence * 100)}%` : ""}{ol.candidates.length > 1 ? " · 후보 변경 ▾" : ""}
                      </div>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <QtyBtn label="−" onClick={() => onSetQty(lineIdx, ol.quantity - 1)} />
                      <span style={{ minWidth: 22, textAlign: "center", fontSize: 14, fontWeight: 700, color: ORDER_COLORS.text }}>{ol.quantity}</span>
                      <QtyBtn label="＋" onClick={() => onSetQty(lineIdx, ol.quantity + 1)} />
                    </div>
                  </div>
                  {isOpen && ol.candidates.length > 0 && (
                    <div style={{ background: "var(--surface-muted)", borderTop: "1px solid var(--border-subtle)" }}>
                      <CandidateList candidates={ol.candidates} selectedIdx={ol.selectedIdx} historySet={order.historySet}
                        onSelect={(cIdx) => { onSelectCandidate(lineIdx, cIdx); setExpanded(null); }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 복사 */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-subtle)" }}>
            <button onClick={copy} disabled={!order.client && !order.clientHint}
              style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: copied ? ORDER_COLORS.confHigh : "var(--action)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {copied ? "복사됨 ✓" : "이 건 복사"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function QtyBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--surface)", color: ORDER_COLORS.text, fontSize: 14, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
      {label}
    </button>
  );
}
