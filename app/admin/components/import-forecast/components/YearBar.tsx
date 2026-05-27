"use client";

type Props = {
  year: string;
  pct: number;
  weight: number;
  singleYear: boolean;
  label: React.ReactNode;
  rightText?: React.ReactNode;
};

/** 연도별 추이 바 — label은 바 안쪽 텍스트, rightText는 바 오른쪽 보조 텍스트 */
export function YearBar(p: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ width: 40, fontSize: 13, fontWeight: 600, color: "#222" }}>{p.year}</div>
      {!p.singleYear && (
        <div style={{ width: 24, textAlign: "center" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: p.weight === 3 ? "var(--action)" : p.weight === 2 ? "#b87333" : "#ccc",
            }}
          >
            ×{p.weight}
          </span>
        </div>
      )}
      <div
        style={{
          flex: 1,
          height: 28,
          background: "#f5f5f5",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${p.pct}%`,
            background: p.weight === 3 ? "var(--action)" : p.weight === 2 ? "#b87333" : "#ccc",
            borderRadius: 4,
            transition: "width 0.3s",
            minWidth: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 12,
            fontWeight: 600,
            color: p.pct > 40 ? "#fff" : "#222",
          }}
        >
          {p.label}
        </div>
      </div>
      {p.rightText && (
        <div style={{ width: 90, fontSize: 10, color: "#999", textAlign: "right" }}>
          {p.rightText}
        </div>
      )}
    </div>
  );
}
