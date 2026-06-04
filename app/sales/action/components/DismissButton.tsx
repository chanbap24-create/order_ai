"use client";

import type React from "react";

type Props = {
  onDismiss: (e?: React.MouseEvent) => void;
  variant?: "corner" | "inline";
};

/** ✓ 확인 처리 버튼 — 우상단 corner 또는 인라인 */
export function DismissButton({ onDismiss, variant = "corner" }: Props) {
  const base: React.CSSProperties = {
    width: variant === "inline" ? 20 : 22,
    height: variant === "inline" ? 20 : 22,
    borderRadius: 99,
    border: "1px solid var(--border-default)",
    background: "var(--surface-muted)",
    color: "#bbb",
    fontSize: variant === "inline" ? 10 : 11,
    cursor: "pointer",
    padding: 0,
    lineHeight: variant === "inline" ? "18px" : "20px",
  };
  const style: React.CSSProperties =
    variant === "corner"
      ? { ...base, position: "absolute", top: 8, right: 8, zIndex: 1 }
      : { ...base, flexShrink: 0, border: "1.5px solid var(--border-default)" };

  return (
    <button onClick={(e) => onDismiss(e)} style={style} title="확인 처리">
      ✓
    </button>
  );
}
