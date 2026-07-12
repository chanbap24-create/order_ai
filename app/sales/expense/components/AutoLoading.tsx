"use client";

import { cardStyle } from "../styles";

export function AutoLoading() {
  return (
    <div style={{ ...cardStyle, textAlign: "center", padding: "32px 16px" }}>
      <div
        style={{
          width: 20,
          height: 20,
          border: "2px solid var(--border-strong)",
          borderTop: "2px solid var(--action)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 10px",
        }}
      />
      <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>저장된 엑셀 불러오는 중...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
