"use client";

import type { BrandValidation } from "@/app/types/wine";

export function ValidationBanner({ v }: { v: BrandValidation | null }) {
  if (!v) return null;

  const color = v.confidence >= 90 ? "#2e7d32" : v.confidence >= 70 ? "#ed6c02" : "#d32f2f";
  const bg = v.confidence >= 90 ? "#e8f5e9" : v.confidence >= 70 ? "#fff3e0" : "#ffebee";
  const borderColor =
    v.confidence >= 90
      ? "rgba(46,125,50,0.2)"
      : v.confidence >= 70
        ? "rgba(237,108,2,0.2)"
        : "rgba(211,47,47,0.2)";
  const bgFaint =
    v.confidence >= 90
      ? "rgba(46,125,50,0.04)"
      : v.confidence >= 70
        ? "rgba(237,108,2,0.04)"
        : "rgba(211,47,47,0.04)";

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 14px",
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: bgFaint,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color,
          flexShrink: 0,
        }}
      >
        {v.confidence}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color,
            marginBottom: 2,
          }}
        >
          AI 검증 결과: 신뢰도 {v.confidence}%
          {v.confidence >= 90 ? " — 정확" : v.confidence >= 70 ? " — 대체로 정확" : " — 주의 필요"}
        </div>
        {v.issues.length > 0 && (
          <div style={{ fontSize: 11, color: "#6b6560", lineHeight: 1.5 }}>
            {v.issues.map((issue, i) => (
              <div key={i}>• {issue}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
