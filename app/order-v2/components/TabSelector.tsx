"use client";

import { ORDER_COLORS } from "../constants";
import type { OrderTab } from "../types";

type Props = {
  value: OrderTab;
  onChange: (tab: OrderTab) => void;
};

/** CDV / DL 토글 */
export function TabSelector({ value, onChange }: Props) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 0,
        background: "var(--border-subtle)",
        borderRadius: 9,
        padding: 3,
        marginBottom: 18,
      }}
    >
      {(["CDV", "DL"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: "7px 22px",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            background: value === t ? "#fff" : "transparent",
            color: value === t ? ORDER_COLORS.primary : ORDER_COLORS.textMuted,
            cursor: "pointer",
            boxShadow: value === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.2s ease",
            letterSpacing: "0.04em",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
