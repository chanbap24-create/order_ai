import type React from "react";

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#888",
  marginBottom: 5,
  display: "block",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

export const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 13,
  border: "1px solid #e0e0e0",
  borderRadius: 6,
  background: "#fff",
  outline: "none",
  color: "#222",
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  transition: "border-color 0.15s",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 13,
  border: "1px solid #e0e0e0",
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
  color: "#222",
  background: "#fff",
  transition: "border-color 0.15s",
};
