"use client";

import { ORDER_COLORS } from "../constants";
import { confColor } from "../lib/confidence";
import { getUnit } from "../lib/unitRules";
import type { OrderLine, OrderTab } from "../types";
import { getSelected } from "../lib/priceCalc";

type Props = {
  line: OrderLine;
  tab: OrderTab;
  isExpanded: boolean;
  onToggle: () => void;
};

/** 품목 카드의 한 줄 요약 (접힌 상태) */
export function OrderLineCompact({ line, tab, isExpanded, onToggle }: Props) {
  const sel = getSelected(line);

  return (
    <div
      style={{
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
      }}
      onClick={onToggle}
    >
      <span
        style={{
          fontSize: 8,
          color: ORDER_COLORS.textMuted,
          flexShrink: 0,
          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
          display: "inline-block",
        }}
      >
        ▶
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {sel ? (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ORDER_COLORS.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
          >
            {sel.item_name}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: ORDER_COLORS.confNone, fontWeight: 600 }}>
            미선택
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            color: "#b8b0a8",
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 1,
            flexWrap: "wrap",
          }}
        >
          {sel?.item_no || ""} · &quot;{line.query}&quot;
          {sel?.incoming && (
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: "#0369a1",
                background: "#e0f2fe",
                padding: "0px 4px",
                borderRadius: 3,
              }}
            >
              입고
            </span>
          )}
          {line.review_note && <ReviewBadge note={line.review_note} />}
        </span>
      </div>

      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: line.qty_warning ? "#D32F2F" : ORDER_COLORS.primary,
          flexShrink: 0,
          minWidth: 32,
          textAlign: "right",
          position: "relative",
        }}
        title={line.qty_warning || ""}
      >
        {line.quantity}
        {getUnit(tab, sel?.item_no, sel?.item_name)}
        {line.qty_warning && (
          <span
            style={{
              fontSize: 9,
              color: "#D32F2F",
              fontWeight: 700,
              marginLeft: 2,
              verticalAlign: "super",
            }}
          >
            ⚠️{line.qty_original_llm}
          </span>
        )}
      </span>

      {sel && <ConfidenceBadge confidence={sel.confidence} />}
    </div>
  );
}

function ReviewBadge({ note }: { note: string }) {
  // ⚠로 시작하면 의심 표시(주황), 그 외는 검수 변경(보라)
  const isWarn = note.startsWith("⚠");
  const color = isWarn ? "var(--promo)" : "#5b21b6";
  const bg = isWarn ? "#fef3c7" : "#ede9fe";
  return (
    <span
      title={note}
      style={{
        fontSize: 8,
        fontWeight: 700,
        color,
        background: bg,
        padding: "0px 5px",
        borderRadius: 3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 220,
      }}
    >
      {note}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confColor(confidence);
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color,
        padding: "2px 6px",
        borderRadius: 4,
        background: `${color}0a`,
        border: `1px solid ${color}20`,
        flexShrink: 0,
      }}
    >
      {Math.round(confidence * 100)}%
    </span>
  );
}
