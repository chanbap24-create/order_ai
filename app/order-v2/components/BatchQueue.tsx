"use client";

import { useState } from "react";
import { ORDER_COLORS } from "../constants";
import { buildBatchAllMessage } from "../lib/batchMessage";
import { BatchOrderCard } from "./BatchOrderCard";
import type { BatchOrder, Client, OrderTab } from "../types";

type Props = {
  orders: BatchOrder[];
  processing: boolean;
  tab: OrderTab;
  onSelectCandidate: (id: string, lineIdx: number, candIdx: number) => void;
  onSetQty: (id: string, lineIdx: number, qty: number) => void;
  onSetClient: (id: string, client: Client) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export function BatchQueue({ orders, processing, tab, onSelectCandidate, onSetQty, onSetClient, onRemove, onClear }: Props) {
  const [copiedAll, setCopiedAll] = useState(false);
  if (orders.length === 0) return null;

  const done = orders.filter((o) => o.status !== "extracting" && o.status !== "parsing").length;
  const ready = orders.filter((o) => o.status === "ready").length;
  const attention = orders.filter((o) => o.status === "needs_client" || o.status === "needs_review" || o.status === "error").length;

  const copyAll = () => {
    navigator.clipboard.writeText(buildBatchAllMessage(orders, tab));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: ORDER_COLORS.text }}>
          📥 발주 인박스 <span style={{ color: ORDER_COLORS.primary }}>{orders.length}건</span>
        </div>
        <div style={{ fontSize: 12, color: ORDER_COLORS.textMuted }}>
          {processing ? `처리 중 ${done}/${orders.length}` : `완료 ${done}/${orders.length}`}
          {ready > 0 && <span style={{ color: ORDER_COLORS.confHigh, fontWeight: 600 }}> · 자신있음 {ready}</span>}
          {attention > 0 && <span style={{ color: ORDER_COLORS.confLow, fontWeight: 600 }}> · 확인필요 {attention}</span>}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={copyAll}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: copiedAll ? ORDER_COLORS.confHigh : "var(--action)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {copiedAll ? "전체 복사됨 ✓" : "전체 복사"}
          </button>
          <button onClick={onClear}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--surface)", color: ORDER_COLORS.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            비우기
          </button>
        </div>
      </div>

      {orders.map((o) => (
        <BatchOrderCard
          key={o.id}
          order={o}
          tab={tab}
          onSelectCandidate={(li, ci) => onSelectCandidate(o.id, li, ci)}
          onSetQty={(li, q) => onSetQty(o.id, li, q)}
          onSetClient={(c) => onSetClient(o.id, c)}
          onRemove={() => onRemove(o.id)}
        />
      ))}
    </div>
  );
}
