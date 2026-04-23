"use client";

import type { AnalysisType } from "../types";

type Props = {
  type: AnalysisType;
  setType: (t: AnalysisType) => void;
  isAdmin: boolean;
  currentManager: string;
};

/** 상단 CDV/DL 토글 + 안내 문구 */
export function TypeToggle({ type, setType, isAdmin, currentManager }: Props) {
  const isWine = type === "wine";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: "0.82rem", color: "#8a8580" }}>
        {isAdmin ? "담당/부서/거래처별" : `${currentManager} 담당`} 출고 {isWine ? "와인" : "리델"} 분석
      </div>
      <div
        style={{
          display: "flex",
          background: "#F0EFED",
          borderRadius: 8,
          padding: 2,
          flexShrink: 0,
        }}
      >
        {(["wine", "glass"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: "none",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              background: type === t ? "white" : "transparent",
              color: type === t ? "#5A1515" : "#999",
              boxShadow: type === t ? "0 1px 3px rgba(90,21,21,0.05)" : "none",
            }}
          >
            {t === "wine" ? "CDV" : "DL"}
          </button>
        ))}
      </div>
    </div>
  );
}
