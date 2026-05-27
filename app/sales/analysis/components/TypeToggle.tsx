"use client";

import type { AnalysisType } from "../types";

type Props = {
  type: AnalysisType;
  setType: (t: AnalysisType) => void;
  isAdmin: boolean;
  currentManager: string;
};

/**
 * 상단 CDV/DL 토글 + 안내 문구.
 * 작은 segmented control + tertiary 텍스트.
 */
export function TypeToggle({ type, setType, isAdmin, currentManager }: Props) {
  const isWine = type === "wine";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
        {isAdmin ? "담당/부서/거래처별" : `${currentManager} 담당`} 출고{" "}
        {isWine ? "까브드뱅" : "대유라이프"} 분석
      </div>
      <div style={{ display: "flex", height: 28 }}>
        {([
          { value: "wine", label: "까브드뱅" },
          { value: "glass", label: "대유라이프" },
        ] as const).map((o, idx) => {
          const isActive = type === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setType(o.value)}
              style={{
                minWidth: 80,
                padding: "0 14px",
                border: "1px solid var(--border-default)",
                background: isActive ? "var(--action)" : "var(--surface)",
                color: isActive ? "var(--text-on-primary)" : "var(--text-tertiary)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                borderRadius: idx === 0 ? "6px 0 0 6px" : "0 6px 6px 0",
                borderLeftWidth: idx === 0 ? 1 : 0,
                letterSpacing: "0.02em",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
