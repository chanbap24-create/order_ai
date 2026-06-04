"use client";

type Props = {
  visible: boolean;
  excludedCount: number;
  loading: boolean;
  onReset: () => void;
  onRecalc: () => void;
};

export function RecalcBar(p: Props) {
  if (!p.visible) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 80,
        zIndex: 10,
        marginBottom: 16,
        padding: "10px 20px",
        borderRadius: 6,
        background: "#fff",
        border: "1px solid var(--status-warning)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--status-warning)" }}>
        {p.excludedCount}개 제외됨
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={p.onReset}
          style={{
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 500,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 4,
            cursor: "pointer",
            color: "#999",
          }}
        >
          초기화
        </button>
        <button
          onClick={p.onRecalc}
          disabled={p.loading}
          style={{
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--status-warning)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {p.loading ? "계산 중..." : "재계산"}
        </button>
      </div>
    </div>
  );
}
