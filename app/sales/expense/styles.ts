import type React from "react";

export const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  border: "1px solid rgba(90,21,21,0.06)",
  boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
  padding: 18,
  marginBottom: 16,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#8a8580",
  display: "block",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(90,21,21,0.08)",
  fontSize: 16,
  outline: "none",
  background: "#faf9f7",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

export const btnPrimary: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 10,
  border: "none",
  background: "#5A1515",
  color: "white",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.2s ease",
};
