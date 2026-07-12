import type React from "react";

/**
 * Expense 탭 공용 스타일. 모든 값은 의미 토큰 사용.
 * 8px grid + density md (16/20) + radius 10.
 */

export const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  padding: 20,
  marginBottom: 16,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-tertiary)",
  display: "block",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--border-default)",
  fontSize: 13,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text-primary)",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  height: 34,
};

export const btnPrimary: React.CSSProperties = {
  height: 34,
  padding: "0 16px",
  borderRadius: 6,
  border: "1px solid var(--action)",
  background: "var(--action)",
  color: "var(--text-on-primary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.12s ease",
  letterSpacing: "0.01em",
};
