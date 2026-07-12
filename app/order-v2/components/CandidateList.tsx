"use client";

import { ORDER_COLORS } from "../constants";
import { confColor } from "../lib/confidence";
import type { Candidate } from "../types";

type Props = {
  candidates: Candidate[];
  selectedIdx: number;
  historySet: Set<string>;
  onSelect: (candIdx: number) => void;
};

/** 후보 라디오 버튼 리스트 */
export function CandidateList({ candidates, selectedIdx, historySet, onSelect }: Props) {
  return (
    <>
      {candidates.map((cand, cIdx) => {
        const isSelected = selectedIdx === cIdx;
        const hasHistory = historySet.has(cand.item_no.trim().toUpperCase());
        return (
          <button
            key={cIdx}
            onClick={() => onSelect(cIdx)}
            className="order-cand-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "7px 14px",
              border: "none",
              background: isSelected
                ? "var(--surface-hover)"
                : hasHistory
                  ? "rgba(22,163,74,0.04)"
                  : "transparent",
              cursor: "pointer",
              textAlign: "left",
              borderLeft: isSelected
                ? "3px solid var(--action)"
                : hasHistory
                  ? "3px solid rgba(22,163,74,0.3)"
                  : "3px solid transparent",
              transition: "all 0.15s ease",
            }}
          >
            <Radio isSelected={isSelected} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? ORDER_COLORS.text : "var(--neutral-200)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {cand.item_name}
                {hasHistory && (
                  <span
                    style={{
                      fontSize: 8,
                      color: ORDER_COLORS.confHigh,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    ●
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#b8b0a8",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                {cand.item_no} · 재고 {cand.available_stock} · {cand.reasoning}
                {cand.incoming && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: "#0369a1",
                      background: "#e0f2fe",
                      padding: "0px 4px",
                      borderRadius: 3,
                      border: "1px solid #bae6fd",
                    }}
                  >
                    입고 {cand.incoming.arrival_date.slice(5)}
                  </span>
                )}
              </div>
            </div>
            <ConfidenceBadge confidence={cand.confidence} />
          </button>
        );
      })}
    </>
  );
}

function Radio({ isSelected }: { isSelected: boolean }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        flexShrink: 0,
        border: isSelected ? "2px solid var(--action)" : "2px solid #d8d3ce",
        background: isSelected ? ORDER_COLORS.primary : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
      }}
    >
      {isSelected && (
        <span
          style={{ width: 5, height: 5, borderRadius: 3, background: "#fff" }}
        />
      )}
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
